import 'dotenv/config';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) throw new Error('TURSO_DATABASE_URL missing');

const client = createClient({ url, authToken });

type Upd = { numero: string; status: string; observacao: string };

const updates: Upd[] = [
    { numero: 'Q-00749', status: 'Assinado', observacao: 'Aditivo ao Contrato 333/SMDHC/2023 — assinado.' },
    { numero: 'Q-00787', status: 'Adiado', observacao: 'Novo contrato para SMT — adiado para 2027.' },
    { numero: 'Q-00794', status: 'Adiado', observacao: 'Sustentação e Melhorias de TIC – CET — adiado para 2027.' },
    { numero: 'Q-00807', status: 'Assinado', observacao: 'Prorrogação Plataforma de Colaboração e Produtividade SMDHC — assinado.' },
    { numero: 'Q-00832', status: 'Assinado', observacao: 'Prorrogação Contrato 016/SP-URB/2024 – Sustentação TIC SPUrbanismo — assinado.' },
    { numero: 'Q-00833', status: 'Previsto Jul/2026', observacao: 'Readequação de horas fases I e II – COMPREV.' },
    { numero: 'Q-00835', status: 'Previsto Jul/2026', observacao: 'Aditivo Contrato 017/2021-SMT – Sustentação e Melhorias TIC.' },
    { numero: 'Q-00849', status: 'Previsto Jul/2026', observacao: 'Plataforma de Colaboração e Produtividade SPTrans.' },
    { numero: 'Q-00848', status: 'Aguardando', observacao: 'Prorrogação TC 042/2024 – SF: aguardando Tomiatto (inclusão de serviços).' },
    { numero: 'Q-00828', status: 'Previsto Jul/2026', observacao: 'Sustentação (contrato) — Malde.' },
    { numero: 'Q-00819', status: 'Previsto Ago/2026', observacao: 'Backup — Malde (Ago/2026, talvez).' },
    { numero: 'Q-00680', status: 'Previsto Out/2026', observacao: 'Wi-Fi — Malde.' },
];

async function main() {
    const updated: string[] = [];
    const notFound: string[] = [];
    for (const u of updates) {
        const res = await client.execute({
            sql: `UPDATE proposta SET status = ?, observacao = ?, updated_at = ? WHERE numero_proposta = ?`,
            args: [u.status, u.observacao, new Date().toISOString(), u.numero],
        });
        if (res.rowsAffected > 0) {
            updated.push(`${u.numero} → ${u.status}`);
        } else {
            notFound.push(u.numero);
        }
    }
    console.log('Updated:');
    updated.forEach(s => console.log('  ✓', s));
    if (notFound.length) {
        console.log('\nNot found in DB:');
        notFound.forEach(s => console.log('  ✗', s));
    }
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
