/**
 * Aplica no pipeline (projects) e nas propostas o que mudou na planilha
 * "perdidos-parados-drm (2).xlsx" (19/11/2026) em relação à versão de 18/11.
 * Os itens de "Levantamento 10/09" não ficam no banco: foram editados em
 * src/data/oportunidades-consolidado.json.
 *
 * Casa projeto por gerente + órgão + nome (ids diferem entre dev e prod). Achou → atualiza só o que
 * mudou e registra no histórico do projeto; não achou → cria. Rodar de novo não duplica nada.
 * Sem valor na planilha → valor 0 e descrição começando com "Em análise" / "Em tratativas".
 *
 * Uso (simulação por padrão; --aplicar grava):
 *   npx tsx scripts/perdidos-parados/aplicar-planilha-2026-11-19.ts            # dev (.env.development)
 *   npx tsx scripts/perdidos-parados/aplicar-planilha-2026-11-19.ts --aplicar
 *   prod: set -a && . /fora/do/repo/envs/.env && set +a && NODE_ENV=production npx tsx <este arquivo> [--aplicar]
 */
import { config as loadEnv } from 'dotenv';
import { createClient, type InStatement } from '@libsql/client';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

loadEnv({ path: '.env' });
const nodeEnv = process.env.NODE_ENV ?? 'development';
if (nodeEnv !== 'production' && existsSync('.env.development')) loadEnv({ path: '.env.development', override: true });
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error('TURSO_DATABASE_URL missing');
const APLICAR = process.argv.includes('--aplicar');

type Temp = 'quente' | 'morno' | 'frio' | 'contratado' | 'historico' | 'perdido';
type Quarter = 'q1' | 'q2' | 'q3' | 'q4' | 'nao_mapeado';
interface Linha {
    gerente: string;
    orgao: string;
    nome: string;          // nome final (o da planilha)
    nomeAtual?: string;    // nome hoje no banco, quando difere
    valor?: number;        // ausente = não mexe (em projeto existente) / 0 (em projeto novo)
    temperatura?: Temp;    // ausente = não mexe / 'morno' em projeto novo
    quarter?: Quarter;     // ausente = não mexe / 'q4' em projeto novo
    descricao: string;
}

const LINHAS: Linha[] = [
    // GRC2 — Paulo Rogério
    { gerente: 'grc2-paulo', orgao: 'SEHAB', nome: 'Adit. Contrato Sustentação', descricao: 'Aguardando cliente: secretaria alega falta de recursos' },
    { gerente: 'grc2-paulo', orgao: 'SMUL', nome: 'Virtualização SMUL', temperatura: 'perdido', descricao: 'Secretaria declinou após testes, considerou que a solução não atendia as necessidades' },
    { gerente: 'grc2-paulo', orgao: 'SMADS', nome: 'Virtualização SMADS', descricao: 'Aguardando cliente: solução em fase de teste pela secretaria' },
    { gerente: 'grc2-paulo', orgao: 'SMDET', nome: 'Nuvem Azure', valor: 6000000, temperatura: 'contratado', quarter: 'q4', descricao: 'Contrato ganho (assinado)' },
    { gerente: 'grc2-paulo', orgao: 'SMUL', nome: 'Aditivo contrato WFS', nomeAtual: 'WFS', valor: 682000, temperatura: 'frio', descricao: 'Adiado para 2027: foi para 02/2027 sem recursos' },
    { gerente: 'grc2-paulo', orgao: 'SMUL', nome: 'Aditivo contrato Infre', valor: 694369, temperatura: 'quente', quarter: 'q4', descricao: 'Contrato enviado, aguardando assinatura' },
    // GRC3 — Barone
    { gerente: 'grc3-barone', orgao: 'CET', nome: 'NOVO CONTRATO 36 MÊSES', descricao: 'Adiado para 2027' },
    { gerente: 'grc3-barone', orgao: 'SPTRANS', nome: 'DataLake', descricao: 'Adiado para 2027' },
    { gerente: 'grc3-barone', orgao: 'SPTRANS', nome: 'Licenças Microsoft', temperatura: 'perdido', descricao: 'A renovação foi realizada diretamente com o Google, uma vez que o acordo com a PRODAM-SP não foi concretizado e o cliente optou por não adotar a solução da Microsoft.' },
    { gerente: 'grc3-barone', orgao: 'COHAB', nome: 'Soluções Microsoft', valor: 2500000, temperatura: 'contratado', descricao: 'Assinado' },
    // GRC4 — Beatriz
    { gerente: 'grc4-beatriz', orgao: 'HSPM', nome: '+Saúde', valor: 14185759, quarter: 'q4', descricao: 'Contrato enviado: trâmites internos de assinatura' },
    { gerente: 'grc4-beatriz', orgao: 'SPTURIS', nome: 'Gestão de eventos horas', temperatura: 'perdido', descricao: 'Adiada 2027: a Secretaria apresentou questionamentos quanto ao valor proposto. Estamos conduzindo tratativas para reverter o cenário; entretanto, até o momento, não há perspectiva concreta de continuidade da negociação.' },
    { gerente: 'grc4-beatriz', orgao: 'SPTURIS', nome: 'Suporte Licenças  Microsoft', temperatura: 'perdido', descricao: 'Adiada 2027: a Secretaria apresentou questionamentos quanto ao valor proposto. Estamos conduzindo tratativas para reverter o cenário; entretanto, até o momento, não há perspectiva concreta de continuidade da negociação.' },
    { gerente: 'grc4-beatriz', orgao: 'SPTURIS', nome: 'Gestão de eventos arquitetura', temperatura: 'perdido', descricao: 'Adiada 2027: a Secretaria apresentou questionamentos quanto ao valor proposto. Estamos conduzindo tratativas para reverter o cenário; entretanto, até o momento, não há perspectiva concreta de continuidade da negociação.' },
    { gerente: 'grc4-beatriz', orgao: 'HSPM', nome: 'Central de Atendimento', descricao: 'Proposta enviada: há questionamentos jurídicos que estão sendo alinhados' },
    { gerente: 'grc4-beatriz', orgao: 'HSPM', nome: 'Reconhece AI', descricao: 'Aguardando envio do termo do contrato por parte da secretaria' },
    { gerente: 'grc4-beatriz', orgao: 'SP Regula', nome: 'Copilot', temperatura: 'perdido', descricao: 'Adiado para 2027' },
    { gerente: 'grc4-beatriz', orgao: 'CGM', nome: 'FFI', descricao: 'Em análise — aguardando precificação do sistema de FFI (DDS) para a CGM' },
    { gerente: 'grc4-beatriz', orgao: 'SVMA', nome: 'Desenvolvimento e suporte sistemas TC62', valor: 4746600, descricao: 'Proposta enviada. Vencimento do contrato atual em 01/dez/2026, valor R$ 4.354.000' },
    { gerente: 'grc4-beatriz', orgao: 'SPCINE', nome: 'SDWAN, Voip', valor: 60941.28, descricao: 'Proposta enviada. Esta versão da proposta amplia a versão anterior só do SDWAN. Também está sendo avaliado ampliar para 36 meses' },
    { gerente: 'grc4-beatriz', orgao: 'SPCINE', nome: 'SDWAN, Voip, wi-fi, 2 links 500, suporte', valor: 347450.56, descricao: 'Proposta enviada. No aguardo do recebimento da minuta para tramitar assinatura. Nova solução de link, buscando ser fornecedor exclusivo ao cliente. Contrato anterior de MPLS, no valor de R$ 21.615,72' },
    { gerente: 'grc4-beatriz', orgao: 'CMSP', nome: 'VPN', valor: 66412.68, descricao: 'Proposta enviada. No aguardo do recebimento da minuta para tramitar assinatura. VPN como caminho para redundância de link. No contrato atual TC06/2025, MPLS possui valor de R$ 12.420,72/ano' },
    { gerente: 'grc4-beatriz', orgao: 'SMSU', nome: 'Horas adicionais', valor: 213185.7, descricao: 'Proposta enviada. No aguardo do recebimento da minuta para tramitar assinatura. 910 horas adicionais no TC015/SMSU/2025, totalizando 2110 horas, sem alterar data de término do contrato' },
    { gerente: 'grc4-beatriz', orgao: 'SVMA', nome: 'Desenv, Suporte e Infra TC62 TC63', valor: 3545621.64, descricao: 'Proposta enviada. No aguardo do recebimento da minuta para tramitar assinatura. Os contratos atuais (TC62 e 63) somam valor de R$ 11.063.620,42, com vencimento em 01/dez/2026.' },
    { gerente: 'grc4-beatriz', orgao: 'CGM', nome: 'SDWAN', valor: 155269.92, descricao: 'Proposta enviada. Com a prorrogação para assinar o contrato novo, feita proposta só com o SDWAN para troca emergencial do MPLS' },
    // KAM1 — Malde
    { gerente: 'kam1-malde', orgao: 'SME', nome: 'Ampliação Parque Wifi', descricao: 'Aguardando contrato: enviado para assinatura, aguardando secretaria' },
    { gerente: 'kam1-malde', orgao: 'SME', nome: 'Ampliação Backup Data Center', nomeAtual: 'Ampliação Parque Wifi Backup Data Center', valor: 12000000, descricao: 'Aguardando pesquisa de preço da secretaria. Precisa ser assinado até 26/11' },
    { gerente: 'kam1-malde', orgao: 'SME', nome: 'Sustentação', valor: 4000000, descricao: 'Aguardando contrato: enviado para assinatura, aguardando secretaria' },
    { gerente: 'kam1-malde', orgao: 'SME', nome: 'Acordo Google', valor: 50000000, descricao: 'Proposta em elaboração. Há chances de ser assinado em dezembro, mas necessário considerar para 2027' },
    { gerente: 'kam1-malde', orgao: 'SME', nome: 'Licenças Workspace', valor: 12000000, descricao: 'Proposta em elaboração. Assinatura prevista para dezembro' },
    { gerente: 'kam1-malde', orgao: 'SME', nome: 'Tríade', valor: 180000, quarter: 'nao_mapeado', descricao: 'Proposta enviada. Previsão Q4/2027' },
    { gerente: 'kam1-malde', orgao: 'SME', nome: 'LGPD', descricao: 'Em análise — proposta em elaboração, sem valor definido' },
];

// Propostas: só o que mudou na planilha.
const PROPOSTAS: { numero: string; observacao: string }[] = [
    { numero: 'MD-TCM-PGM', observacao: 'Proposta caiu, pois TCM decidiu seguir utilizando a base de dados da PGM.' },
];

const chave = (s: string | null | undefined) =>
    (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const AUTOR = 'Planilha perdidos-parados 19/11/2026';
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Proj { id: number; manager_id: string; orgao: string | null; name: string; value: number; temperature: string | null; quarter: string; description: string | null; history: string | null }

async function main() {
    const db = createClient({ url: url!, authToken: process.env.TURSO_AUTH_TOKEN });
    console.log(`→ ${url} (NODE_ENV=${nodeEnv}) ${APLICAR ? '— APLICANDO' : '— simulação (use --aplicar para gravar)'}\n`);

    const gerentes = [...new Set(LINHAS.map(l => l.gerente))];
    const projs = (await db.execute({
        sql: `SELECT id, manager_id, orgao, name, value, temperature, quarter, description, history FROM projects WHERE manager_id IN (${gerentes.map(() => '?').join(',')})`,
        args: gerentes,
    })).rows as unknown as Proj[];

    const stmts: InStatement[] = [];
    for (const l of LINHAS) {
        const nomes = [l.nome, l.nomeAtual].filter(Boolean).map(chave);
        const achados = projs.filter(p => p.manager_id === l.gerente && chave(p.orgao) === chave(l.orgao) && nomes.includes(chave(p.name)));
        if (achados.length > 1) throw new Error(`Mais de um projeto casa com ${l.gerente} / ${l.orgao} / ${l.nome}: ids ${achados.map(p => p.id)}`);
        const p = achados[0];
        const rotulo = `${l.gerente.padEnd(13)} ${l.orgao} · ${l.nome}`;

        if (!p) {
            const novo = { valor: l.valor ?? 0, temp: l.temperatura ?? 'morno', q: l.quarter ?? 'q4' };
            const hist = [{ id: randomUUID(), date: hoje, tipo: 'nota', justificativa: `Criado pela ${AUTOR}: ${l.descricao}`, autor: AUTOR }];
            stmts.push({
                sql: `INSERT INTO projects (manager_id, quarter, orgao, name, value, temperature, description, history) VALUES (?,?,?,?,?,?,?,?)`,
                args: [l.gerente, novo.q, l.orgao, l.nome, novo.valor, novo.temp, l.descricao, JSON.stringify(hist)],
            });
            console.log(`+ NOVO  ${rotulo}  ${brl(novo.valor)} ${novo.temp} ${novo.q}`);
            continue;
        }

        const hist: Record<string, string>[] = [];
        const set: Record<string, string | number> = {};
        const mud: string[] = [];
        if (l.nome.trim() !== p.name.trim()) { set.name = l.nome; mud.push(`nome "${p.name.trim()}" → "${l.nome}"`); }
        if (l.valor !== undefined && Math.abs(l.valor - Number(p.value)) > 0.005) {
            set.value = l.valor; mud.push(`valor ${brl(Number(p.value))} → ${brl(l.valor)}`);
            hist.push({ tipo: 'valor', de: String(p.value), para: String(l.valor) });
        }
        if (l.temperatura && l.temperatura !== p.temperature) {
            set.temperature = l.temperatura; mud.push(`temp ${p.temperature ?? '-'} → ${l.temperatura}`);
            hist.push({ tipo: 'status', de: p.temperature ?? '', para: l.temperatura });
        }
        if (l.quarter && l.quarter !== p.quarter) {
            set.quarter = l.quarter; mud.push(`quarter ${p.quarter} → ${l.quarter}`);
            hist.push({ tipo: 'quarter', de: p.quarter, para: l.quarter });
        }
        if ((p.description ?? '').trim() !== l.descricao) { set.description = l.descricao; mud.push('descrição'); }
        if (mud.length === 0) { console.log(`= igual ${rotulo}`); continue; }

        hist.push({ tipo: 'nota', justificativa: l.descricao });
        let antigo: unknown[] = [];
        try { antigo = p.history ? JSON.parse(p.history) : []; } catch { throw new Error(`history inválido no projeto ${p.id}`); }
        set.history = JSON.stringify([...antigo, ...hist.map(h => ({ id: randomUUID(), date: hoje, ...h, autor: AUTOR }))]);

        const cols = Object.keys(set);
        stmts.push({ sql: `UPDATE projects SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, args: [...cols.map(c => set[c]), p.id] });
        console.log(`~ #${p.id} ${rotulo}: ${mud.join('; ')}`);
    }

    for (const pr of PROPOSTAS) {
        const r = (await db.execute({ sql: 'SELECT id, observacao FROM proposta WHERE numero_proposta = ?', args: [pr.numero] })).rows;
        if (r.length !== 1) throw new Error(`Proposta ${pr.numero}: ${r.length} linhas`);
        if (r[0].observacao === pr.observacao) { console.log(`= igual proposta ${pr.numero}`); continue; }
        stmts.push({ sql: `UPDATE proposta SET observacao = ?, updated_at = ? WHERE id = ?`, args: [pr.observacao, new Date().toISOString(), r[0].id as string] });
        console.log(`~ proposta ${pr.numero}: observação`);
    }

    console.log(`\n${stmts.length} alterações.`);
    if (!APLICAR || stmts.length === 0) return;
    await db.batch(stmts, 'write'); // transação: tudo ou nada
    console.log('✓ gravado.');
}

main().catch(e => { console.error(e); process.exit(1); });
