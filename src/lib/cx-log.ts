// Parsing compartilhado do log de atualizações que fica no campo `problema`
// da tabela `cx` — entradas datadas separadas por quebra de linha (ex: vindas
// do histórico de sincronização do Planner, ver src/lib/planner-sync.ts).
//
// Extraído do parsing que já existe em CXTab.tsx (a aba de CX que o gerente
// vê) para o board /settings/cx-planner também conseguir exibir o mesmo
// histórico de forma fiel — CXTab.tsx continua com sua própria cópia
// intocada (não é este arquivo que ele usa), então nada muda pra tela final
// dos gerentes.
//
// Formatos de data que o export do Planner mistura: "27/07/2026 - texto",
// "05.08.26 12:33 texto", "04/08/2026 14:47h - texto".
const LOG_DATE_RE = /^(\d{1,2}[./]\d{1,2}[./]\d{2,4}(?:\s+\d{1,2}[:h]\d{2}h?)?)\s*-?\s*(.*)$/;

export type CXLogEntry = { date: string | null; text: string };

export function parseCXLogEntries(raw: string): CXLogEntry[] {
    return raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
            const m = line.match(LOG_DATE_RE);
            return m ? { date: m[1], text: m[2] } : { date: null, text: line };
        });
}

// Formata uma data "YYYY-MM-DD" (ou o prefixo de um ISO datetime) pra
// "DD/MM/AA" — mais compacto e no padrão pt-BR usado no resto do log, em vez
// do formato ISO cru.
export function formatDateOnlyBR(v: string | null | undefined): string | null {
    if (!v) return null;
    const dateOnly = v.slice(0, 10);
    const m = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const [, yyyy, mm, dd] = m;
    return `${dd}/${mm}/${yyyy.slice(2)}`;
}
