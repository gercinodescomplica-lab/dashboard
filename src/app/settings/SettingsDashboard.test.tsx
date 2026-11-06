// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Manager } from '@/types/manager';
import { fetchManagers } from '@/services/managers.service';
import { saveCXData, saveManagerData } from './actions';

vi.mock('@/services/managers.service', () => ({ fetchManagers: vi.fn() }));
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
    ManagerEditor: ({ manager, onChange, onSave }: { manager: Manager; onChange: (m: Manager) => void; onSave: () => void }) => (
        <div>
            <input aria-label="Meta" value={manager.meta} onChange={(e) => onChange({ ...manager, meta: Number(e.target.value) })} />
            <p>Clientes: {(manager.servedClients ?? []).join(', ')}</p>
            <button onClick={onSave}>Salvar</button>
        </div>
    ),
}));
import { SettingsDashboard } from './SettingsDashboard';

const gerente = (d: Partial<Manager> = {}) => ({ id: 'g1', name: 'Barone', role: 'GRC3', meta: 10, servedClients: ['SMT'], ...d }) as Manager;

beforeEach(() => vi.clearAllMocks());

describe('SettingsDashboard', () => {
    it('ao sair do organograma de clientes atualiza só servedClients e preserva o que não foi salvo', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente()]);
        render(<SettingsDashboard />);
        const meta = await screen.findByLabelText('Meta');
        await user.clear(meta);
        await user.type(meta, '99');

        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente({ meta: 10, servedClients: ['SME'] })]);
        await user.click(screen.getByRole('button', { name: /Organograma de clientes/ }));
        expect(await screen.findByText('admin da carteira')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Barone/ }));

        await waitFor(() => expect(screen.getByText('Clientes: SME')).toBeInTheDocument());
        expect(screen.getByLabelText('Meta')).toHaveValue('99');
    });

    it('recusa do saveManagerData mostra o motivo e não grava o resto', async () => {
        const user = userEvent.setup();
        vi.mocked(fetchManagers).mockResolvedValueOnce([gerente()]);
        vi.mocked(saveManagerData).mockResolvedValueOnce({ success: false, erro: 'Para mudar a sigla, use Organograma de clientes.' });
        render(<SettingsDashboard />);
        await user.click(await screen.findByRole('button', { name: 'Salvar' }));
        expect(await screen.findByText('Para mudar a sigla, use Organograma de clientes.')).toBeInTheDocument();
        expect(saveCXData).not.toHaveBeenCalled();
    });
});
