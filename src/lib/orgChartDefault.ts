import type { OrgChartData } from '@/types/orgChart';

export const DEFAULT_ORG_CHART: OrgChartData = {
    version: '5.1',
    director: { name: 'LUZ', subtitle: 'Diretor' },
    subdirectors: [
        { id: 'sub-dani', name: 'DANI', subtitle: 'Maria', people: [] },
        { id: 'sub-alberto', name: 'ALBERTO', subtitle: 'Elias', people: [{ name: 'Manuela (estag.)' }] },
    ],
    departments: [
        {
            id: 'kam',
            name: 'KAM',
            subtitle: 'Key Account Manager',
            color: 'indigo',
            sections: [
                { id: 'kam-malde', name: 'MALDE', people: [{ name: 'Viviane' }, { name: 'Bruno (estag.)' }] },
                { id: 'kam-betone', name: 'BETONE', people: [{ name: 'Viviane' }, { name: 'Bruno (estag.)' }] },
                { id: 'kam-andrea', name: 'ANDREA', people: [{ name: 'Vera' }, { name: 'Thais (estag.)' }] },
                { id: 'kam-tomiatto', name: 'TOMIATTO', people: [{ name: 'Vera' }, { name: 'Thais (estag.)' }] },
            ],
        },
        {
            id: 'grc',
            name: 'GRC',
            subtitle: 'Gerência Rel. Comercial',
            color: 'emerald',
            sections: [
                { id: 'grc-bruno', name: 'grc1 BRUNO', people: [{ name: 'Tadahiro' }] },
                { id: 'grc-paulo', name: 'grc2 PAULO', people: [{ name: 'Marcilio' }, { name: 'Ingrid (estag.)' }] },
                { id: 'grc-barone', name: 'grc3 BARONE', people: [{ name: 'Andrea Farias' }, { name: 'Amanda (estag.)' }] },
                { id: 'grc-beatriz', name: 'grc4 BEATRIZ', people: [{ name: 'Renato' }] },
                { id: 'grc-debora', name: 'grcc DEBORA', people: [{ name: 'Bruna' }] },
            ],
        },
        {
            id: 'gcx',
            name: 'GCX',
            subtitle: 'Gerência Customer Exp.',
            color: 'amber',
            sections: [
                { id: 'gcx-lamana', name: 'LAMANA', people: [{ name: 'Denis' }, { name: 'Maria José' }, { name: 'Paulo' }] },
                {
                    id: 'gcx-nso',
                    name: 'NSO',
                    nucleoSubtitle: 'Núcleo Suporte Operacional',
                    isNucleo: true,
                    leader: { name: 'OSCAR' },
                    people: [{ name: 'Wania' }, { name: 'Lindomar' }],
                },
                { id: 'gcx-cobranca', name: 'COBRANÇA', people: [{ name: 'Salatiel' }] },
                { id: 'gcx-juridico', name: 'JURÍDICO', people: [{ name: 'Elizanete' }, { name: 'Mauro' }] },
            ],
        },
        {
            id: 'gin',
            name: 'GIN',
            subtitle: 'Gerência Inovação de Negócios',
            color: 'purple',
            sections: [
                {
                    id: 'gin-gercino',
                    name: 'GERCINO',
                    people: [
                        { name: 'Lucas', tag: 'em_contratacao' },
                        { name: 'Estagiária', tag: 'a_contratar' },
                    ],
                },
                {
                    id: 'gin-npe',
                    name: 'NPE',
                    nucleoSubtitle: 'Núcleo Projetos Especiais',
                    isNucleo: true,
                    leader: { name: 'VANESSA AVINO' },
                    people: [{ name: 'Roseane' }],
                },
            ],
        },
        {
            id: 'gdp',
            name: 'GDP',
            subtitle: 'Gerência de Produtização',
            color: 'pink',
            sections: [
                { id: 'gdp-pimentel', name: 'PIMENTEL', people: [{ name: 'Wanessa' }, { name: 'Flavio' }] },
                {
                    id: 'gdp-nps',
                    name: 'NPS',
                    nucleoSubtitle: 'Núcleo Produtos e Software',
                    isNucleo: true,
                    leader: { name: 'CLAUDIA' },
                    people: [{ name: 'Adriana Cristina' }, { name: 'Marcos Cesar' }],
                },
            ],
        },
    ],
};
