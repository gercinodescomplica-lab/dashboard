'use client';
/** A chave que o KeyGate guardou. As actions do /settings conferem no servidor. */
export function lerChaveSettings(): string {
    try {
        return localStorage.getItem('SETTINGS_KEY') ?? '';
    } catch {
        return '';
    }
}
