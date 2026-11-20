// Importa o export do Microsoft Forms "Registro de Visitas" (.xlsx) para a tabela `visits`.
//
// Uso (dev):   npx tsx scripts/visitas/import-visitas-forms.ts --file="C:/.../Registro de Visitas(1-93).xlsx"
//              (dry-run: só mostra o que faria)  +  --apply  para gravar.
// Uso (prod):  carregue o .env de prod e rode com NODE_ENV=production (ver CLAUDE.md, "Rodar migrações em prod").
//
// Idempotente: pula linha cuja visita (gerente + data + local + motivo) já existe no banco.
import { config as loadEnv } from 'dotenv';
import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'fs';
// shortcut: fflate vem transitivo do read-excel-file (que não lê o XML com prefixo "x:" do Forms); se sumir, `npm i -D fflate`.
import { unzipSync, strFromU8 } from 'fflate';

loadEnv({ path: '.env' });
const nodeEnv = process.env.NODE_ENV ?? 'development';
if (nodeEnv !== 'production' && existsSync('.env.development')) {
    loadEnv({ path: '.env.development', override: true });
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) throw new Error('TURSO_DATABASE_URL missing');

const apply = process.argv.includes('--apply');
const fileArg = process.argv.find(a => a.startsWith('--file='));
if (!fileArg) throw new Error('Informe --file="caminho/para/Registro de Visitas.xlsx"');
const filePath = fileArg.slice('--file='.length);

// Nome do gerente no Forms (1º nome, sem acento) → managers.id, quando o 1º nome não bate com managers.name.
const APELIDOS: Record<string, string> = {
    denilson: 'grc4-beatriz', // visitas do Denilson entram na carteira da Beatriz (Bia)
};

const sem = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const primeiroNome = (s: string) => sem(s).split(/\s+/)[0] ?? '';

function decodeXml(s: string): string {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
}

// Lê a 1ª planilha como matriz de strings. Aceita XML com ou sem prefixo de namespace ("x:").
function lerXlsx(path: string): string[][] {
    const zip = unzipSync(new Uint8Array(readFileSync(path)));
    const xml = (name: string) => (zip[name] ? strFromU8(zip[name]) : '');
    const shared = [...xml('xl/sharedStrings.xml').matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)]
        .map(m => decodeXml([...m[1].matchAll(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(t => t[1]).join('')));
    const colIdx = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

    return [...xml('xl/worksheets/sheet1.xml').matchAll(/<(?:\w+:)?row[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)].map(row => {
        const out: string[] = [];
        for (const c of row[1].matchAll(/<(?:\w+:)?c ([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
            const ref = c[1].match(/r="([A-Z]+\d+)"/)?.[1];
            const v = c[2]?.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1] ?? '';
            if (!ref) continue;
            out[colIdx(ref)] = /t="s"/.test(c[1]) && v !== '' ? shared[+v] : decodeXml(v);
        }
        return Array.from(out, x => x ?? '');
    });
}

// Data serial do Excel (dias desde 1899-12-30) → "YYYY-MM-DD".
function serialParaIso(v: string): string | null {
    const n = Number(v);
    if (!v || !Number.isFinite(n)) return null;
    return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
}

async function main() {
    console.log(`→ ${apply ? 'APPLY' : 'DRY-RUN'} contra ${url} (NODE_ENV=${nodeEnv})`);
    const client = createClient({ url: url!, authToken });

    const [header, ...linhas] = lerXlsx(filePath);
    const col = (nome: string) => {
        const i = header.findIndex(h => sem(h) === sem(nome));
        if (i < 0) throw new Error(`Coluna "${nome}" não encontrada. Cabeçalho: ${header.join(' | ')}`);
        return i;
    };
    const cId = col('ID'), cGer = col('Gerente'), cCli = col('Cliente ou órgão visitado'), cData = col('Data'), cAss = col('Assunto da visita');

    const managers = (await client.execute('SELECT id, name FROM managers')).rows as unknown as { id: string; name: string }[];
    const porNome = new Map(managers.map(m => [primeiroNome(m.name), m.id]));

    const existentes = new Set(
        (await client.execute('SELECT manager_id, data, local, motivo FROM visits')).rows
            .map(r => [r.manager_id, r.data, sem(String(r.local)), sem(String(r.motivo))].join('|')),
    );

    const inserir: { managerId: string; local: string; motivo: string; data: string; id: string }[] = [];
    const semGerente: string[] = [], invalidas: string[] = [];
    let duplicadas = 0;

    for (const l of linhas) {
        if (l.every(x => !x.trim())) continue;
        const id = l[cId], gerente = l[cGer]?.trim() ?? '';
        const local = (l[cCli] ?? '').trim().replace(/\.$/, '');
        const motivo = (l[cAss] ?? '').trim();
        const data = serialParaIso(l[cData] ?? '');
        const managerId = APELIDOS[primeiroNome(gerente)] ?? porNome.get(primeiroNome(gerente));

        if (!managerId) { semGerente.push(`#${id} "${gerente}" (${local})`); continue; }
        if (!data || !local) { invalidas.push(`#${id} data="${l[cData]}" cliente="${local}"`); continue; }

        const chave = [managerId, data, sem(local), sem(motivo)].join('|');
        if (existentes.has(chave)) { duplicadas++; continue; }
        existentes.add(chave); // também deduplica linhas repetidas dentro da própria planilha
        inserir.push({ managerId, local, motivo, data, id });
    }

    const porGerente = inserir.reduce<Record<string, number>>((a, v) => ((a[v.managerId] = (a[v.managerId] ?? 0) + 1), a), {});
    console.log(`Linhas na planilha: ${linhas.length}`);
    console.log(`A inserir: ${inserir.length}`, porGerente);
    console.log(`Já existiam / repetidas: ${duplicadas}`);
    if (invalidas.length) console.log(`Inválidas (puladas):\n  ${invalidas.join('\n  ')}`);
    if (semGerente.length) console.log(`Gerente não encontrado (puladas; adicione em APELIDOS):\n  ${semGerente.join('\n  ')}`);
    for (const v of inserir.slice(0, 5)) console.log(`  ex.: #${v.id} ${v.managerId} ${v.data} ${v.local} — ${v.motivo.slice(0, 60)}`);

    if (!apply) { console.log('\nDry-run: nada gravado. Rode de novo com --apply.'); return; }

    const agora = new Date().toISOString();
    await client.batch(inserir.map(v => ({
        sql: 'INSERT INTO visits (manager_id, titulo, local, motivo, data, data_fim, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
        args: [v.managerId, v.local, v.local, v.motivo, v.data, agora],
    })), 'write');
    console.log(`\n✓ ${inserir.length} visitas inseridas.`);
}

main().catch(e => { console.error(e); process.exit(1); });
