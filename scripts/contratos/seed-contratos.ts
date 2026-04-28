import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { randomUUID } from 'crypto';
import { contrato } from '../../src/db/schema';

config({ path: path.resolve(process.cwd(), '.env') });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
    console.error('❌ TURSO_DATABASE_URL não definido. Verifique o arquivo .env.');
    process.exit(1);
}

const client = createClient({ url: url!, authToken });
const db = drizzle({ connection: { url, authToken } });

// ---------------------------------------------------------------------------
// Mapeamento: código "Ger." do CSV → managers.id no banco
// ---------------------------------------------------------------------------
const GERENCIA_PARA_MANAGER_ID: Record<string, string> = {
    'GRC-1': 'grc1-bruno',
    'GRC-2': 'grc2-paulo',
    'GRC-3': 'grc3-barone',
    'GRC-4': 'grc4-beatriz',
    'GRC-C': 'grcc-debora',
    'KAM-1': 'kam1-malde',
    'KAM-2': 'kam2-betone',
    'KAM-3': 'kam3-andrea',
    'KAM-4': 'kam4-tomiatto',
};

// ---------------------------------------------------------------------------
// Mapeamento de colunas do CSV
// ---------------------------------------------------------------------------
const COL = {
    contrato:     'Contrato',
    protheus:     'Protheus',
    cliente:      'Cliente',
    desde:        'Desde',
    dtInicio:     'Dt. Iní. Vigência',
    dtFim:        'Dt. Fim Vigência',
    vlContratado: 'Vl. Contratado (R$)',
    vlFaturado:   'Vl. Faturado (R$)',
    vlSaldo:      'Vl. Saldo (R$)',
    tipo:         'Tipo',
    situacao:     'Situação',
    vigente:      'Vigente',
    diretoria:    'Dir.',
    gerencia:     'Ger.',
    gerente:      'Gerente',
    objeto:       'Objeto',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseValor(val: string): number | null {
    const s = val?.trim();
    if (!s) return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

function parseVigente(val: string): boolean | null {
    const s = val?.trim();
    if (s === 'Vigente') return true;
    if (s === 'Vencido') return false;
    if (s) console.warn(`⚠️  Valor inesperado em "Vigente": "${s}" — armazenado como null`);
    return null;
}

// ---------------------------------------------------------------------------
// Criar tabelas se não existirem
// ---------------------------------------------------------------------------
async function createTables() {
    console.log('🗄️  Criando tabela contrato (se não existir)...');
    const ddlPath = path.resolve(__dirname, 'criar_tabelas.sql');
    const ddl = fs.readFileSync(ddlPath, 'utf8');
    const statements = ddl
        .split(';')
        .map(s => s.replace(/--[^\n]*/g, '').trim())
        .filter(s => s.length > 0);
    for (const stmt of statements) {
        await client.execute(stmt);
    }
    console.log('   ✓ Tabela pronta\n');
}

// ---------------------------------------------------------------------------
// Seed principal
// ---------------------------------------------------------------------------
async function seed() {
    const inicio = Date.now();
    console.log('🌱 Iniciando seed de contratos...\n');

    await createTables();

    // 1. Ler CSV
    const csvPath = path.resolve(process.cwd(), 'temp', 'Contratos_Ativos_Receita.csv');
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ Arquivo não encontrado: ${csvPath}`);
        process.exit(1);
    }

    const conteudo = fs.readFileSync(csvPath, 'utf8');
    const registros = parse(conteudo, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
    }) as Record<string, string>[];

    console.log(`📄 ${registros.length} contratos encontrados no CSV\n`);

    // 2. Detectar problemas de encoding no campo Tipo
    const comEncondingResidual = registros
        .filter(r => r[COL.tipo]?.includes('?'))
        .map(r => r[COL.contrato]);

    if (comEncondingResidual.length > 0) {
        console.warn(`⚠️  Encoding residual no campo "Tipo" em: ${comEncondingResidual.join(', ')}`);
        console.warn('   Dados inseridos como estão (verifique encoding do CSV)\n');
    }

    // 3. Inserir contratos
    console.log(`📋 Inserindo ${registros.length} contratos...`);
    let inseridos = 0;
    let semManager = 0;

    for (const r of registros) {
        const gerencia = r[COL.gerencia]?.trim().toUpperCase();
        const managerId = GERENCIA_PARA_MANAGER_ID[gerencia] ?? null;

        if (gerencia && !managerId) {
            console.warn(`⚠️  Código de gerência desconhecido: "${gerencia}" (contrato: ${r[COL.contrato]})`);
            semManager++;
        }

        await db
            .insert(contrato)
            .values({
                id:               randomUUID(),
                numeroContrato:   r[COL.contrato]?.trim(),
                protheus:         r[COL.protheus]?.trim() || null,
                cliente:          r[COL.cliente]?.trim(),
                desde:            r[COL.desde]?.trim() || null,
                dtInicioVigencia: r[COL.dtInicio]?.trim() || null,
                dtFimVigencia:    r[COL.dtFim]?.trim() || null,
                vlContratado:     parseValor(r[COL.vlContratado]),
                vlFaturado:       parseValor(r[COL.vlFaturado]),
                vlSaldo:          parseValor(r[COL.vlSaldo]),
                tipo:             r[COL.tipo]?.trim() || null,
                situacao:         r[COL.situacao]?.trim() || null,
                vigente:          parseVigente(r[COL.vigente]),
                diretoria:        r[COL.diretoria]?.trim() || null,
                gerencia:         gerencia || null,
                nomeGerente:      r[COL.gerente]?.trim().replace(/\s+/g, ' ') || null,
                objeto:           r[COL.objeto]?.trim() || null,
                managerId,
            })
            .onConflictDoUpdate({
                target: contrato.numeroContrato,
                set: {
                    protheus:         r[COL.protheus]?.trim() || null,
                    cliente:          r[COL.cliente]?.trim(),
                    desde:            r[COL.desde]?.trim() || null,
                    dtInicioVigencia: r[COL.dtInicio]?.trim() || null,
                    dtFimVigencia:    r[COL.dtFim]?.trim() || null,
                    vlContratado:     parseValor(r[COL.vlContratado]),
                    vlFaturado:       parseValor(r[COL.vlFaturado]),
                    vlSaldo:          parseValor(r[COL.vlSaldo]),
                    tipo:             r[COL.tipo]?.trim() || null,
                    situacao:         r[COL.situacao]?.trim() || null,
                    vigente:          parseVigente(r[COL.vigente]),
                    diretoria:        r[COL.diretoria]?.trim() || null,
                    gerencia:         gerencia || null,
                    nomeGerente:      r[COL.gerente]?.trim().replace(/\s+/g, ' ') || null,
                    objeto:           r[COL.objeto]?.trim() || null,
                    managerId,
                    updatedAt:        new Date().toISOString(),
                },
            });

        inseridos++;
        process.stdout.write(`\r   Progresso: ${inseridos}/${registros.length}`);
    }

    const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`\n\n✅ Seed concluído em ${duracao}s`);
    console.log(`   Contratos inseridos: ${inseridos}`);
    if (semManager > 0) console.log(`   Sem manager_id    : ${semManager} (código de gerência não mapeado)`);
    if (comEncondingResidual.length > 0) console.log(`   Warnings encoding : ${comEncondingResidual.length}`);
}

seed().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
