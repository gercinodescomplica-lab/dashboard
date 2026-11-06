// src/db/carteira.leitura.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';
import { cenario } from './carteira.test-dados';
import { carregarOrganogramaClientes, clientesAtendidosPorGerencia, gerenciaPelaCarteira, managerDaLinha } from './carteira';

beforeAll(applyMigrations);
beforeEach(() => cenario(db));

describe('leitura da carteira', () => {
    it('clientesAtendidosPorGerencia: "SIGLA (Nome)" por chave, sem oculto', async () => {
        const m = await clientesAtendidosPorGerencia();
        expect(m.get('GRC3')).toEqual(['SMT (Secretaria Municipal de Transportes)']);
        expect(m.get('KAM1')).toEqual(['SME (Secretaria Municipal da Educação)']);
        expect(m.get('GRC1')).toBeUndefined();
    });

    it('gerenciaPelaCarteira: card do maior ano, texto GRC-n e nome do gerente', async () => {
        await db.$client.execute("update carteira_cliente set gerencia = 'GRC4' where cliente_id = 'c-smt'");
        expect(await gerenciaPelaCarteira('c-smt')).toEqual({ chave: 'GRC4', managerId: 'grc4-beatriz', gerencia: 'GRC-4', nomeGerente: 'Beatriz' });
        expect(await gerenciaPelaCarteira('c-smc')).toBeNull();
        expect(await gerenciaPelaCarteira(null)).toBeNull();
    });

    it('managerDaLinha: troca só quando a carteira é de outra gerência', async () => {
        expect(await managerDaLinha('c-smt', 'grc1-bruno')).toBe('grc3-barone');
        expect(await managerDaLinha('c-smt', 'grc3-barone')).toBe('grc3-barone');
        expect(await managerDaLinha('c-smc', 'grc1-bruno')).toBe('grc1-bruno');
        expect(await managerDaLinha(null, 'grc1-bruno')).toBe('grc1-bruno');
    });

    it('carregarOrganogramaClientes: cartões por chave, gerente = nome do card, oculto fora, sem carteira ativos', async () => {
        const o = await carregarOrganogramaClientes();
        const grc3 = o.cartoes.find((c) => c.id === 'GRC3')!;
        expect(grc3).toMatchObject({ nome: 'GRC3', sigla: 'GRC3', ativa: true, gerentes: ['Barone'] });
        expect(grc3.clientes.map((c) => c.id)).toEqual(['c-smt']);
        expect(o.cartoes.find((c) => c.id === 'GRC4')!.gerentes).toEqual(['Beatriz']);
        expect(o.cartoes.map((c) => c.id)).not.toContain('KAM10'); // oculta e vazia
        expect(o.semCarteira.map((c) => c.id)).toEqual(['c-smc']);
        expect(o.totais.orgaosAtendidos).toBe(2);
    });
});
