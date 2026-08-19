import { fetchAllPropostas, fetchManagersList } from '@/db/queries';
import { ProposalsPageClient } from './components/ProposalsPageClient';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Propostas — DRM',
    description: 'Pipeline comercial de propostas da Diretoria de Relacionamento e Mercado',
};

export default async function ProposalsPage() {
    const [propostas, managersList] = await Promise.all([
        fetchAllPropostas(),
        fetchManagersList(),
    ]);

    return <ProposalsPageClient propostas={propostas} managersList={managersList} />;
}
