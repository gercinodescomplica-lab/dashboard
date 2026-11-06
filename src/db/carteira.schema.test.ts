import { describe, it, expect, beforeAll } from 'vitest';
import { applyMigrations } from '@/db/test-utils';
import { db } from '@/db/index';

beforeAll(applyMigrations);

const colunas = async (t: string) => (await db.$client.execute(`pragma table_info(${t})`)).rows.map((r) => String(r.name));

describe('migração 0017_carteira_clientes', () => {
    it('cria cliente, carteira_cliente e movimento_carteira', async () => {
        expect(await colunas('cliente')).toEqual(['id', 'nome', 'sigla', 'ativo', 'created_at']);
        expect(await colunas('carteira_cliente')).toEqual(['cliente_id', 'gerencia', 'movido_em', 'movido_por']);
        expect(await colunas('movimento_carteira')).toEqual(['id', 'cliente_id', 'de_gerencia', 'para_gerencia', 'por', 'em']);
    });
    it.each(['contrato', 'proposta', 'cx', 'projects'])('%s ganha cliente_id', async (t) => {
        expect(await colunas(t)).toContain('cliente_id');
    });
});
