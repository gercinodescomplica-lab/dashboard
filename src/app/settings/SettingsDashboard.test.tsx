// @vitest-environment jsdom
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CXItem, Manager, PipelineData, Project } from '@/types/manager';
import { fetchManagers } from '@/services/managers.service';
import { saveCXData, saveManagerData, saveVisitsData } from './actions';
import { getCXByManager } from './fetchActions';

vi.mock('@/services/managers.service', () => ({ fetchManagers: vi.fn() }));
vi.mock('./fetchActions', () => ({ getCXByManager: vi.fn() }));
vi.mock('./actions', () => ({
    saveManagerData: vi.fn(),
    saveCXData: vi.fn().mockResolvedValue({ success: true }),
    saveVisitsData: vi.fn().mockResolvedValue({ success: true }),
    saveChurnData: vi.fn().mockResolvedValue({ success: true }),
    cloneManager: vi.fn(),
}));
vi.mock('./chaveLocal', () => ({ lerChaveSettings: () => 'adm' }));
vi.mock('./ContractsEditor', () => ({ ContractsEditor: () => null }));
vi.mock('./ProposalsEditor', () => ({ ProposalsEditor: () => null }));
vi.mock('./OrgChartEditor', () => ({ OrgChartEditor: () => null }));
vi.mock('./FaturamentoEditor', () => ({ FaturamentoEditor: () => null }));
vi.mock('./PlannerUploadEditor', () => ({ PlannerUploadEditor: () => null }));
vi.mock('@/components/organograma-clientes/admin', () => ({ OrganogramaClientesAdmin: () => <div>admin da carteira</div> }));
vi.mock('./ManagerEditor', () => ({
    ManagerEditor: ({ manager, onChange, onExtrasCarregados, onSave, isSaving }: { manager: Manager; onChange: (m: Manager) => void; onExtrasCarregados: (e: Pick<Manager, 'cx' | 'visits' | 'churn'>) => void; onSave: () => void; isSaving: boolean }) => {
        // Como o editor real: carrega os extras ao montar, sem isso ser edição do admin.
        useEffect(() => {
            if (manager.cx === undefined) onExtrasCarregados({ cx: [cxDe(1, 'Antigo')], visits: [{ titulo: 'Visita', local: 'l', motivo: 'm', data: '2026-01-01' }], churn: [] });
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);
        return (
            <div>
                <input aria-label="Meta" value={manager.meta} onChange={(e) => onChange({ ...manager, meta: Number(e.target.value) })} />
                <p>Clientes: {(manager.servedClients ?? []).join(', ')}</p>
                <p>Projetos: {manager.pipeline.q1.projects.map((p) => p.name).join(', ')}</p>
                <p>CX: {(manager.cx ?? []).map((c) => c.titulo).join(', ')}</p>
                <p>Visitas: {manager.visits?.length ?? 'nao carregadas'}</p>
                <button onClick={onSave}>Salvar</button>
                <p>{isSaving ? 'gravando' : 'parado'}</p>
            </div>
        );
    },
}));
import { SettingsDashboard } from './SettingsDashboard';

const cxDe = (id: number, titulo: string): CXItem => ({ id, cliente: 'SMT', titulo, problema: 'p', solucaoProposta: 's', status: 'pendente' });
const pipeline = (projects: Project[] = []): PipelineData => ({ q1: { total: 0, projects }, q2: { total: 0, projects: [] }, q3: { total: 0, projects: [] }, q4: { total: 0, projects: [] }, nao_mapeado: { total: 0, projects: [] } });
const gerente = (d: Partial<Manager> = {}) => ({ id: 'g1', name: 'Barone', role: 'GRC3', meta: 10, servedClients: ['SMT'], pipeline: pipeline(), ...d }) as Manager;

async function irEVoltarDoOrganograma(user: ReturnType<typeof userEvent.setup>, frescos: Manager[]) {
    vi.mocked(fetchManagers).mockResolvedValueOnce(frescos);
    await user.click(screen.getByRole('button', { name: /Organograma de clientes/ }));
    expect(await screen.findByText('admin da carteira')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Barone/ }));
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCXByManager).mockResolvedValue([cxDe(1, 'Antigo')]);
    vi.mocked(saveManagerData).mockResolvedValue({ success: true });
});

describe('SettingsDashboard: sair do organograma de clientes', () => {
    it('card com edição não salva mantém a edição E ganha as linhas que chegaram', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente()]);
        render(<SettingsDashboard />);
        await screen.findByText('Visitas: 1');
        const meta = screen.getByLabelText('Meta');
        await user.clear(meta);
        await user.type(meta, '99');

        vi.mocked(getCXByManager).mockResolvedValue([cxDe(1, 'Antigo'), cxDe(2, 'Movido')]);
        await irEVoltarDoOrganograma(user, [gerente({ meta: 10, servedClients: ['SME'], pipeline: pipeline([{ name: 'Projeto SMT', value: 1 }]) })]);

        await waitFor(() => expect(screen.getByText('Clientes: SME')).toBeInTheDocument());
        expect(screen.getByLabelText('Meta')).toHaveValue('99');
        expect(screen.getByText('Projetos: Projeto SMT')).toBeInTheDocument();
        expect(screen.getByText('CX: Antigo, Movido')).toBeInTheDocument();
        expect(screen.getByText('Visitas: 1')).toBeInTheDocument();
    });

    it('card sem edição pega o objeto fresco; carregar os extras não conta como edição; visitas continuam', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente()]);
        render(<SettingsDashboard />);
        await screen.findByText('Visitas: 1');

        vi.mocked(getCXByManager).mockResolvedValue([cxDe(2, 'Movido')]);
        await irEVoltarDoOrganograma(user, [gerente({ meta: 77 })]);

        await waitFor(() => expect(screen.getByLabelText('Meta')).toHaveValue('77'));
        expect(screen.getByText('CX: Movido')).toBeInTheDocument();
        expect(screen.getByText('Visitas: 1')).toBeInTheDocument();
    });

    it('gerência nova aparece na lateral', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente()]);
        render(<SettingsDashboard />);
        await screen.findByText('Visitas: 1');
        await irEVoltarDoOrganograma(user, [gerente(), gerente({ id: 'g2', name: 'Ana Nova', role: 'GRC9' })]);
        expect(await screen.findByRole('button', { name: /Ana Nova/ })).toBeInTheDocument();
    });

    it('falha ao atualizar avisa para recarregar', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente()]);
        render(<SettingsDashboard />);
        await screen.findByText('Visitas: 1');
        vi.mocked(fetchManagers).mockRejectedValueOnce(new Error('rede'));
        await user.click(screen.getByRole('button', { name: /Organograma de clientes/ }));
        await user.click(screen.getByRole('button', { name: /Barone/ }));
        expect(await screen.findByText('Não foi possível atualizar os gerentes. Recarregue a página antes de salvar.')).toBeInTheDocument();
    });
});

describe('SettingsDashboard: salvar', () => {
    it('recusa do saveManagerData mostra o motivo e não grava o resto', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente()]);
        vi.mocked(saveManagerData).mockResolvedValueOnce({ success: false, erro: 'Para mudar a sigla, use Organograma de clientes.' });
        render(<SettingsDashboard />);
        await user.click(await screen.findByRole('button', { name: 'Salvar' }));
        expect(await screen.findByText('Para mudar a sigla, use Organograma de clientes.')).toBeInTheDocument();
        expect(saveCXData).not.toHaveBeenCalled();
    });

    it('o editor recebe o bloqueio durante o salvamento e a atualização', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente()]);
        render(<SettingsDashboard />);
        await screen.findByText('Visitas: 1');
        let liberarRecarga!: (m: Manager[]) => void;
        vi.mocked(fetchManagers).mockReturnValueOnce(new Promise((r) => { liberarRecarga = r; }));
        await user.click(screen.getByRole('button', { name: 'Salvar' }));
        expect(await screen.findByText('gravando')).toBeInTheDocument();
        liberarRecarga([gerente()]);
        expect(await screen.findByText('parado')).toBeInTheDocument();
    });

    it('CX gravado e visitas com falha: atualiza os ids e sair do organograma não dobra a lista', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente()]);
        render(<SettingsDashboard />);
        await screen.findByText('Visitas: 1');
        const meta = screen.getByLabelText('Meta');
        await user.clear(meta);
        await user.type(meta, '99');

        // Regravar troca o id da mesma linha de CX.
        vi.mocked(getCXByManager).mockResolvedValue([cxDe(10, 'Antigo')]);
        vi.mocked(saveVisitsData).mockRejectedValueOnce(new Error('falha'));
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente()]);
        await user.click(screen.getByRole('button', { name: 'Salvar' }));
        expect(await screen.findByText('Ocorreu um erro ao salvar os dados no banco. Tente novamente.')).toBeInTheDocument();

        await irEVoltarDoOrganograma(user, [gerente()]);
        await waitFor(() => expect(screen.getByText('parado')).toBeInTheDocument());
        expect(screen.getByText('CX: Antigo')).toBeInTheDocument();
        expect(screen.getByLabelText('Meta')).toHaveValue('99');
    });

    it('depois de salvar recarrega do banco: linha roteada para outro card entra no estado dele', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente()]);
        render(<SettingsDashboard />);
        await screen.findByText('Visitas: 1');
        const meta = screen.getByLabelText('Meta');
        await user.clear(meta);
        await user.type(meta, '99');
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente({ meta: 99, pipeline: pipeline([{ name: 'Do banco', value: 1 }]) })]);
        await user.click(screen.getByRole('button', { name: 'Salvar' }));
        expect(await screen.findByText('Projetos: Do banco')).toBeInTheDocument();
        expect(await screen.findByText('Sucesso!')).toBeInTheDocument();
    });
});
