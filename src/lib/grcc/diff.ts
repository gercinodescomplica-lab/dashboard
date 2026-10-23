import { CAMPOS_LEAD, type LeadGrccDados, type Mudanca } from './tipos';

function valorDiff(v: unknown): string | number | null {
    if (v === undefined || v === null || v === '') return null;
    return typeof v === 'number' ? v : String(v);
}

/** Campos que mudaram de `antes` para `depois`. `antes = null` = cadastro (só campos preenchidos). */
export function diffLead(antes: LeadGrccDados | null, depois: LeadGrccDados): Mudanca[] {
    const mudancas: Mudanca[] = [];
    for (const campo of CAMPOS_LEAD) {
        const de = antes ? valorDiff(antes[campo]) : null;
        const para = valorDiff(depois[campo]);
        if (de !== para) mudancas.push({ campo, de, para });
    }
    return mudancas;
}
