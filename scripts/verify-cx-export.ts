// Faz as vezes de teste (não há test runner). Roda: npx tsx scripts/verify-cx-export.ts
import { buildCXPlannerWorkbook, CONSOLIDATED_HEADERS } from '../src/lib/cx-planner-export';
import type { CXBoardItem, CXBucket, CXUser } from '../src/db/queries';

function assert(cond: unknown, msg: string) {
    if (!cond) {
        console.error(`✗ ${msg}`);
        process.exit(1);
    }
    console.log(`✓ ${msg}`);
}

const buckets: CXBucket[] = [
    { id: 1, name: 'CX - Em Análise', position: 0 },
    { id: 2, name: 'Concluído', position: 1 },
];
const users: CXUser[] = [{ id: 10, name: 'Maria Jose da Silva', email: 'mariajsilva@prodam.sp.gov.br' }];
const managers = [{ id: 'kam3-andrea', name: 'Andrea', role: 'KAM3' }];

const items = [
    {
        id: 100,
        managerId: 'kam3-andrea',
        managerName: 'Andrea',
        cliente: 'SEGES',
        titulo: 'Wi-Fi Intermitente',
        problema: '01/08/2026 - relato inicial',
        solucaoProposta: 'Encaminhado à rede',
        status: 'analise',
        criticidade: 'media',
        isVisible: true,
        createdAt: '2026-08-01T00:00:00.000Z',
        externalId: null,
        manualEditAt: null,
        dataInicio: '2026-08-01',
        dataFim: '2026-08-10',
        percentComplete: 50,
        prioridadeTexto: 'Importante',
        bucketId: 1,
        responsavelId: 10,
        responsavelName: 'Maria Jose da Silva',
        subtitulo: 'Infraestrutura',
    },
    {
        id: 101,
        managerId: 'kam3-andrea',
        managerName: 'Andrea',
        cliente: 'SME',
        titulo: 'Erro SIGPEC',
        problema: 'texto',
        solucaoProposta: '',
        status: 'resolvido',
        criticidade: 'baixa',
        isVisible: true,
        createdAt: '2026-07-01T00:00:00.000Z',
        externalId: 'abc-123',
        manualEditAt: null,
        dataInicio: '2026-07-01',
        dataFim: '2026-07-20',
        percentComplete: 100,
        prioridadeTexto: 'Média',
        bucketId: null,
        responsavelId: null,
        responsavelName: null,
        subtitulo: null,
    },
] as unknown as CXBoardItem[];

const wb = buildCXPlannerWorkbook({ items, buckets, users, managers });

const names = wb.worksheets.map((w) => w.name);
assert(
    JSON.stringify(names) ===
        JSON.stringify(['Plano', 'Dados Consolidados', 'Tarefas', 'Metas', 'Buckets', 'Usuários']),
    `6 abas na ordem certa (got ${names.join(', ')})`
);

const cons = wb.getWorksheet('Dados Consolidados')!;
const header = (cons.getRow(1).values as unknown[]).slice(1);
assert(JSON.stringify(header) === JSON.stringify(CONSOLIDATED_HEADERS), '19 colunas no cabeçalho de Dados Consolidados');
assert(cons.rowCount === 3, `Dados Consolidados: 1 header + 2 itens (got ${cons.rowCount})`);

const row2 = (cons.getRow(2).values as unknown[]).slice(1);
assert(row2[0] === 'cx-100', 'item sem externalId => "cx-100"');
assert(row2[1] === 'SEGES - Wi-Fi Intermitente', 'Nome da tarefa = "cliente - titulo"');
assert(row2[2] === 'CX - Em Análise', 'Categoria (legível) = nome do bucket');
assert(row2[4] === 'Em andamento', 'Status textual "Em andamento" p/ não-resolvido');
assert(row2[6] === 'Maria Jose da Silva', 'Atribuído a (legível) = nome do responsável');
assert(row2[17] === 'KAM 3;Infraestrutura', 'Rótulos = "TAG;area"');
assert(row2[18] === 'Encaminhado à rede', 'Notas = solução proposta');

const row3 = (cons.getRow(3).values as unknown[]).slice(1);
assert(row3[0] === 'abc-123', 'item com externalId usa o externalId');
assert(row3[2] === '', 'Categoria vazia quando bucketId = null');
assert(row3[4] === 'Concluída', 'Status textual "Concluída" p/ resolvido');
assert(row3[13] === '2026-07-20', 'Concluído em = data fim p/ resolvido');
assert(row3[17] === 'KAM 3', 'Rótulos só com a tag quando não há subtítulo');

const tarefas = wb.getWorksheet('Tarefas')!;
const trow2 = (tarefas.getRow(2).values as unknown[]).slice(1);
assert(trow2[2] === '1', 'Tarefas: Categoria = id do bucket');
assert(trow2[6] === '10', 'Tarefas: Atribuído a = id do usuário');

const bk = wb.getWorksheet('Buckets')!;
assert(bk.rowCount === 3, 'Buckets: header + 2 linhas');
const us = wb.getWorksheet('Usuários')!;
assert(us.rowCount === 2, 'Usuários: header + 1 linha');
const metas = wb.getWorksheet('Metas')!;
assert(metas.rowCount === 1, 'Metas: só o cabeçalho');

console.log('\n✓ todos os asserts passaram');
