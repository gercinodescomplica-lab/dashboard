import { NextResponse } from 'next/server';
import { fetchAllContratos, ContratoRow } from '@/db/queries';

export const revalidate = 900; // 15 minutes

const TZ = 'America/Sao_Paulo';

function authenticate(request: Request): { ok: true } | { ok: false; response: NextResponse } {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Missing or invalid Authorization header' },
                { status: 401 }
            ),
        };
    }
    const token = authHeader.split(' ')[1];
    const apiKey = process.env.EXTERNAL_API_KEY;
    if (!apiKey || token !== apiKey) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Invalid Bearer Token' }, { status: 403 }),
        };
    }
    return { ok: true };
}

function formatBRL(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function todayInSP(): Date {
    // Returns a Date whose UTC midnight represents "today" in São Paulo
    const now = new Date();
    const spDateStr = now.toLocaleDateString('pt-BR', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    // spDateStr is "DD/MM/YYYY"
    const [d, m, y] = spDateStr.split('/');
    return new Date(`${y}-${m}-${d}T00:00:00`);
}

function diffDays(from: Date, to: Date): number {
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function contratoVencimentoFields(c: ContratoRow, today: Date) {
    return {
        numeroContrato: c.numeroContrato,
        cliente: c.cliente,
        gerencia: c.gerencia ?? null,
        nomeGerente: c.nomeGerente ?? null,
        dtFimVigencia: c.dtFimVigencia ?? null,
        diasRestantes: c.dtFimVigencia ? diffDays(today, new Date(c.dtFimVigencia + 'T00:00:00')) : null,
        vlContratado: c.vlContratado ?? 0,
        vlContratadoFormatted: formatBRL(c.vlContratado ?? 0),
        vlSaldo: c.vlSaldo ?? 0,
        vlSaldoFormatted: formatBRL(c.vlSaldo ?? 0),
        objeto: c.objeto ?? null,
    };
}

/**
 * GET /api/external/v1/contracts/analytics
 *
 * Returns a fully pre-computed analytics summary of all contracts.
 * Designed for AI assistants — no math needed on the client side.
 * Cached for 15 minutes.
 */
export async function GET(request: Request) {
    const auth = authenticate(request);
    if (!auth.ok) return auth.response;

    try {
        const contratos = await fetchAllContratos();
        const today = todayInSP();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed
        const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
        const in7Days = new Date(today); in7Days.setDate(today.getDate() + 7);
        const in90Days = new Date(today); in90Days.setDate(today.getDate() + 90);
        const in180Days = new Date(today); in180Days.setDate(today.getDate() + 180);
        const endOfYear = new Date(currentYear, 11, 31);

        // ── Visão Geral ──────────────────────────────────────────────────────────
        const vigentes = contratos.filter((c) => c.vigente);
        const vencidos = contratos.filter((c) => !c.vigente);
        const totalVlContratado = contratos.reduce((s, c) => s + (c.vlContratado ?? 0), 0);
        const totalVlFaturado = contratos.reduce((s, c) => s + (c.vlFaturado ?? 0), 0);
        const totalVlSaldo = contratos.reduce((s, c) => s + (c.vlSaldo ?? 0), 0);

        // ── Por Gerência ─────────────────────────────────────────────────────────
        const gerenciaMap = new Map<string, ContratoRow[]>();
        for (const c of contratos) {
            const key = c.gerencia ?? 'SEM GERÊNCIA';
            if (!gerenciaMap.has(key)) gerenciaMap.set(key, []);
            gerenciaMap.get(key)!.push(c);
        }
        const porGerencia = [...gerenciaMap.entries()]
            .map(([gerencia, cs]) => ({
                gerencia,
                totalContratos: cs.length,
                vigentes: cs.filter((c) => c.vigente).length,
                vencidos: cs.filter((c) => !c.vigente).length,
                vlContratadoTotal: cs.reduce((s, c) => s + (c.vlContratado ?? 0), 0),
                vlContratadoTotalFormatted: formatBRL(cs.reduce((s, c) => s + (c.vlContratado ?? 0), 0)),
                vlSaldoTotal: cs.reduce((s, c) => s + (c.vlSaldo ?? 0), 0),
                vlSaldoTotalFormatted: formatBRL(cs.reduce((s, c) => s + (c.vlSaldo ?? 0), 0)),
            }))
            .sort((a, b) => b.totalContratos - a.totalContratos);

        // ── Por Tipo ─────────────────────────────────────────────────────────────
        const tipoMap = new Map<string, ContratoRow[]>();
        for (const c of contratos) {
            const key = c.tipo?.toUpperCase() ?? 'NÃO INFORMADO';
            if (!tipoMap.has(key)) tipoMap.set(key, []);
            tipoMap.get(key)!.push(c);
        }
        const porTipo = [...tipoMap.entries()].map(([tipo, cs]) => ({
            tipo,
            total: cs.length,
            vlContratadoTotal: cs.reduce((s, c) => s + (c.vlContratado ?? 0), 0),
            vlContratadoTotalFormatted: formatBRL(cs.reduce((s, c) => s + (c.vlContratado ?? 0), 0)),
        }));

        // ── Vencimentos ──────────────────────────────────────────────────────────
        const vigenteComData = vigentes.filter((c) => c.dtFimVigencia);

        function inRange(c: ContratoRow, from: Date, to: Date): boolean {
            if (!c.dtFimVigencia) return false;
            const d = new Date(c.dtFimVigencia + 'T00:00:00');
            return d >= from && d <= to;
        }

        function isToday(c: ContratoRow): boolean {
            if (!c.dtFimVigencia) return false;
            const d = new Date(c.dtFimVigencia + 'T00:00:00');
            return d.getTime() === today.getTime();
        }

        function isSameMonthYear(c: ContratoRow, year: number, month: number): boolean {
            if (!c.dtFimVigencia) return false;
            const d = new Date(c.dtFimVigencia + 'T00:00:00');
            return d.getFullYear() === year && d.getMonth() === month;
        }

        const sortByDtFim = (a: ContratoRow, b: ContratoRow) =>
            (a.dtFimVigencia ?? '').localeCompare(b.dtFimVigencia ?? '');

        const vencendoHoje = vigenteComData
            .filter(isToday)
            .sort(sortByDtFim)
            .map((c) => contratoVencimentoFields(c, today));

        const vencendoEm7Dias = vigenteComData
            .filter((c) => inRange(c, today, in7Days))
            .sort(sortByDtFim)
            .map((c) => contratoVencimentoFields(c, today));

        const vencendoEsteMes = vigenteComData
            .filter((c) => isSameMonthYear(c, currentYear, currentMonth))
            .sort(sortByDtFim)
            .map((c) => contratoVencimentoFields(c, today));

        const vencendoProximoMes = vigenteComData
            .filter((c) => isSameMonthYear(c, nextMonthDate.getFullYear(), nextMonthDate.getMonth()))
            .sort(sortByDtFim)
            .map((c) => contratoVencimentoFields(c, today));

        const vencendoEm90Dias = vigenteComData
            .filter((c) => inRange(c, today, in90Days))
            .sort(sortByDtFim)
            .map((c) => contratoVencimentoFields(c, today));

        const vencendoEm180Dias = vigenteComData
            .filter((c) => inRange(c, today, in180Days))
            .sort(sortByDtFim)
            .map((c) => contratoVencimentoFields(c, today));

        const vencendoEsteAno = vigenteComData
            .filter((c) => inRange(c, today, endOfYear))
            .sort(sortByDtFim)
            .map((c) => contratoVencimentoFields(c, today));

        const vencidosAtualmente = vencidos
            .filter((c) => c.dtFimVigencia)
            .sort(sortByDtFim)
            .map((c) => contratoVencimentoFields(c, today));

        const vlTotalVencendoEm90Dias = vencendoEm90Dias.reduce((s, c) => s + c.vlContratado, 0);

        // ── Destaques ────────────────────────────────────────────────────────────
        const vigentesSorted = [...vigenteComData].sort(sortByDtFim);
        const proximoAVencer = vigentesSorted[0]
            ? contratoVencimentoFields(vigentesSorted[0], today)
            : null;

        const maiorValorContratado = contratos.reduce<ContratoRow | null>(
            (best, c) => (!best || (c.vlContratado ?? 0) > (best.vlContratado ?? 0) ? c : best),
            null
        );

        const menorValorContratado = contratos
            .filter((c) => (c.vlContratado ?? 0) > 0)
            .reduce<ContratoRow | null>(
                (best, c) => (!best || (c.vlContratado ?? 0) < (best.vlContratado ?? 0) ? c : best),
                null
            );

        const maiorSaldoAReceber = contratos.reduce<ContratoRow | null>(
            (best, c) => (!best || (c.vlSaldo ?? 0) > (best.vlSaldo ?? 0) ? c : best),
            null
        );

        const clienteMap = new Map<string, number>();
        for (const c of contratos) {
            const key = c.cliente;
            clienteMap.set(key, (clienteMap.get(key) ?? 0) + 1);
        }
        const clientesComMaisContratos = [...clienteMap.entries()]
            .map(([cliente, totalContratos]) => ({ cliente, totalContratos }))
            .sort((a, b) => b.totalContratos - a.totalContratos)
            .slice(0, 10);

        // ── Timestamp formatado ──────────────────────────────────────────────────
        const now = new Date();
        const geradoEm = now.toLocaleString('pt-BR', {
            timeZone: TZ,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).replace(',', ' às');

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            geradoEm,

            visaoGeral: {
                total: contratos.length,
                vigentes: vigentes.length,
                vencidos: vencidos.length,
                totalVlContratado,
                totalVlFaturado,
                totalVlSaldo,
                totalVlContratadoFormatted: formatBRL(totalVlContratado),
                totalVlFaturadoFormatted: formatBRL(totalVlFaturado),
                totalVlSaldoFormatted: formatBRL(totalVlSaldo),
            },

            porGerencia,
            porTipo,

            vencimentos: {
                vencidosAtualmente,
                vencendoHoje,
                vencendoEm7Dias,
                vencendoEsteMes,
                vencendoProximoMes,
                vencendoEm90Dias,
                vencendoEm180Dias,
                vencendoEsteAno,
                totalVencendoEm90Dias: vencendoEm90Dias.length,
                vlTotalVencendoEm90Dias,
                vlTotalVencendoEm90DiasFormatted: formatBRL(vlTotalVencendoEm90Dias),
            },

            destaques: {
                proximoAVencer,
                maiorValorContratado: maiorValorContratado
                    ? {
                          numeroContrato: maiorValorContratado.numeroContrato,
                          cliente: maiorValorContratado.cliente,
                          gerencia: maiorValorContratado.gerencia ?? null,
                          nomeGerente: maiorValorContratado.nomeGerente ?? null,
                          vlContratado: maiorValorContratado.vlContratado ?? 0,
                          vlContratadoFormatted: formatBRL(maiorValorContratado.vlContratado ?? 0),
                          objeto: maiorValorContratado.objeto ?? null,
                      }
                    : null,
                menorValorContratado: menorValorContratado
                    ? {
                          numeroContrato: menorValorContratado.numeroContrato,
                          cliente: menorValorContratado.cliente,
                          gerencia: menorValorContratado.gerencia ?? null,
                          nomeGerente: menorValorContratado.nomeGerente ?? null,
                          vlContratado: menorValorContratado.vlContratado ?? 0,
                          vlContratadoFormatted: formatBRL(menorValorContratado.vlContratado ?? 0),
                          objeto: menorValorContratado.objeto ?? null,
                      }
                    : null,
                maiorSaldoAReceber: maiorSaldoAReceber
                    ? {
                          numeroContrato: maiorSaldoAReceber.numeroContrato,
                          cliente: maiorSaldoAReceber.cliente,
                          gerencia: maiorSaldoAReceber.gerencia ?? null,
                          nomeGerente: maiorSaldoAReceber.nomeGerente ?? null,
                          vlSaldo: maiorSaldoAReceber.vlSaldo ?? 0,
                          vlSaldoFormatted: formatBRL(maiorSaldoAReceber.vlSaldo ?? 0),
                          objeto: maiorSaldoAReceber.objeto ?? null,
                      }
                    : null,
                clientesComMaisContratos,
            },
        });
    } catch (error: any) {
        console.error('[API /contracts/analytics] Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', message: error.message },
            { status: 500 }
        );
    }
}
