// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox } from './combobox';

function Teste({ aoEscolher }: { aoEscolher: (s: string) => void }) {
    const [t, setT] = useState('');
    const opcoes = ['SME', 'SMS', 'SMT'].filter((o) => o.toLowerCase().includes(t.toLowerCase()));
    return <Combobox rotulo="Cliente" placeholder="Buscar" valor={t} aoMudarTexto={setT} opcoes={opcoes} chave={(o) => o} rotuloDe={(o) => o} aoEscolher={aoEscolher} vazio="Nada" />;
}

describe('Combobox', () => {
    it('filtra, escolhe com clique e mostra vazio', async () => {
        const escolher = vi.fn();
        const user = userEvent.setup();
        render(<Teste aoEscolher={escolher} />);
        await user.type(screen.getByRole('combobox', { name: 'Cliente' }), 'smt');
        await user.click(screen.getByRole('option', { name: 'SMT' }));
        expect(escolher).toHaveBeenCalledWith('SMT');
        await user.clear(screen.getByRole('combobox', { name: 'Cliente' }));
        await user.type(screen.getByRole('combobox', { name: 'Cliente' }), 'zzz');
        expect(screen.getByText('Nada')).toBeInTheDocument();
    });
});
