// src/db/carteira-seed.ts
// Carga inicial da carteira (spec 2026-11-06 §4). Idempotente. NÃO move dado nenhum (D12).
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/index';
import { carteiraCliente, cliente, contrato, cx, managers, projects, proposta } from '@/db/schema';
import { siglaComparavel } from '@/lib/integracao/chaves';
import { casarCliente, clienteDoServedClient } from '@/lib/carteira/casar-cliente';
import { chaveDaCarteira } from '@/lib/carteira/gerencia';
import { foraDaCarteira, listarClientesComCarteira, type ForaDaCarteira } from './carteira';

export interface RelatorioCarga {
    clientesCriados: number;
    naCarteira: number;
    duplicados: Array<{ sigla: string; ficou: string; perdeu: string }>;
    ligados: Record<'contrato' | 'proposta' | 'cx' | 'projects', number>;
    criadosSemCarteira: string[];
    fora: ForaDaCarteira[];
}

const agora = () => new Date().toISOString();
const chaveDoCliente = (c: { nome: string; sigla: string | null }) => siglaComparavel(c.sigla ?? c.nome);

export async function semearCarteira(): Promise<RelatorioCarga> {
    const r: RelatorioCarga = { clientesCriados: 0, naCarteira: 0, duplicados: [], ligados: { contrato: 0, proposta: 0, cx: 0, projects: 0 }, criadosSemCarteira: [], fora: [] };
    const cards = (await db.select().from(managers)).sort((a, b) => Number(b.showInDashboard) - Number(a.showInDashboard) || b.year - a.year || a.id.localeCompare(b.id));
    const existentes = new Map((await db.select().from(cliente)).map((c) => [chaveDoCliente(c), c.id]));
    const naCarteira = new Map((await db.select().from(carteiraCliente)).map((c) => [c.clienteId, c.gerencia]));

    async function garantirCliente(nome: string, sigla: string | null): Promise<string> {
        const k = chaveDoCliente({ nome, sigla });
        const ja = existentes.get(k);
        if (ja) return ja;
        const id = crypto.randomUUID();
        await db.insert(cliente).values({ id, nome, sigla, createdAt: agora() });
        existentes.set(k, id);
        r.clientesCriados++;
        return id;
    }

    // 1. served_clients → cliente + carteira (card visível primeiro: ele ganha a duplicata).
    for (const card of cards) {
        let itens: string[] = [];
        try { itens = card.servedClients ? JSON.parse(card.servedClients) : []; } catch { itens = []; }
        const chave = chaveDaCarteira(card);
        for (const item of itens) {
            const { nome, sigla } = clienteDoServedClient(item);
            const id = await garantirCliente(nome, sigla);
            const atual = naCarteira.get(id);
            if (atual && atual !== chave) {
                if (!r.duplicados.some((d) => d.sigla === (sigla ?? nome))) r.duplicados.push({ sigla: sigla ?? nome, ficou: atual, perdeu: chave });
                continue;
            }
            if (!atual) {
                await db.insert(carteiraCliente).values({ clienteId: id, gerencia: chave, movidoEm: agora(), movidoPor: 'Carga inicial' });
                naCarteira.set(id, chave);
            }
        }
    }
    r.naCarteira = naCarteira.size;

    // 2–3. cliente_id nas linhas manuais sem cliente; o que não casa vira cliente sem carteira.
    const chaveDoCard = new Map(cards.map((c) => [c.id, chaveDaCarteira(c)]));
    async function ligar(texto: string | null, managerId: string | null): Promise<string | null> {
        if (!texto?.trim()) return null;
        const clientes = await listarClientesComCarteira();
        const achado = casarCliente(texto, clientes, managerId ? chaveDoCard.get(managerId) : null);
        if (achado) return achado;
        const t = texto.trim();
        const pareceSigla = /^\S+$/.test(t) && t === t.toUpperCase();
        const id = await garantirCliente(t, pareceSigla ? t : null);
        if (!r.criadosSemCarteira.includes(t)) r.criadosSemCarteira.push(t);
        return id;
    }

    for (const l of await db.select().from(contrato).where(isNull(contrato.clienteId))) {
        const id = await ligar(l.cliente, l.managerId);
        if (id) { await db.update(contrato).set({ clienteId: id }).where(eq(contrato.id, l.id)); r.ligados.contrato++; }
    }
    for (const l of await db.select().from(proposta).where(isNull(proposta.clienteId))) {
        const id = await ligar(l.cliente, l.managerId);
        if (id) { await db.update(proposta).set({ clienteId: id }).where(eq(proposta.id, l.id)); r.ligados.proposta++; }
    }
    for (const l of await db.select().from(cx).where(isNull(cx.clienteId))) {
        const id = await ligar(l.cliente, l.managerId);
        if (id) { await db.update(cx).set({ clienteId: id }).where(eq(cx.id, l.id)); r.ligados.cx++; }
    }
    for (const l of await db.select().from(projects).where(and(isNull(projects.clienteId), isNull(projects.leadGrccId)))) {
        const id = await ligar(l.orgao, l.managerId);
        if (id) { await db.update(projects).set({ clienteId: id }).where(eq(projects.id, l.id)); r.ligados.projects++; }
    }

    // 4. Relatório: quem já está fora da carteira (não move — D12).
    r.fora = await foraDaCarteira();
    return r;
}
