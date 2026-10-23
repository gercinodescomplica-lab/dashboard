import { describe, it, expect, beforeAll } from 'vitest';
import { applyMigrations } from '@/db/test-utils';

describe('0013_lead_grcc', () => {
    beforeAll(async () => {
        await applyMigrations();
    });

    it('cria lead_grcc, lead_grcc_historico e projects.lead_grcc_id', async () => {
        const { db } = await import('@/db/index');
        const cols = async (t: string) =>
            (await db.$client.execute(`pragma table_info(${t})`)).rows.map((r) => r.name);
        expect(await cols('lead_grcc')).toEqual(
            expect.arrayContaining(['cliente', 'categoria', 'valor', 'previsao_fechamento', 'inicio_faturamento', 'excluido_em'])
        );
        expect(await cols('lead_grcc_historico')).toEqual(
            expect.arrayContaining(['lead_id', 'quando', 'origem', 'arquivo', 'autor', 'mudancas'])
        );
        expect(await cols('projects')).toContain('lead_grcc_id');
    });

    it('semeia as categorias na dropdown_options e a versao em system_settings', async () => {
        const { db } = await import('@/db/index');
        const cats = await db.$client.execute("select value from dropdown_options where field = 'grcc_categoria' order by id");
        expect(cats.rows.map((r) => r.value)).toEqual(
            ['Novo', 'Validação', 'Parceiro', 'Em tratativas', 'No cliente', 'Contratado', 'Perda']
        );
        const v = await db.$client.execute("select value from system_settings where key = 'grcc_versao'");
        expect(v.rows[0]?.value).toBe('0');
    });
});
