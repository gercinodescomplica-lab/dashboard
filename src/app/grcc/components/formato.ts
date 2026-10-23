import { ROTULO_CAMPO, type CategoriaGrcc, type Mudanca } from '@/lib/grcc/tipos';
import { formatCurrency } from '@/lib/format';

export function brl(n: number): string {
    return formatCurrency(n);
}

export function dataBr(iso: string | null): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return a && m && d ? `${d}/${m}/${a}` : iso;
}

export function dataHoraBr(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function haQuanto(iso: string, agora = Date.now()): string {
    const min = Math.round((agora - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? 'ontem' : `há ${d} dias`;
}

function valorLegivel(campo: Mudanca['campo'], v: Mudanca['de']): string {
    if (v === null) return '—';
    if (campo === 'valor') return brl(Number(v));
    if (campo === 'previsaoFechamento' || campo === 'inicioFaturamento') return dataBr(String(v));
    return String(v);
}

export function rotuloMudanca(m: Mudanca): string {
    return `${ROTULO_CAMPO[m.campo]}: ${valorLegivel(m.campo, m.de)} → ${valorLegivel(m.campo, m.para)}`;
}

export function deParaMudanca(m: Mudanca): { rotulo: string; de: string; para: string } {
    return { rotulo: ROTULO_CAMPO[m.campo], de: valorLegivel(m.campo, m.de), para: valorLegivel(m.campo, m.para) };
}

/** Cor do chip de categoria (alinhada à temperatura que gera no pipeline). */
export const COR_CATEGORIA: Record<CategoriaGrcc, string> = {
    Novo: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    'Validação': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    Parceiro: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    'Em tratativas': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    'No cliente': 'bg-red-500/10 text-red-300 border-red-500/30',
    Contratado: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    Perda: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
};
