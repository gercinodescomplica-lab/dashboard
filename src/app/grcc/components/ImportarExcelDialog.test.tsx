// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('read-excel-file', () => ({
    default: vi.fn().mockResolvedValue([
        ['Cliente', 'Solicitação', 'Valor', 'UF', 'Categoria'],
        ['Prefeitura de Indaiatuba', 'Consultoria', 'R$ 10,00', 'SP', 'No cliente'],
        ['', 'sem cliente', '1', 'SP', 'Novo'],
    ]),
    readSheetNames: vi.fn().mockResolvedValue(['Leads']),
}));
const confirmarImportacao = vi.fn().mockResolvedValue({ ok: true, valor: { novos: 1, alterados: 0, problemas: [] } });
vi.mock('../actions', () => ({ confirmarImportacao: (...a: unknown[]) => confirmarImportacao(...a) }));
vi.mock('../KeyGateGrcc', () => ({ useChaveGrcc: () => ({ chave: 'k', sair: () => {} }) }));

const { ImportarExcelDialog } = await import('./ImportarExcelDialog');

describe('ImportarExcelDialog', () => {
    it('lê, mostra prévia com problemas, exige confirmar o cutover e envia', async () => {
        const user = userEvent.setup();
        const onGravado = vi.fn().mockResolvedValue(undefined);
        render(
            <ImportarExcelDialog
                aberto
                leadsAtuais={[]}
                projetosManuais={[{ id: 1, orgao: 'ALESP', name: 'Chatbot', value: 10, quarter: 'q3' }]}
                onFechar={() => {}}
                onGravado={onGravado}
            />
        );
        const arquivo = new File(['x'], 'leads.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        await user.upload(screen.getByLabelText(/Arquivo \.xlsx/), arquivo);

        expect(await screen.findByText(/leads\.xlsx · 2 linhas lidas/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Novos 1/ })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Com problema 1/ }));
        expect(screen.getByText(/Linha 3: Cliente vazio/)).toBeInTheDocument();

        const gravar = screen.getByRole('button', { name: /Gravar 1 lead/ });
        expect(gravar).toBeDisabled();
        await user.click(screen.getByLabelText(/Substituir os 1 projetos digitados à mão/));
        expect(gravar).toBeEnabled();
        await user.click(gravar);

        await waitFor(() =>
            expect(confirmarImportacao).toHaveBeenCalledWith('k', expect.objectContaining({ arquivo: 'leads.xlsx', substituirPipelineManual: true }))
        );
        expect(onGravado).toHaveBeenCalledWith('1 novo, 0 atualizados.');
    });

    it('mostra erro em pt-BR e destrava o botão quando a gravação rejeita', async () => {
        confirmarImportacao.mockRejectedValueOnce(new Error('rede'));
        const user = userEvent.setup();
        const onGravado = vi.fn().mockResolvedValue(undefined);
        render(<ImportarExcelDialog aberto leadsAtuais={[]} projetosManuais={[]} onFechar={() => {}} onGravado={onGravado} />);
        await user.upload(screen.getByLabelText(/Arquivo \.xlsx/), new File(['x'], 'leads.xlsx'));
        await user.click(await screen.findByRole('button', { name: /Gravar 1 lead/ }));

        expect(await screen.findByText(/Não foi possível gravar a importação/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Gravar 1 lead/ })).toBeEnabled();
        expect(onGravado).not.toHaveBeenCalled();
    });

    it('depois de gravar mostra as linhas que o servidor recusou, em vez de fechar calado', async () => {
        confirmarImportacao.mockResolvedValueOnce({
            ok: true,
            valor: { novos: 1, alterados: 0, problemas: [{ linha: 7, cliente: 'Prefeitura de Jundiaí', motivo: 'Duração inválida.' }] },
        });
        const user = userEvent.setup();
        const onGravado = vi.fn().mockResolvedValue(undefined);
        const onFechar = vi.fn();
        render(<ImportarExcelDialog aberto leadsAtuais={[]} projetosManuais={[]} onFechar={onFechar} onGravado={onGravado} />);
        await user.upload(screen.getByLabelText(/Arquivo \.xlsx/), new File(['x'], 'leads.xlsx'));
        await user.click(await screen.findByRole('button', { name: /Gravar 1 lead/ }));

        expect(await screen.findByText(/1 linha não foi gravada/)).toBeInTheDocument();
        expect(screen.getByText(/Linha 7: Duração inválida\./)).toBeInTheDocument();
        expect(onGravado).toHaveBeenCalledWith('1 novo, 0 atualizados.');
        expect(onFechar).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: 'Fechar' }));
        expect(onFechar).toHaveBeenCalled();
    });

    it('falha ao atualizar a tela depois de gravar não mostra "não foi possível gravar"', async () => {
        const user = userEvent.setup();
        const onGravado = vi.fn().mockRejectedValue(new Error('refresh'));
        const onFechar = vi.fn();
        render(<ImportarExcelDialog aberto leadsAtuais={[]} projetosManuais={[]} onFechar={onFechar} onGravado={onGravado} />);
        await user.upload(screen.getByLabelText(/Arquivo \.xlsx/), new File(['x'], 'leads.xlsx'));
        await user.click(await screen.findByRole('button', { name: /Gravar 1 lead/ }));
        await waitFor(() => expect(onFechar).toHaveBeenCalled());
        expect(screen.queryByText(/Não foi possível gravar a importação/)).not.toBeInTheDocument();
    });
});
