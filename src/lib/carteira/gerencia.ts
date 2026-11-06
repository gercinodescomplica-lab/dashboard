import { chaveDaGerencia } from '@/lib/integracao/chaves';
import type { CardGerencia } from './tipos';

/** A gerência do card: "GRC1", "GRCC", "KAM10"; fora do padrão GRC/KAM, o próprio role ("Tríade Digital"). */
export function chaveDaCarteira(card: { id: string; role: string }): string {
    return chaveDaGerencia(card.role) ?? chaveDaGerencia(card.id) ?? card.role.trim();
}

/** Formato de `contrato.gerencia`/`proposta.gerencia`: "GRC-1", "GRC-C", "KAM-4". */
export function textoDaGerencia(chave: string): string {
    const m = /^(GRC|KAM)([A-Z0-9]{1,2})$/.exec(chave);
    return m ? `${m[1]}-${m[2]}` : chave;
}

/** = `cardDaGerencia` do AIBertinho: os cards do maior ano; desses, o visível; senão o primeiro por id. */
export function cardDaGerencia<T extends CardGerencia>(cards: T[], chave: string): T | null {
    const daChave = cards.filter((c) => chaveDaCarteira(c) === chave);
    if (daChave.length === 0) return null;
    const ano = Math.max(...daChave.map((c) => c.year));
    const doAno = daChave.filter((c) => c.year === ano).sort((a, b) => a.id.localeCompare(b.id));
    return doAno.find((c) => c.showInDashboard) ?? doAno[0];
}

export function chavesDosCards(cards: CardGerencia[]): string[] {
    return [...new Set(cards.map(chaveDaCarteira))];
}
