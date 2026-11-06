/** Confere a chave do admin no servidor (mesma regra do `verifySettingsKey`). O KeyGate só esconde a tela. */
export function chaveSettingsValida(chave: unknown): boolean {
    if (typeof chave !== 'string' || !chave.trim()) return false;
    const t = chave.trim();
    const correta = process.env.SETTINGS_KEY || 'prodam2026';
    const diretoria = process.env.DIRETORIA_KEY;
    const directorate = process.env.DIRECTORATE_KEY;
    return t === correta || (!!diretoria && t === diretoria) || (!!directorate && t === directorate);
}
