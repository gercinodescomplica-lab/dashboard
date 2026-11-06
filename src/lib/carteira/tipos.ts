// Tipos e textos da carteira de clientes (spec 2026-11-06-organograma-clientes-design.md). Textos copiados do AIBertinho.
export class ErroCarteira extends Error {
    constructor(mensagem: string) {
        super(mensagem);
        this.name = 'ErroCarteira';
    }
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

export const AVISO_LEVA_TUDO =
    'Tudo do cliente vai junto para a nova gerência: contratos, propostas, oportunidades do pipeline e cards do CX. A troca fica registrada no histórico.';
export const MUDOU_ENQUANTO_OLHAVA = 'Esse cliente mudou de carteira enquanto você olhava. A tela foi atualizada.';
export const JUSTIFICATIVA_TROCA = 'O cliente mudou de carteira';
export const SO_ADMIN = 'Só o administrador move clientes entre carteiras.';

/** O card `managers` visto como gerência. */
export interface CardGerencia {
    id: string;
    name: string;
    role: string;
    year: number;
    showInDashboard: boolean;
}
