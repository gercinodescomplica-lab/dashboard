import { fetchAllContratos } from '@/db/queries';
import { ContractsPageClient } from './components/ContractsPageClient';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Contratos — DRM',
    description: 'Gestão de contratos da Diretoria de Relacionamento e Mercado',
};

export default async function ContractsPage() {
    const contratos = await fetchAllContratos();

    return <ContractsPageClient contratos={contratos} />;
}
