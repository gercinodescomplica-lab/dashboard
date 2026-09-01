import ExcelJS from 'exceljs';
import type { CXBoardItem, CXBucket, CXUser } from '@/db/queries';
import { isOverdueDate } from '@/lib/cx-log';

export const EXPORT_FILENAME = 'Demandas CX.xlsx';

export interface CXExportManager {
    id: string;
    name: string;
    role: string;
}

export const CONSOLIDATED_HEADERS = [
    'Identificação da tarefa',
    'Nome da tarefa',
    'Categoria',
    'Meta',
    'Status',
    'Prioridade',
    'Atribuído a',
    'Criado por',
    'Criado em',
    'Data de conclusão',
    'Data de início',
    'É Recorrente',
    'Atrasados',
    'Concluído em',
    'Concluída por',
    'Itens concluídos da lista de verificação',
    'Itens da lista de verificação',
    'Rótulos',
    'Notas',
];

// Largura de coluna por índice (0-based) na aba "Dados Consolidados" —
// ajusta pra planilha abrir legível sem o usuário ter que redimensionar.
const CONSOLIDATED_WIDTHS = [26, 46, 24, 10, 16, 14, 22, 16, 14, 16, 14, 13, 11, 14, 22, 16, 30, 26, 44];

const METAS_HEADERS = [
    'ID da Meta',
    'Nome da meta',
    'Status',
    'Prioridade',
    'Data de início',
    'Data de término',
    'Tarefas conectadas',
    'Notas',
];

const SEM_BUCKET = 'Entrada (sem bucket)';
const SEM_RESPONSAVEL = 'Sem responsável';
const SEM_PRIORIDADE = 'Sem prioridade';

// role vem como "GRC1" / "KAM3" / "GRCC" — a coluna Rótulos do Planner usa
// "GRC 1" / "KAM 3". GRCC (sem número) fica como está.
function managerTag(role: string | undefined): string {
    if (!role) return '';
    const m = role.match(/^([A-Za-z]+?)(\d+)$/);
    return m ? `${m[1].toUpperCase()} ${m[2]}` : role.toUpperCase();
}

// Só a primeira letra — preserva siglas ("DRM") e não estraga "GRC 4".
function capitalizeFirst(s: string): string {
    const t = s.trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

function dateOnly(v: string | null | undefined): string {
    return (v ?? '').slice(0, 10);
}

function simNao(v: boolean): string {
    return v ? 'Sim' : 'Não';
}

function taskName(item: CXBoardItem): string {
    const titulo = item.titulo?.trim() || (item.problema?.split(/\r?\n/)[0] ?? '').trim();
    return item.cliente?.trim() ? `${item.cliente.trim()} - ${titulo}` : titulo;
}

type RowMode = 'legivel' | 'id';

function itemRow(
    item: CXBoardItem,
    mode: RowMode,
    bucketById: Map<number, CXBucket>,
    userById: Map<number, CXUser>,
    managerById: Map<string, CXExportManager>
): (string | number)[] {
    const resolved = item.status === 'resolvido';
    const overdue = isOverdueDate(item.dataFim, item.status);
    const bucket = item.bucketId != null ? bucketById.get(item.bucketId) : undefined;
    const user = item.responsavelId != null ? userById.get(item.responsavelId) : undefined;

    // Aba "Tarefas" mantém ids/vazio pra ser reimportável; aba "Dados
    // Consolidados" (a que o usuário lê) usa texto claro no lugar de célula
    // vazia.
    const categoria =
        mode === 'id'
            ? (item.bucketId != null ? String(item.bucketId) : '')
            : (bucket?.name ?? SEM_BUCKET);
    const atribuido =
        mode === 'id'
            ? (item.responsavelId != null ? String(item.responsavelId) : '')
            : (user?.name ?? SEM_RESPONSAVEL);
    const prioridade =
        mode === 'id'
            ? (item.prioridadeTexto ?? '')
            : (item.prioridadeTexto?.trim() || SEM_PRIORIDADE);

    const tag = managerTag(managerById.get(item.managerId)?.role);
    const area = item.subtitulo?.trim() ? capitalizeFirst(item.subtitulo) : '';
    const rotulos = [tag, area].filter(Boolean).join(';');

    const recorrente = mode === 'id' ? 'false' : 'Não';
    const atrasado = mode === 'id' ? (overdue ? 'true' : 'false') : simNao(overdue);

    return [
        item.externalId || `cx-${item.id}`,
        taskName(item),
        categoria,
        '',
        resolved ? 'Concluída' : 'Em andamento',
        prioridade,
        atribuido,
        '',
        dateOnly(item.createdAt),
        dateOnly(item.dataFim),
        dateOnly(item.dataInicio),
        recorrente,
        atrasado,
        resolved ? dateOnly(item.dataFim) : '',
        resolved ? atribuido : '',
        '',
        '',
        rotulos,
        item.solucaoProposta?.trim() ?? '',
    ];
}

function styleDataSheet(sheet: ExcelJS.Worksheet, columnCount: number) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } };
}

export function buildCXPlannerWorkbook(input: {
    items: CXBoardItem[];
    buckets: CXBucket[];
    users: CXUser[];
    managers: CXExportManager[];
}): ExcelJS.Workbook {
    const { items, buckets, users, managers } = input;
    const bucketById = new Map(buckets.map((b) => [b.id, b]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const managerById = new Map(managers.map((m) => [m.id, m]));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'AIBertinho';
    wb.created = new Date();

    const plano = wb.addWorksheet('Plano');
    plano.addRow(['ID do plano', 'Nome do plano', 'Exportado em']);
    plano.addRow(['cx-planner', 'Demandas CX', new Date().toISOString().slice(0, 10)]);
    plano.getRow(1).font = { bold: true };
    plano.getColumn(1).width = 16;
    plano.getColumn(2).width = 22;
    plano.getColumn(3).width = 16;

    const consolidado = wb.addWorksheet('Dados Consolidados');
    consolidado.addRow(CONSOLIDATED_HEADERS);
    for (const item of items) {
        consolidado.addRow(itemRow(item, 'legivel', bucketById, userById, managerById));
    }
    styleDataSheet(consolidado, CONSOLIDATED_HEADERS.length);
    CONSOLIDATED_WIDTHS.forEach((w, i) => {
        consolidado.getColumn(i + 1).width = w;
    });

    const tarefas = wb.addWorksheet('Tarefas');
    tarefas.addRow(CONSOLIDATED_HEADERS);
    for (const item of items) {
        tarefas.addRow(itemRow(item, 'id', bucketById, userById, managerById));
    }
    styleDataSheet(tarefas, CONSOLIDATED_HEADERS.length);
    CONSOLIDATED_WIDTHS.forEach((w, i) => {
        tarefas.getColumn(i + 1).width = w;
    });

    const metas = wb.addWorksheet('Metas');
    metas.addRow(METAS_HEADERS);
    metas.getRow(1).font = { bold: true };

    const bucketsSheet = wb.addWorksheet('Buckets');
    bucketsSheet.addRow(['ID de Bucket', 'Nome do Bucket']);
    for (const b of buckets) bucketsSheet.addRow([String(b.id), b.name]);
    bucketsSheet.getRow(1).font = { bold: true };
    bucketsSheet.getColumn(1).width = 14;
    bucketsSheet.getColumn(2).width = 32;

    const usuarios = wb.addWorksheet('Usuários');
    usuarios.addRow(['ID do Usuário', 'Nome do usuário', 'Email']);
    for (const u of users) usuarios.addRow([String(u.id), u.name, u.email ?? '']);
    usuarios.getRow(1).font = { bold: true };
    usuarios.getColumn(1).width = 14;
    usuarios.getColumn(2).width = 28;
    usuarios.getColumn(3).width = 34;

    return wb;
}
