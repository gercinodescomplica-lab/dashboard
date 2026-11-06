import { describe, it, expect } from 'vitest';
import { cardDaGerencia, chaveDaCarteira, chavesDosCards, textoDaGerencia } from './gerencia';

const card = (id: string, role: string, year = 2026, showInDashboard = true) => ({ id, name: id, role, year, showInDashboard });

describe('chaveDaCarteira', () => {
    it.each([
        [card('grc1-bruno', 'GRC1'), 'GRC1'],
        [card('grcc-debora', 'GRCC'), 'GRCC'],
        [card('kam3-gercino-teste', 'KAM10'), 'KAM10'],
        [card('x', 'GRC-4'), 'GRC4'],
        [card('projeto-triade', 'Tríade Digital'), 'Tríade Digital'],
    ])('%o → %s', (c, chave) => expect(chaveDaCarteira(c)).toBe(chave));
});

describe('textoDaGerencia', () => {
    it.each([['GRC1', 'GRC-1'], ['GRCC', 'GRC-C'], ['KAM4', 'KAM-4'], ['KAM10', 'KAM-10'], ['Tríade Digital', 'Tríade Digital']])(
        '%s → %s', (chave, texto) => expect(textoDaGerencia(chave)).toBe(texto));
});

describe('cardDaGerencia', () => {
    it('maior ano; no ano, o visível; senão o primeiro por id', () => {
        const cards = [card('grc4-velha', 'GRC4', 2025), card('grc4-b', 'GRC4', 2026, false), card('grc4-a', 'GRC4', 2026, false), card('grc4-beatriz', 'GRC4', 2026)];
        expect(cardDaGerencia(cards, 'GRC4')?.id).toBe('grc4-beatriz');
        expect(cardDaGerencia(cards.slice(0, 3), 'GRC4')?.id).toBe('grc4-a');
        expect(cardDaGerencia(cards, 'GRC9')).toBeNull();
    });
    it('chavesDosCards: uma por gerência, sem repetir', () => {
        expect(chavesDosCards([card('a', 'GRC1'), card('b', 'GRC1', 2025), card('c', 'KAM2')])).toEqual(['GRC1', 'KAM2']);
    });
});
