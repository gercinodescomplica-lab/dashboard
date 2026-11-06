import type OpenAI from 'openai';
import {
    fetchVisibleManagersFromDB, fetchAllContratos, fetchAllPropostas, fetchAllCXItemsForBoard,
    fetchVisitsByManager, fetchAllStoreProducts, fetchAllChurns,
} from '@/db/queries';
import { calculateAchievementPercentage, determinePerformanceStatus, sumPipelineAberto, sumPipelineContratado2026 } from '@/lib/calc';
import type { Manager } from '@/types/manager';
import { isContratoVigente } from '@/lib/contrato';
import { fetchOrgChart } from '@/app/settings/orgChartActions';

// Ferramentas de LEITURA sobre os dados agregados da DRM. Sem filtro por papel —
// todo usuário logado vê o panorama inteiro. Cada função devolve um objeto
// enxuto (só os campos úteis), nunca linhas cruas gigantes.

export const AI_TOOLS: OpenAI.Chat.Completions.ChatCompletionFunctionTool[] = [
    {
        type: 'function',
        function: {
            name: 'listar_gerentes',
            description: 'Lista os gerentes (GRC/KAM) visíveis no dashboard com meta, novos negócios, % de atingimento (novos negócios ÷ meta), herdados, pipeline aberto e forecast — e os totais da DRM.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'detalhar_gerente',
            description: 'Detalha um gerente: pipeline por trimestre, novos negócios, clientes atendidos.',
            parameters: {
                type: 'object',
                properties: { managerId: { type: 'string', description: 'id do gerente (ver listar_gerentes); aceita também o nome' } },
                required: ['managerId'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'buscar_contratos',
            description: 'Busca contratos por número/cliente/objeto. Sem query, retorna um resumo agregado.',
            parameters: {
                type: 'object',
                properties: { query: { type: 'string' }, apenasVigentes: { type: 'boolean' } },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'analytics_contratos',
            description: 'Estatísticas agregadas da carteira de contratos (total, valor, vigentes, saldo).',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listar_propostas',
            description: 'Lista as propostas comerciais (todas as fases/status) com total e valor somado; filtre por status/fase e/ou por texto (cliente, oportunidade, gerência, proprietário).',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', description: 'texto no status ou na fase' },
                    busca: { type: 'string', description: 'cliente, oportunidade, gerência ou proprietário' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listar_bloqueios_cx',
            description: 'Lista os bloqueios (cards de CX tipo=bloqueio): criticidade, status, prazo, fator externo.',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['pendente', 'analise', 'resolvido'] },
                    apenasExterno: { type: 'boolean', description: 'só os travados por área externa' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listar_visitas',
            description: 'Lista as visitas a clientes registradas, opcionalmente de um gerente.',
            parameters: {
                type: 'object',
                properties: { managerId: { type: 'string' } },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listar_itens_cx',
            description: 'Lista os cards de CX do board (tarefas de acompanhamento e bloqueios juntos) — mais amplo que listar_bloqueios_cx, que só traz tipo=bloqueio.',
            parameters: {
                type: 'object',
                properties: {
                    managerId: { type: 'string' },
                    tipo: { type: 'string', enum: ['tarefa', 'bloqueio'] },
                    status: { type: 'string', enum: ['pendente', 'analise', 'resolvido'] },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listar_produtos_store',
            description: 'Lista o catálogo Store (produtos/serviços da DRM): diretoria, fase, status, categoria, responsável.',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    directorate: { type: 'string' },
                    category: { type: 'string' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'consultar_organograma',
            description: 'Estrutura do organograma da DRM: diretor, subdiretores, departamentos, seções, líderes e pessoas.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'analisar_cliente',
            description: 'Visão 360° de UM cliente/órgão (nome ou sigla): contratos (vigência, saldo, vencimento), propostas, oportunidades no pipeline, cards de CX/bloqueios, visitas e churn. Use para qualquer pergunta sobre a situação de um cliente.',
            parameters: {
                type: 'object',
                properties: { cliente: { type: 'string', description: 'nome ou sigla do cliente (ex.: SME, Saúde, SPTrans)' } },
                required: ['cliente'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'contratos_vencendo',
            description: 'Contratos vigentes que vencem nos próximos N dias (risco de renovação), mais os que constam vigentes com data de fim já passada. Ordenados pelo vencimento.',
            parameters: {
                type: 'object',
                properties: {
                    dias: { type: 'number', description: 'janela em dias (padrão 90)' },
                    managerId: { type: 'string', description: 'id ou nome do gerente (opcional)' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'buscar_oportunidades',
            description: 'Busca oportunidades do pipeline de TODOS os gerentes, com descrição, órgão, início, duração e última mudança registrada. Ordena por valor. Traz totais por temperatura.',
            parameters: {
                type: 'object',
                properties: {
                    termo: { type: 'string', description: 'texto no nome, órgão ou descrição' },
                    temperatura: { type: 'string', enum: ['quente', 'morno', 'frio', 'contratado', 'historico', 'perdido'] },
                    trimestre: { type: 'string', enum: ['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] },
                    managerId: { type: 'string', description: 'id ou nome do gerente' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listar_churn',
            description: 'Contratos perdidos/cancelados (churn): número do contrato, valor, motivo e gerente, com o total perdido.',
            parameters: {
                type: 'object',
                properties: { managerId: { type: 'string', description: 'id ou nome do gerente (opcional)' } },
                additionalProperties: false,
            },
        },
    },
];

function asObj(args: unknown): Record<string, unknown> {
    return args && typeof args === 'object' ? (args as Record<string, unknown>) : {};
}

// Comparação sem acento/caixa: "saúde" casa com "SAUDE".
export function norm(v: string | null | undefined): string {
    return (v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
const contem = (campo: string | null | undefined, q: string) => !!q && norm(campo).includes(q);

function hojeISO(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
}
export function diasAte(dataISO: string | null | undefined, hoje = hojeISO()): number | null {
    if (!dataISO || !/^\d{4}-\d{2}-\d{2}/.test(dataISO)) return null;
    return Math.round((Date.parse(dataISO.slice(0, 10)) - Date.parse(hoje)) / 86_400_000);
}

function somar<T>(rows: T[], f: (r: T) => number | null | undefined): number {
    return rows.reduce((a, r) => a + (f(r) ?? 0), 0);
}

type ContratoRow = Awaited<ReturnType<typeof fetchAllContratos>>[number];

function contratoResumo(c: ContratoRow) {
    return {
        numero: c.numeroContrato, cliente: c.cliente, objeto: c.objeto ?? null,
        vlContratado: c.vlContratado ?? 0, vlFaturado: c.vlFaturado ?? 0, vlSaldo: c.vlSaldo ?? 0,
        vigente: isContratoVigente(c), situacao: c.situacao ?? null,
        dtInicioVigencia: c.dtInicioVigencia ?? null, dtFimVigencia: c.dtFimVigencia ?? null,
        diasParaVencer: diasAte(c.dtFimVigencia),
        gerente: c.managerName ?? c.nomeGerente ?? null, gerencia: c.gerencia ?? null,
    };
}

// Mesmas fórmulas do dashboard (DRMOverview/ManagerHeader): atingimento = novos negócios ÷ meta.
export function resumoGerente(m: Manager) {
    const novosNegocios = m.novosNegocios ?? sumPipelineContratado2026(m.pipeline);
    const pct = calculateAchievementPercentage(novosNegocios, m.meta);
    return {
        id: m.id, nome: m.name, papel: m.role,
        meta: m.meta, novosNegocios: Math.round(novosNegocios),
        atingimentoPct: Math.round(pct), situacao: determinePerformanceStatus(pct),
        contratosHerdados: m.contratosHerdados ?? m.contratado,
        contratado2026: Math.round(m.contratado2026 ?? m.contratado),
        pipelineAberto: sumPipelineAberto(m.pipeline),
        forecastFinal: m.forecastFinal,
        forecastProRata2026: Math.round(m.forecastProRata2026 ?? m.forecastFinal),
    };
}

// Gerentes exatamente como o dashboard mostra (só showInDashboard, sem a Tríade).
async function gerentesDoDashboard() {
    return (await fetchVisibleManagersFromDB()).filter((m) => m.name !== 'Tríade Digital');
}

async function listarGerentes() {
    const gerentes = (await gerentesDoDashboard()).map(resumoGerente);
    const soma = (k: 'meta' | 'novosNegocios' | 'contratosHerdados' | 'contratado2026' | 'pipelineAberto' | 'forecastFinal') =>
        gerentes.reduce((a, g) => a + g[k], 0);
    const meta = soma('meta'), novos = soma('novosNegocios');
    return {
        totalGerentes: gerentes.length,
        totaisDRM: {
            meta, novosNegocios: novos,
            atingimentoPct: Math.round(calculateAchievementPercentage(novos, meta)),
            contratosHerdados: soma('contratosHerdados'), contratado2026: soma('contratado2026'),
            pipelineAberto: soma('pipelineAberto'), forecastFinal: soma('forecastFinal'),
        },
        gerentes,
    };
}

function acharGerente(managers: Manager[], idOuNome: string): Manager | undefined {
    const q = norm(idOuNome);
    if (!q) return undefined;
    return managers.find((x) => x.id === idOuNome)
        ?? managers.find((x) => norm(x.name).includes(q) || norm(x.role) === q);
}

async function detalharGerente(managerId: string) {
    const managers = await gerentesDoDashboard();
    const m = acharGerente(managers, managerId);
    if (!m) return { error: `gerente "${managerId}" não encontrado`, gerentesValidos: managers.map((x) => ({ id: x.id, nome: x.name })) };
    const pipelinePorTrimestre = Object.fromEntries(
        (['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as const).map((q) => [q, {
            total: m.pipeline[q].total,
            oportunidades: m.pipeline[q].projects.map((p) => ({ nome: p.name, orgao: p.orgao ?? null, valor: p.value, temperatura: p.temperature ?? null, descricao: p.description ?? null })),
        }]),
    );
    return {
        ...resumoGerente(m), metaNovosNegocios: m.metaNovosNegocios ?? null,
        clientesAtendidos: m.servedClients ?? [],
        pipelinePorTrimestre,
    };
}

async function buscarContratos(query: string | undefined, apenasVigentes: boolean | undefined) {
    const rows = await fetchAllContratos(query?.trim() || undefined);
    const filtered = apenasVigentes ? rows.filter((c) => isContratoVigente(c)) : rows;
    if (!query?.trim()) {
        return {
            total: filtered.length,
            valorContratadoTotal: filtered.reduce((a, c) => a + (c.vlContratado ?? 0), 0),
            dica: 'passe `query` para buscar contratos específicos',
        };
    }
    return {
        total: filtered.length, mostrando: Math.min(filtered.length, 20),
        valorContratadoTotal: somar(filtered, (c) => c.vlContratado),
        saldoTotal: somar(filtered, (c) => c.vlSaldo),
        contratos: filtered.slice(0, 20).map(contratoResumo),
    };
}

async function analyticsContratos() {
    const rows = await fetchAllContratos();
    const vigentes = rows.filter((c) => isContratoVigente(c));
    const vencendoEm = (dias: number) => {
        const v = vigentes.filter((c) => { const d = diasAte(c.dtFimVigencia); return d !== null && d >= 0 && d <= dias; });
        return { quantidade: v.length, valorContratado: somar(v, (c) => c.vlContratado) };
    };
    const agrupar = (chave: (c: ContratoRow) => string) => {
        const mapa = new Map<string, { quantidade: number; valorContratado: number; saldo: number }>();
        for (const c of vigentes) {
            const k = chave(c);
            const g = mapa.get(k) ?? { quantidade: 0, valorContratado: 0, saldo: 0 };
            g.quantidade++; g.valorContratado += c.vlContratado ?? 0; g.saldo += c.vlSaldo ?? 0;
            mapa.set(k, g);
        }
        return [...mapa.entries()].map(([nome, g]) => ({ nome, ...g })).sort((a, b) => b.valorContratado - a.valorContratado);
    };
    return {
        totalContratos: rows.length,
        contratosVigentes: vigentes.length,
        valorContratadoTotal: somar(rows, (c) => c.vlContratado),
        valorFaturadoTotal: somar(rows, (c) => c.vlFaturado),
        saldoTotal: somar(rows, (c) => c.vlSaldo),
        vigentes: {
            valorContratado: somar(vigentes, (c) => c.vlContratado),
            saldo: somar(vigentes, (c) => c.vlSaldo),
            vencendoEm30Dias: vencendoEm(30), vencendoEm90Dias: vencendoEm(90), vencendoEm180Dias: vencendoEm(180),
            vencidosAindaMarcadosVigentes: vigentes.filter((c) => (diasAte(c.dtFimVigencia) ?? 0) < 0).length,
            porGerente: agrupar((c) => c.managerName ?? c.nomeGerente ?? '(sem gerente)'),
            top10Clientes: agrupar((c) => c.cliente).slice(0, 10),
        },
    };
}

async function listarPropostas(status: string | undefined, busca: string | undefined) {
    const rows = await fetchAllPropostas(busca?.trim() || undefined);
    const s = status?.trim().toLowerCase();
    const filtered = s ? rows.filter((p) => (p.status ?? '').toLowerCase().includes(s) || (p.fase ?? '').toLowerCase().includes(s)) : rows;
    return {
        total: filtered.length,
        valorTotal: filtered.reduce((a, p) => a + (p.valor ?? 0), 0),
        mostrando: Math.min(filtered.length, 25),
        propostas: filtered.slice(0, 25).map((p) => ({
            numero: p.numeroProposta, oportunidade: p.nomeOportunidade, cliente: p.cliente,
            fase: p.fase ?? null, status: p.status ?? null, valor: p.valor ?? 0,
            probabilidade: p.probabilidade ?? null, receitaEsperada: p.receitaEsperada ?? null,
            dataCriacao: p.dataCriacao ?? null, dataFechamento: p.dataFechamento ?? null,
            gerente: p.managerName ?? p.proprietario ?? null, gerencia: p.gerencia ?? null,
            observacao: p.observacao ?? null,
        })),
    };
}

async function listarBloqueios(status: string | undefined, apenasExterno: boolean | undefined) {
    const all = await fetchAllCXItemsForBoard();
    let bloqueios = all.filter((i) => i.tipo === 'bloqueio');
    if (status) bloqueios = bloqueios.filter((b) => b.status === status);
    if (apenasExterno) bloqueios = bloqueios.filter((b) => !!b.externalBlockerLabel);
    return {
        total: bloqueios.length, mostrando: Math.min(bloqueios.length, 30),
        bloqueios: bloqueios.slice(0, 30).map((b) => ({
            titulo: b.titulo, cliente: b.cliente, gerente: b.managerName,
            criticidade: b.criticidade, status: b.status, categoria: b.categoria ?? null,
            problema: b.problema, solucaoProposta: b.solucaoProposta || null,
            prazoLimite: b.prazoLimite ?? null, diasParaPrazo: diasAte(b.prazoLimite),
            fatorExterno: b.externalBlockerLabel ?? null,
        })),
    };
}

async function listarVisitas(managerId: string | undefined) {
    if (managerId) {
        const v = await fetchVisitsByManager(acharGerente(await gerentesDoDashboard(), managerId)?.id ?? managerId);
        v.sort((a, b) => b.data.localeCompare(a.data));
        return { gerente: managerId, total: v.length, mostrando: Math.min(v.length, 30), visitas: v.slice(0, 30).map((x) => ({ titulo: x.titulo, local: x.local, motivo: x.motivo, data: x.data })) };
    }
    const managers = await gerentesDoDashboard();
    const perManager = await Promise.all(managers.map(async (m) => ({ id: m.id, nome: m.name, visitas: await fetchVisitsByManager(m.id) })));
    const flat = perManager.flatMap((pm) => pm.visitas.map((v) => ({ gerente: pm.nome, titulo: v.titulo, local: v.local, data: v.data })));
    flat.sort((a, b) => b.data.localeCompare(a.data));
    return { total: flat.length, mostrando: Math.min(flat.length, 40), visitas: flat.slice(0, 40) };
}

async function listarItensCX(managerId: string | undefined, tipo: string | undefined, status: string | undefined) {
    const all = await fetchAllCXItemsForBoard();
    let itens = all;
    if (managerId) {
        const m = acharGerente(await gerentesDoDashboard(), managerId);
        itens = itens.filter((i) => i.managerId === (m?.id ?? managerId));
    }
    if (tipo) itens = itens.filter((i) => (i.tipo ?? 'tarefa') === tipo);
    if (status) itens = itens.filter((i) => i.status === status);
    return {
        total: itens.length, mostrando: Math.min(itens.length, 30),
        itens: itens.slice(0, 30).map((i) => ({
            titulo: i.titulo, cliente: i.cliente, gerente: i.managerName,
            tipo: i.tipo ?? 'tarefa', status: i.status, criticidade: i.criticidade,
            problema: i.problema, solucaoProposta: i.solucaoProposta || null, categoria: i.categoria ?? null,
            prazoLimite: i.prazoLimite ?? null, fatorExterno: i.externalBlockerLabel ?? null,
        })),
    };
}

async function listarProdutosStore(status: string | undefined, directorate: string | undefined, category: string | undefined) {
    const rows = await fetchAllStoreProducts();
    const filtered = rows.filter((p) =>
        (!status || p.status.toLowerCase().includes(status.toLowerCase())) &&
        (!directorate || p.directorate.toLowerCase().includes(directorate.toLowerCase())) &&
        (!category || p.category.toLowerCase().includes(category.toLowerCase())),
    );
    return {
        total: filtered.length, mostrando: Math.min(filtered.length, 40),
        produtos: filtered.slice(0, 40).map((p) => ({
            nome: p.name, diretoria: p.directorate, status: p.status, fase: p.phase,
            categoria: p.category, marketplace: p.marketplace, responsavel: p.responsavel ?? null,
        })),
    };
}

async function contratosVencendo(dias: number | undefined, managerId: string | undefined) {
    const janela = dias && dias > 0 ? dias : 90;
    let vigentes = (await fetchAllContratos()).filter((c) => isContratoVigente(c));
    if (managerId) {
        const m = acharGerente(await gerentesDoDashboard(), managerId);
        if (!m) return { error: `gerente "${managerId}" não encontrado` };
        vigentes = vigentes.filter((c) => c.managerId === m.id);
    }
    const comDias = vigentes.flatMap((c) => { const d = diasAte(c.dtFimVigencia); return d === null ? [] : [{ c, d }]; });
    const vencendo = comDias.filter((x) => x.d >= 0 && x.d <= janela).sort((a, b) => a.d - b.d).map((x) => x.c);
    const vencidos = comDias.filter((x) => x.d < 0).sort((a, b) => a.d - b.d).map((x) => x.c);
    return {
        hoje: hojeISO(), janelaDias: janela,
        vencendo: {
            total: vencendo.length, valorContratado: somar(vencendo, (c) => c.vlContratado),
            mostrando: Math.min(vencendo.length, 30), contratos: vencendo.slice(0, 30).map(contratoResumo),
        },
        vencidosAindaMarcadosVigentes: {
            total: vencidos.length, mostrando: Math.min(vencidos.length, 15), contratos: vencidos.slice(0, 15).map(contratoResumo),
        },
        vigentesSemDataDeFim: vigentes.length - comDias.length,
    };
}

const QUARTERS = ['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as const;
type Quarter = (typeof QUARTERS)[number];

async function buscarOportunidades(a: Record<string, unknown>) {
    const managers = await gerentesDoDashboard();
    const termo = norm(a.termo as string | undefined);
    const gerente = a.managerId ? acharGerente(managers, String(a.managerId)) : undefined;
    if (a.managerId && !gerente) return { error: `gerente "${a.managerId}" não encontrado` };
    const quarters: readonly Quarter[] = QUARTERS.includes(a.trimestre as Quarter) ? [a.trimestre as Quarter] : QUARTERS;
    const todas = (gerente ? [gerente] : managers)
        .flatMap((m) => quarters.flatMap((q) => (m.pipeline[q]?.projects ?? []).map((p) => ({ m, q, p }))))
        .filter(({ p }) => !a.temperatura || p.temperature === a.temperatura)
        .filter(({ p }) => !termo || contem(p.name, termo) || contem(p.orgao, termo) || contem(p.description, termo))
        .sort((x, y) => y.p.value - x.p.value);
    const porTemperatura: Record<string, { quantidade: number; valor: number }> = {};
    for (const { p } of todas) {
        const t = p.temperature ?? 'sem_temperatura';
        porTemperatura[t] ??= { quantidade: 0, valor: 0 };
        porTemperatura[t].quantidade++;
        porTemperatura[t].valor += p.value;
    }
    return {
        total: todas.length, valorTotal: somar(todas, (x) => x.p.value), porTemperatura,
        mostrando: Math.min(todas.length, 30),
        oportunidades: todas.slice(0, 30).map(({ m, q, p }) => ({
            nome: p.name, orgao: p.orgao ?? null, gerente: m.name, trimestre: q,
            valor: p.value, temperatura: p.temperature ?? null, descricao: p.description ?? null,
            inicio: p.startDate ?? null, mesInicioFaturamento: p.billingStartMonth ?? null, duracaoMeses: p.durationMonths ?? null,
            ultimaMudanca: p.history?.length ? p.history[p.history.length - 1] : null,
        })),
    };
}

async function listarChurn(managerId: string | undefined) {
    const managers = await gerentesDoDashboard();
    const nomes = new Map(managers.map((m) => [m.id, m.name]));
    let rows = await fetchAllChurns();
    if (managerId) {
        const m = acharGerente(managers, managerId);
        if (!m) return { error: `gerente "${managerId}" não encontrado` };
        rows = rows.filter((r) => r.managerId === m.id);
    }
    rows.sort((a, b) => b.valor - a.valor);
    return {
        total: rows.length, valorPerdido: somar(rows, (r) => r.valor), mostrando: Math.min(rows.length, 30),
        itens: rows.slice(0, 30).map((r) => ({
            contrato: r.numeroContrato, valor: r.valor, descricao: r.descricao, motivo: r.motivo,
            gerente: nomes.get(r.managerId ?? '') ?? r.managerId ?? null, data: r.createdAt ?? null,
        })),
    };
}

async function analisarCliente(cliente: string) {
    const q = norm(cliente);
    if (q.length < 2) return { error: 'informe o nome ou a sigla do cliente' };
    const [contratos, propostas, cxItens, managers, churns] = await Promise.all([
        fetchAllContratos(), fetchAllPropostas(), fetchAllCXItemsForBoard(),
        gerentesDoDashboard(), fetchAllChurns(),
    ]);
    // Filtro em JS (não o LIKE do SQL) pra ignorar acento: "saude" casa com "Saúde".
    const doCliente = contratos.filter((c) => contem(c.cliente, q) || contem(c.objeto, q));
    const vigentes = doCliente.filter((c) => isContratoVigente(c));
    const props = propostas.filter((p) => contem(p.cliente, q) || contem(p.nomeOportunidade, q));
    const cxDoCliente = cxItens.filter((i) => contem(i.cliente, q) || contem(i.titulo, q));
    const oportunidades = managers.flatMap((m) => QUARTERS.flatMap((tri) =>
        (m.pipeline[tri]?.projects ?? [])
            .filter((p) => contem(p.orgao, q) || contem(p.name, q))
            .map((p) => ({ nome: p.name, orgao: p.orgao ?? null, gerente: m.name, trimestre: tri, valor: p.value, temperatura: p.temperature ?? null, descricao: p.description ?? null }))))
        .sort((a, b) => b.valor - a.valor);
    const visitas = (await Promise.all(managers.map(async (m) =>
        (await fetchVisitsByManager(m.id))
            .filter((v) => contem(v.titulo, q) || contem(v.local, q) || contem(v.motivo, q))
            .map((v) => ({ gerente: m.name, titulo: v.titulo, local: v.local, motivo: v.motivo, data: v.data })))))
        .flat().sort((a, b) => b.data.localeCompare(a.data));
    const numeros = new Set(doCliente.map((c) => c.numeroContrato));
    const churnDoCliente = churns.filter((r) => numeros.has(r.numeroContrato) || contem(r.descricao, q));

    if (!doCliente.length && !props.length && !cxDoCliente.length && !oportunidades.length && !visitas.length && !churnDoCliente.length) {
        return { cliente, encontrado: false, aviso: 'nenhum registro casou com esse nome/sigla — tente outra grafia ou a sigla' };
    }
    const abertas = oportunidades.filter((o) => ['quente', 'morno', 'frio'].includes(o.temperatura ?? ''));
    const proximos = vigentes.map(contratoResumo).filter((c) => c.diasParaVencer !== null && c.diasParaVencer >= 0)
        .sort((a, b) => a.diasParaVencer! - b.diasParaVencer!);
    const gerentesEnvolvidos = [...new Set([
        ...doCliente.map((c) => c.managerName ?? c.nomeGerente),
        ...oportunidades.map((o) => o.gerente),
        ...cxDoCliente.map((i) => i.managerName),
    ].filter(Boolean))];

    return {
        cliente, encontrado: true, hoje: hojeISO(), gerentesEnvolvidos,
        resumo: {
            contratos: doCliente.length, contratosVigentes: vigentes.length,
            valorVigente: somar(vigentes, (c) => c.vlContratado), saldoVigente: somar(vigentes, (c) => c.vlSaldo),
            proximoVencimento: proximos[0] ?? null,
            propostas: props.length, valorPropostas: somar(props, (p) => p.valor),
            oportunidadesAbertas: abertas.length, valorPipelineAberto: somar(abertas, (o) => o.valor),
            cxAbertos: cxDoCliente.filter((i) => i.status !== 'resolvido').length,
            bloqueiosAbertos: cxDoCliente.filter((i) => i.tipo === 'bloqueio' && i.status !== 'resolvido').length,
            visitas: visitas.length, ultimaVisita: visitas[0]?.data ?? null,
            churn: churnDoCliente.length, valorChurn: somar(churnDoCliente, (r) => r.valor),
        },
        contratos: doCliente.slice(0, 15).map(contratoResumo),
        propostas: props.slice(0, 15).map((p) => ({
            numero: p.numeroProposta, oportunidade: p.nomeOportunidade, fase: p.fase ?? null, status: p.status ?? null,
            valor: p.valor ?? 0, probabilidade: p.probabilidade ?? null, dataFechamento: p.dataFechamento ?? null,
            observacao: p.observacao ?? null,
        })),
        oportunidades: oportunidades.slice(0, 15),
        cx: cxDoCliente.slice(0, 15).map((i) => ({
            titulo: i.titulo, tipo: i.tipo, status: i.status, criticidade: i.criticidade, problema: i.problema,
            solucaoProposta: i.solucaoProposta || null, prazoLimite: i.prazoLimite ?? null,
            fatorExterno: i.externalBlockerLabel ?? null, gerente: i.managerName,
        })),
        visitas: visitas.slice(0, 10),
        churn: churnDoCliente.map((r) => ({ contrato: r.numeroContrato, valor: r.valor, motivo: r.motivo })),
        aviso: 'casamento por texto no nome/sigla: confira se todos os registros são mesmo desse cliente; listas limitadas a 15 itens (veja os totais no resumo)',
    };
}

async function consultarOrganograma() {
    const chart = await fetchOrgChart();
    return {
        diretor: chart.director,
        subdiretores: chart.subdirectors.map((s) => ({ nome: s.name, subtitulo: s.subtitle, pessoas: s.people.map((p) => p.name) })),
        departamentos: chart.departments.map((d) => ({
            nome: d.name, subtitulo: d.subtitle,
            secoes: d.sections.map((s) => ({
                nome: s.name, lider: s.leader?.name ?? null,
                pessoas: s.people.map((p) => p.name),
            })),
        })),
    };
}

export async function runAiTool(name: string, args: unknown): Promise<unknown> {
    try {
        const a = asObj(args);
        switch (name) {
            case 'listar_gerentes': return await listarGerentes();
            case 'detalhar_gerente': return await detalharGerente(String(a.managerId ?? ''));
            case 'buscar_contratos': return await buscarContratos(a.query as string | undefined, a.apenasVigentes as boolean | undefined);
            case 'analytics_contratos': return await analyticsContratos();
            case 'listar_propostas': return await listarPropostas(a.status as string | undefined, a.busca as string | undefined);
            case 'listar_bloqueios_cx': return await listarBloqueios(a.status as string | undefined, a.apenasExterno as boolean | undefined);
            case 'listar_visitas': return await listarVisitas(a.managerId as string | undefined);
            case 'listar_itens_cx': return await listarItensCX(a.managerId as string | undefined, a.tipo as string | undefined, a.status as string | undefined);
            case 'listar_produtos_store': return await listarProdutosStore(a.status as string | undefined, a.directorate as string | undefined, a.category as string | undefined);
            case 'consultar_organograma': return await consultarOrganograma();
            case 'analisar_cliente': return await analisarCliente(String(a.cliente ?? ''));
            case 'contratos_vencendo': return await contratosVencendo(a.dias as number | undefined, a.managerId as string | undefined);
            case 'buscar_oportunidades': return await buscarOportunidades(a);
            case 'listar_churn': return await listarChurn(a.managerId as string | undefined);
            default: return { error: `ferramenta desconhecida: ${name}` };
        }
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'erro ao executar a ferramenta' };
    }
}
