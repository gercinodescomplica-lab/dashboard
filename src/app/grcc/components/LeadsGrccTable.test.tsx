// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render as renderBase, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeadsGrccTable } from './LeadsGrccTable';
import { LEAD_VAZIO, type LeadGrcc } from '@/lib/grcc/tipos';

// A tabela abre agrupada por cidade; estes testes olham a lista plana.
const render = (ui: React.ReactElement) => {
    const r = renderBase(ui);
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    return r;
};

const mk = (id: number, over: Partial<LeadGrcc>): LeadGrcc => ({
    ...LEAD_VAZIO, visivelDashboard: true, id, criadoEm: '2026-10-01T00:00:00Z', atualizadoEm: '2026-10-20T00:00:00Z', ...over,
});

const leads = [
    mk(1, { cliente: 'Prefeitura de Indaiatuba', solicitacao: 'Consultoria', categoria: 'No cliente', valor: 260758.68, uf: 'SP', municipio: 'Indaiatuba', previsaoFechamento: '2026-11-10' }),
    mk(2, { cliente: 'ALESP', solicitacao: 'Chatbot', categoria: 'Em tratativas', valor: 0 }),
    mk(3, { cliente: 'Câmara de Osasco', solicitacao: 'Nuvem', categoria: 'Perda', motivoPerda: 'Prazo', valor: 5, uf: 'SP', municipio: 'Osasco' }),
];

describe('LeadsGrccTable', () => {
    it('mostra chips com contagem e filtra por categoria e por pendências', async () => {
        const user = userEvent.setup();
        render(<LeadsGrccTable leads={leads} onAbrir={() => {}} />);
        expect(screen.getAllByRole('row')).toHaveLength(4); // cabeçalho + 3

        await user.click(screen.getByRole('button', { name: /Perda 1/ }));
        expect(screen.getAllByRole('row')).toHaveLength(2);

        await user.click(screen.getByRole('button', { name: /Pendências 1/ }));
        const linhas = screen.getAllByRole('row').slice(1);
        expect(linhas).toHaveLength(1);
        expect(within(linhas[0]).getByText('ALESP')).toBeInTheDocument();
    });

    it('busca por cliente/solicitação/município sem acento', async () => {
        const user = userEvent.setup();
        render(<LeadsGrccTable leads={leads} onAbrir={() => {}} />);
        await user.type(screen.getByPlaceholderText(/Buscar/), 'camara')
        expect(screen.getAllByRole('row')).toHaveLength(2);
    });

    it('linha mostra o último andamento e o que falta no cadastro', () => {
        render(<LeadsGrccTable leads={[mk(9, { cliente: 'Prefeitura X', status: 'Reunião 02/11', uf: 'SP' })]} onAbrir={() => {}} />);
        expect(screen.getByText('Reunião 02/11')).toBeInTheDocument();
        expect(screen.getByText('Falta: município, valor, previsão')).toBeInTheDocument();
    });

    it('"Por cidade" agrupa com "Sem cidade" primeiro e o filtro continua valendo', async () => {
        const user = userEvent.setup();
        render(<LeadsGrccTable leads={leads} onAbrir={() => {}} />);
        await user.click(screen.getByRole('button', { name: 'Por cidade' }));
        const grupos = screen.getAllByRole('rowheader').map((g) => g.textContent);
        expect(grupos).toEqual([
            expect.stringMatching(/^Sem cidade.*1 lead/),
            expect.stringMatching(/^Indaiatuba · SP.*1 lead/),
            expect.stringMatching(/^Osasco · SP.*1 lead/),
        ]);
        await user.click(screen.getByRole('button', { name: /Perda 1/ }));
        expect(screen.getAllByRole('rowheader').map((g) => g.textContent)).toEqual([expect.stringMatching(/^Osasco · SP/)]);
    });

    it('clique na linha abre o lead', async () => {
        const user = userEvent.setup();
        const onAbrir = vi.fn();
        render(<LeadsGrccTable leads={leads} onAbrir={onAbrir} />);
        await user.click(screen.getByText('Prefeitura de Indaiatuba'));
        expect(onAbrir).toHaveBeenCalledWith(1);
    });

    it('tooltip da temperatura distingue automática pela proposta da automática pela categoria', () => {
        render(
            <LeadsGrccTable
                leads={[
                    mk(20, { cliente: 'A', categoria: 'Novo', uf: 'SP', municipio: 'Limeira' }),
                    mk(21, { cliente: 'B', categoria: 'Novo', propostaEnviadaEm: '2026-01-01', uf: 'SP', municipio: 'Campinas' }),
                ]}
                onAbrir={() => {}}
            />
        );
        const tooltip = (cliente: string) => screen.getByText(cliente).closest('tr')!.querySelector('[title^="No pipeline"]')!.getAttribute('title');
        expect(tooltip('A')).toMatch(/automática pela categoria/);
        expect(tooltip('B')).toMatch(/automática pela data de envio da proposta/);
    });
});

describe('LeadsGrccTable — visão inicial', () => {
    it('abre agrupada por cidade', () => {
        renderBase(<LeadsGrccTable leads={[mk(1, { cliente: 'X', uf: 'SP', municipio: 'Limeira' })]} onAbrir={() => {}} />);
        expect(screen.getByRole('button', { name: 'Por cidade' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('rowheader')[0]).toHaveTextContent(/Limeira · SP/);
    });
});
