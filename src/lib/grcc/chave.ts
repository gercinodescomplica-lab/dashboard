/** Confere a chave GRCC no servidor. O KeyGateGrcc só esconde a tela; quem protege é esta checagem. */
export function chaveGrccValida(chave: unknown): boolean {
    // Valor colado no painel da Vercel costuma vir com quebra de linha no fim; vazio após trim = fechado.
    const correta = process.env.GRCC_KEY?.trim();
    if (!correta || typeof chave !== 'string') return false;
    return chave.trim() === correta;
}
