// Chaves de casamento AIBertinho × VerAI. Os dois sistemas não compartilham id nenhum: cliente casa
// pela SIGLA, gerência pela SIGLA DA GERÊNCIA ("GRC4") e contrato pelo NÚMERO (quem resolve o número
// é o VerAI, em POST /api/integracao/v1/contratos/localizar). O VerAI tem uma cópia de
// `siglaComparavel`/`chaveDaGerencia` (src/lib/integracao/chaves.ts lá) com os MESMOS testes —
// mudou aqui, muda lá. Spec docs/superpowers/specs/2026-10-07-integracao-verai-aibertinho-design.md.

/** "SP/REGULA" → "SPREGULA", "Sub-Itp" → "SUBITP": sem acento, maiúscula, só letras e números. */
export function siglaComparavel(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase();
}

/** Mesma sigla de cliente? "SP REGULA" = "SP-REGULA" = "spregula". Vazio nunca casa. */
export function mesmaSigla(a: string | null | undefined, b: string | null | undefined): boolean {
    const x = siglaComparavel(a ?? '');
    return x !== '' && x === siglaComparavel(b ?? '');
}

/** "GRC-4", "grc4", "grc4-beatriz" (id do gerente), "KAM 2", "GRC-C" → "GRC4", "GRC4", "GRC4",
 *  "KAM2", "GRCC". `null` quando o texto não começa por GRC/KAM ("Tríade Digital"). */
export function chaveDaGerencia(texto: string | null | undefined): string | null {
    if (!texto) return null;
    const m = /^\s*(GRC|KAM)\s*-?\s*([A-Za-z0-9]{1,2})(?![A-Za-z0-9])/i.exec(texto);
    return m ? `${m[1]}${m[2]}`.toUpperCase() : null;
}

/** Cliente atendido como o gerente cadastra em `servedClients`:
 *  "SMIT (Secretaria Municipal de Inovação e Tecnologia)" → { sigla: 'SMIT', nome: 'Secretaria …' };
 *  "SGM - Secretaria do Governo Municipal" → { sigla: 'SGM', nome: 'Secretaria …' };
 *  "Ouvidoria Geral do Município" → { sigla: 'Ouvidoria Geral do Município', nome: null }. */
export function clienteAtendido(texto: string): { sigla: string; nome: string | null } {
    const t = texto.trim();
    const parenteses = /^(.+?)\s*\((.+)\)\s*$/.exec(t);
    if (parenteses) return { sigla: parenteses[1].trim(), nome: parenteses[2].trim() };
    const traco = /^(\S+)\s+[-–—]\s+(.+)$/.exec(t);
    if (traco) return { sigla: traco[1].trim(), nome: traco[2].trim() };
    return { sigla: t, nome: null };
}

/** O texto cita a sigla como PALAVRA ESCRITA EM MAIÚSCULAS? "Procuradoria Geral do Município - PGM"
 *  cita "PGM"; "Visita SEGES – diário oficial" cita "SEGES". Palavra minúscula ("de", "sme" no meio de
 *  outra) não conta — evita casar sigla curta por acaso. */
export function citaSigla(texto: string | null | undefined, sigla: string): boolean {
    const alvo = siglaComparavel(sigla);
    if (!texto || alvo.length < 2) return false;
    return texto
        .split(/[\s()[\]/,;:.–—-]+/)
        .some((palavra) => palavra.length >= 2 && palavra === palavra.toUpperCase() && siglaComparavel(palavra) === alvo);
}
