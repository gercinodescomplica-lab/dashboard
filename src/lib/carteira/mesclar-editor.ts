// Junta o estado do editor (/settings) com o banco depois de mexer na carteira: a edição não salva fica e o que chegou entra.
// Salvar é apagar e regravar: linha que falta no estado seria perdida.
import type { CXItem, PipelineData, Project } from '@/types/manager';

const TRIMESTRES = ['q1', 'q2', 'q3', 'q4', 'nao_mapeado'] as const;
type Trimestre = (typeof TRIMESTRES)[number];
const ATIVAS = ['quente', 'morno', 'frio', 'contratado']; // mesma regra do total em fetchAllManagersFromDB

// shortcut: projeto não tem id, então renomear sem salvar faz a linha do banco voltar como outra; upgrade: expor projects.id ao editor.
const chave = (p: Project) => `${p.name}\0${p.orgao ?? ''}`;

export function mesclarPipeline(atual: PipelineData, fresco: PipelineData): PipelineData {
    const r = { ...atual };
    const livres = new Map<string, Array<{ q: Trimestre; i: number }>>();
    for (const q of TRIMESTRES) {
        r[q] = { ...atual[q], projects: [...atual[q].projects] };
        atual[q].projects.forEach((p, i) => livres.set(chave(p), [...(livres.get(chave(p)) ?? []), { q, i }]));
    }
    for (const q of TRIMESTRES) {
        for (const f of fresco[q].projects) {
            // Cada linha do estado casa uma vez só: homônimo que chegou não some.
            const par = livres.get(chave(f))?.shift();
            if (par) {
                r[par.q].projects[par.i] = { ...r[par.q].projects[par.i], clienteId: f.clienteId ?? null };
            } else {
                r[q].projects.push(f);
                if (ATIVAS.includes(f.temperature ?? '')) r[q].total += f.value;
            }
        }
    }
    return r;
}

export function mesclarCX(atual: CXItem[] | undefined, fresco: CXItem[] | undefined): CXItem[] | undefined {
    if (!atual || !fresco) return atual ?? fresco;
    const porId = new Map(fresco.map((c) => [c.id, c]));
    const noEstado = new Set(atual.map((c) => c.id));
    return [
        ...atual.map((c) => (c.id !== undefined && porId.has(c.id) ? { ...c, clienteId: porId.get(c.id)!.clienteId ?? null } : c)),
        ...fresco.filter((c) => !noEstado.has(c.id)),
    ];
}
