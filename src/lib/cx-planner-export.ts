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

// role vem como "GRC1" / "KAM3" / "GRCC" — a coluna Rótulos do Planner usa
// "GRC 1" / "KAM 3". GRCC (sem número) fica como está.
function managerTag(role: string | undefined): string {
    if (!role) return '';
    const m = role.match(/^([A-Za-z]+?)(\d+)$/);
    return m ? `${m[1].toUpperCase()} ${m[2]}` : role.toUpperCase();
}

function dateOnly(v: string | null | undefined): string {
    return (v ?? '').slice(0, 10);
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
    const categoria = mode === 'id' ? (item.bucketId != null ? String(item.bucketId) : '') : (bucket?.name ?? '');
    const atribuido = mode === 'id' ? (item.responsavelId != null ? String(item.responsavelId) : '') : (user?.name ?? '');
    const rotuloArea = item.subtitulo?.trim() ?? '';
    const tag = managerTag(managerById.get(item.managerId)?.role);
    const rotulos = [tag, rotuloArea].filter(Boolean).join(';');

    return [
        item.externalId || `cx-${item.id}`,
        taskName(item),
        categoria,
        '',
        resolved ? 'Concluída' : 'Em andamento',
        item.prioridadeTexto ?? '',
        atribuido,
        '',
        dateOnly(item.createdAt),
        dateOnly(item.dataFim),
        dateOnly(item.dataInicio),
        'false',
        overdue ? 'true' : 'false',
        resolved ? dateOnly(item.dataFim) : '',
        resolved ? atribuido : '',
        '',
        '',
        rotulos,
        item.solucaoProposta ?? '',
    ];
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
    plano.addRow(['ID do plano', 'Nome do plano', '']);
    plano.addRow(['cx-planner', 'Demandas CX', new Date().toISOString().slice(0, 10)]);

    const consolidado = wb.addWorksheet('Dados Consolidados');
    consolidado.addRow(CONSOLIDATED_HEADERS);
    for (const item of items) {
        consolidado.addRow(itemRow(item, 'legivel', bucketById, userById, managerById));
    }

    const tarefas = wb.addWorksheet('Tarefas');
    tarefas.addRow(CONSOLIDATED_HEADERS);
    for (const item of items) {
        tarefas.addRow(itemRow(item, 'id', bucketById, userById, managerById));
    }

    const metas = wb.addWorksheet('Metas');
    metas.addRow(METAS_HEADERS);

    const bucketsSheet = wb.addWorksheet('Buckets');
    bucketsSheet.addRow(['ID de Bucket', 'Nome do Bucket']);
    for (const b of buckets) bucketsSheet.addRow([String(b.id), b.name]);

    const usuarios = wb.addWorksheet('Usuários');
    usuarios.addRow(['ID do Usuário', 'Nome do usuário', 'Email']);
    for (const u of users) usuarios.addRow([String(u.id), u.name, u.email ?? '']);

    return wb;
}
