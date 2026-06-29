import 'dotenv/config';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) throw new Error('TURSO_DATABASE_URL missing');

const client = createClient({ url, authToken });
const now = new Date().toISOString();

type Upd = { numero: string; status: string; observacao: string };
const cohabUpdates: Upd[] = [
    { numero: 'Q-00853', status: 'Previsto Jul/2026', observacao: 'Sustentação e Melhorias de TIC – COHAB (ajuste de itens para faturamento).' },
    { numero: 'Q-00802', status: 'Previsto Ago/2026', observacao: 'COHAB – Sustentação e Melhorias de TIC.' },
];

type NewRow = {
    id: string;
    numeroProposta: string;
    nomeOportunidade: string;
    cliente: string;
    gerencia: string;
    managerId: string;
    status: string;
    observacao: string;
};

const newRows: NewRow[] = [
    {
        id: 'md-tcm-pgm',
        numeroProposta: 'MD-TCM-PGM',
        nomeOportunidade: 'Aditivo TCM (retirada de vínculo com PGM)',
        cliente: 'Tribunal de Contas do Município de São Paulo',
        gerencia: 'GRC-4',
        managerId: 'grc4-beatriz',
        status: 'Pendente',
        observacao: 'Em análise — aguardando definições com PGM; ainda não enviada ao cliente.',
    },
    {
        id: 'md-saas-smart-siga',
        numeroProposta: 'MD-SAAS-SIGA',
        nomeOportunidade: 'SaaS Smart Siga Saúde',
        cliente: 'Secretaria Municipal da Saúde',
        gerencia: 'KAM-2',
        managerId: 'kam2-betone',
        status: 'Pendente',
        observacao: 'Em análise — previsto Ago/2026, depende de Marketplace Google/AWS.',
    },
    {
        id: 'md-lgpd-betone',
        numeroProposta: 'MD-LGPD',
        nomeOportunidade: 'LGPD',
        cliente: 'A definir',
        gerencia: 'KAM-2',
        managerId: 'kam2-betone',
        status: 'Pendente',
        observacao: 'Em análise — previsto Ago/2026, depende de Marketplace Google/AWS.',
    },
    {
        id: 'md-link-malde',
        numeroProposta: 'MD-LINK-SME',
        nomeOportunidade: 'Link',
        cliente: 'Secretaria Municipal de Educação',
        gerencia: 'KAM-1',
        managerId: 'kam1-malde',
        status: 'Pendente',
        observacao: 'Em análise — sem previsão.',
    },
];

async function main() {
    for (const u of cohabUpdates) {
        const r = await client.execute({
            sql: `UPDATE proposta SET status = ?, observacao = ?, updated_at = ? WHERE numero_proposta = ?`,
            args: [u.status, u.observacao, now, u.numero],
        });
        console.log(r.rowsAffected ? `✓ updated ${u.numero}` : `✗ not found ${u.numero}`);
    }

    for (const n of newRows) {
        try {
            await client.execute({
                sql: `INSERT INTO proposta (id, numero_proposta, nome_oportunidade, cliente, gerencia, manager_id, status, observacao, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [n.id, n.numeroProposta, n.nomeOportunidade, n.cliente, n.gerencia, n.managerId, n.status, n.observacao, now, now],
            });
            console.log(`✓ inserted ${n.numeroProposta} — ${n.nomeOportunidade}`);
        } catch (err: any) {
            const msg = String(err?.message ?? err);
            if (/UNIQUE|already exists/i.test(msg)) {
                await client.execute({
                    sql: `UPDATE proposta SET status = ?, observacao = ?, updated_at = ? WHERE numero_proposta = ?`,
                    args: [n.status, n.observacao, now, n.numeroProposta],
                });
                console.log(`✓ updated (already existed) ${n.numeroProposta}`);
            } else {
                throw err;
            }
        }
    }
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
