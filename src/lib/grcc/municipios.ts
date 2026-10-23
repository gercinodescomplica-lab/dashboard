import municipiosGeo from '@/data/municipios-geo.json';
import { chaveTexto } from './normalizar';

interface MunicipioGeo {
    nome: string;
    uf: string;
}

const POR_UF = new Map<string, string[]>();
for (const m of municipiosGeo as MunicipioGeo[]) {
    const lista = POR_UF.get(m.uf) ?? [];
    lista.push(m.nome);
    POR_UF.set(m.uf, lista);
}
for (const lista of POR_UF.values()) lista.sort((a, b) => a.localeCompare(b, 'pt-BR'));

export const UFS: string[] = [...POR_UF.keys()].sort();

export function municipiosDaUf(uf: string): string[] {
    return POR_UF.get(uf) ?? [];
}

/** Grafia oficial do município na UF, comparando sem acento/caixa; `null` se não existir. */
export function acharMunicipio(uf: string, nome: string): string | null {
    const alvo = chaveTexto(nome);
    if (!alvo) return null;
    return municipiosDaUf(uf).find((m) => chaveTexto(m) === alvo) ?? null;
}
