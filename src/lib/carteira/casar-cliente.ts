// Regra `clienteCitado` (src/lib/integracao/feed.ts da branch login): sigla igual, sigla citada em maiúsculas ou nome
// por extenso igual. Só vale quando o cliente achado é ÚNICO; primeiro entre os da gerência da linha.
import { citaSigla, clienteAtendido, mesmaSigla } from '@/lib/integracao/chaves';

export interface ClienteParaCasar {
    id: string;
    nome: string;
    sigla: string | null;
    gerencia: string | null;
}

function casa(texto: string, c: ClienteParaCasar): boolean {
    if (c.sigla && (mesmaSigla(texto, c.sigla) || citaSigla(texto, c.sigla))) return true;
    return mesmaSigla(texto, c.nome);
}

function unico(texto: string, lista: ClienteParaCasar[]): string | null {
    const ids = new Set(lista.filter((c) => casa(texto, c)).map((c) => c.id));
    return ids.size === 1 ? [...ids][0] : null;
}

export function casarCliente(texto: string | null | undefined, clientes: ClienteParaCasar[], gerencia?: string | null): string | null {
    const t = texto?.trim();
    if (!t) return null;
    if (gerencia) {
        const daGerencia = unico(t, clientes.filter((c) => c.gerencia === gerencia));
        if (daGerencia) return daGerencia;
    }
    return unico(t, clientes);
}

/** Item do `served_clients` → cliente. Sem nome ("Ouvidoria Geral do Município") a sigla só fica se for uma palavra em maiúsculas. */
export function clienteDoServedClient(texto: string): { nome: string; sigla: string | null } {
    const { sigla, nome } = clienteAtendido(texto);
    if (nome) return { sigla, nome };
    const pareceSigla = /^\S+$/.test(sigla) && sigla === sigla.toUpperCase();
    return { sigla: pareceSigla ? sigla : null, nome: sigla };
}
