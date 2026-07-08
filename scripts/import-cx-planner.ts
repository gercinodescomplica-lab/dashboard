import { config as loadEnv } from 'dotenv';
import { createClient } from '@libsql/client';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

loadEnv({ path: '.env' });
const nodeEnv = process.env.NODE_ENV ?? 'development';
if (nodeEnv !== 'production' && existsSync('.env.development')) {
    loadEnv({ path: '.env.development', override: true });
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) throw new Error('TURSO_DATABASE_URL missing');

const apply = process.argv.includes('--apply');
const jsonPathArg = process.argv.find(a => a.startsWith('--file='));
const jsonPath = jsonPathArg ? jsonPathArg.slice('--file='.length) : 'temp/planner_tasks 1.json';

const client = createClient({ url, authToken });

interface PlannerTask {
    id: string;
    title: string;
    datainicio?: string;
    datafim?: string;
    prioridade?: string;
    percentComplete?: string;
    Description?: string;
}

function normalizeAcronym(s: string): string {
    // Pega o primeiro token alfanumérico (removendo parênteses/descrições)
    const m = s.trim().match(/^([A-Za-zÀ-ÿ0-9-]+)/);
    return (m ? m[1] : s.trim()).toUpperCase();
}

function splitTitle(title: string): { acronym: string; assunto: string } {
    // Divide no primeiro " - " ou " – " ou " — "
    const parts = title.split(/\s+[-–—]\s+/);
    if (parts.length === 1) {
        return { acronym: normalizeAcronym(title), assunto: title.trim() };
    }
    return { acronym: normalizeAcronym(parts[0]), assunto: parts.slice(1).join(' - ').trim() };
}

function mapStatus(percentComplete?: string): 'pendente' | 'analise' | 'resolvido' {
    const n = parseInt(percentComplete ?? '0', 10);
    if (n >= 100) return 'resolvido';
    if (n > 0) return 'analise';
    return 'pendente';
}

function mapCriticidade(prio?: string): 'baixa' | 'media' | 'alta' {
    const p = (prio ?? '').toLowerCase();
    if (p.includes('urgente')) return 'alta';
    if (p.includes('importante')) return 'media';
    return 'baixa';
}

async function main() {
    console.log(`→ ${apply ? 'APPLY' : 'DRY-RUN'} against ${url} (NODE_ENV=${nodeEnv})`);
    console.log(`→ reading ${jsonPath}`);

    const raw = readFileSync(join(process.cwd(), jsonPath), 'utf8');
    const tasks: PlannerTask[] = JSON.parse(raw);
    console.log(`→ ${tasks.length} tasks in file`);

    // Carrega managers com servedClients
    const managersRes = await client.execute(`SELECT id, name, served_clients FROM managers`);
    const clientToManager = new Map<string, { id: string; name: string }>();
    for (const row of managersRes.rows as any[]) {
        const raw = row.served_clients;
        if (!raw) continue;
        let list: string[] = [];
        try { list = JSON.parse(raw); } catch { continue; }
        for (const c of list) {
            const key = normalizeAcronym(c);
            if (clientToManager.has(key)) {
                console.warn(`  ⚠ cliente "${key}" duplicado (já em ${clientToManager.get(key)!.name}, também em ${row.name}) — mantendo primeiro`);
                continue;
            }
            clientToManager.set(key, { id: row.id, name: row.name });
        }
    }
    console.log(`→ ${clientToManager.size} client-acronyms mapped from servedClients`);

    // Carrega external_ids já existentes
    const existingRes = await client.execute(`SELECT external_id FROM cx WHERE external_id IS NOT NULL`);
    const existing = new Set((existingRes.rows as any[]).map(r => r.external_id as string));
    console.log(`→ ${existing.size} tasks already imported (external_id)`);

    const toInsert: any[] = [];
    const unmatched: { id: string; title: string; acronym: string }[] = [];
    const skipped: string[] = [];
    const byManager = new Map<string, number>();

    for (const t of tasks) {
        if (existing.has(t.id)) { skipped.push(t.id); continue; }
        const { acronym, assunto } = splitTitle(t.title);
        const match = clientToManager.get(acronym);
        if (!match) {
            unmatched.push({ id: t.id, title: t.title, acronym });
            continue;
        }
        byManager.set(match.name, (byManager.get(match.name) ?? 0) + 1);
        toInsert.push({
            external_id: t.id,
            manager_id: match.id,
            cliente: acronym,
            titulo: assunto || t.title,
            problema: t.Description ?? '',
            solucao_proposta: '',
            status: mapStatus(t.percentComplete),
            criticidade: mapCriticidade(t.prioridade),
            is_visible: 1,
            created_at: t.datainicio || new Date().toISOString(),
        });
    }

    console.log('\n=== RELATÓRIO ===');
    console.log(`Total no JSON:          ${tasks.length}`);
    console.log(`Já importados (skip):   ${skipped.length}`);
    console.log(`A inserir:              ${toInsert.length}`);
    console.log(`Sem gerente (unmatched):${unmatched.length}`);
    console.log('\n--- Por gerente ---');
    [...byManager.entries()].sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
        console.log(`  ${count.toString().padStart(4)}  ${name}`);
    });

    if (unmatched.length > 0) {
        console.log('\n--- Clientes sem gerente atribuído ---');
        const byAcr = new Map<string, number>();
        for (const u of unmatched) byAcr.set(u.acronym, (byAcr.get(u.acronym) ?? 0) + 1);
        [...byAcr.entries()].sort((a, b) => b[1] - a[1]).forEach(([acr, n]) => console.log(`  ${n.toString().padStart(4)}  ${acr}`));

        const outPath = join(process.cwd(), 'temp/cx-unmatched.json');
        writeFileSync(outPath, JSON.stringify(unmatched, null, 2));
        console.log(`\n  ✎ detalhes em ${outPath}`);
    }

    if (!apply) {
        console.log('\n(dry-run — nada foi escrito. Rode novamente com --apply para persistir.)');
        process.exit(0);
    }

    if (toInsert.length === 0) {
        console.log('\nNada a inserir.');
        process.exit(0);
    }

    console.log(`\n→ inserindo ${toInsert.length} registros...`);
    for (const row of toInsert) {
        await client.execute({
            sql: `INSERT INTO cx (external_id, manager_id, cliente, titulo, problema, solucao_proposta, status, criticidade, is_visible, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [row.external_id, row.manager_id, row.cliente, row.titulo, row.problema, row.solucao_proposta, row.status, row.criticidade, row.is_visible, row.created_at],
        });
    }
    console.log('✓ done.');
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
