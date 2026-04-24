import 'dotenv/config';
import { db } from './src/db/index';
import { storeProducts } from './src/db/schema';
import { eq } from 'drizzle-orm';

const PRODUCTS = [
    { n: 'Smart Sampa', d: 'DRM', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Segurança Pública' },
    { n: 'Tô Legal', d: 'DDS', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Urbanismo' },
    { n: 'Eleições', d: 'DDS', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Governança Eletrônica' },
    { n: 'WFS', d: 'DDS', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Produtividade Interna' },
    { n: 'Liferay', d: 'DDS', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Governança Eletrônica' },
    { n: 'VOIP + Teams', d: 'DIT', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Infraestrutura Digital' },
    { n: 'SD-WAN', d: 'DIT', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Infraestrutura Digital' },
    { n: 'Wifi Livre aaS', d: 'DIT', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Conectividade Urbana' },
    { n: 'DaaS (Arlequim)', d: 'DIT', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Infraestrutura Digital' },
    { n: 'Consultoria', d: 'DRM', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Infraestrutura Digital' },
    { n: 'Google Workspace', d: 'DRM', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Produtividade Interna' },
    { n: 'Office 365', d: 'DRM', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Produtividade Interna' },
    { n: 'Salesforce', d: 'DRM', s: 'store', f: 'Nov 2025', mkt: true, cat: 'Produtividade Interna' },
    { n: 'Backup as a Service', d: 'DIT', s: 'store', f: 'Dez 2025', mkt: true, cat: 'Infraestrutura Digital' },
    { n: 'Multicloud', d: 'DIT', s: 'store', f: 'Dez 2025', mkt: true, cat: 'Infraestrutura Digital' },
    { n: 'Geoportal', d: 'DDS', s: 'store', f: 'Mar 2026', mkt: true, cat: 'Urbanismo' },
    { n: 'ETL Geográfico', d: 'DDS', s: 'store', f: 'Mar 2026', mkt: true, cat: 'Infraestrutura Digital' },
    { n: 'Agendamento', d: 'DDS', s: 'store', f: 'Mar 2026', mkt: true, cat: 'Serviços ao Cidadão' },
    { n: 'Central de Notificações', d: 'DDS', s: 'store', f: 'Mar 2026', mkt: true, cat: 'Infraestrutura Digital' },
    { n: 'Delibera AI', d: 'DDS', s: 'store', f: 'Mar 2026', mkt: true, cat: 'IA' },
    { n: 'Reconhece AI', d: 'DDS', s: 'store', f: 'Mar 2026', mkt: true, cat: 'IA' },
    { n: 'Simplifica AI', d: 'DDS', s: 'store', f: 'Mar 2026', mkt: true, cat: 'IA' },
    { n: 'Virtualização de Dados', d: 'DIT', s: 'breve', f: 'Abr 2026', mkt: false, cat: 'Infraestrutura Digital' },
    { n: 'SAN/NAS', d: 'DIT', s: 'breve', f: 'Abr 2026', mkt: false, cat: 'Infraestrutura Digital' },
    { n: 'Observabilidade', d: 'DIT', s: 'breve', f: 'Abr 2026', mkt: false, cat: 'Infraestrutura Digital' },
    { n: 'Data Lake Prodam', d: 'DIT', s: 'breve', f: 'Mai 2026', mkt: false, cat: 'Dados' },
    { n: 'Fiscalização de lixo', d: 'PRE', s: 'breve', f: 'Mai 2026', mkt: false, cat: 'Meio Ambiente' },
    { n: 'Score Cobrança', d: 'DDS', s: 'breve', f: 'Mai 2026', mkt: false, cat: 'Finanças Públicas' },
    { n: 'Previne Saúde Servidor', d: 'DDS', s: 'breve', f: 'Mai 2026', mkt: false, cat: 'Saúde' },
    { n: 'SEI na Nuvem', d: 'DRM', s: 'breve', f: 'Jun 2026', mkt: false, cat: 'Governança Eletrônica' },
    { n: '156 City', d: 'DRM', s: 'breve', f: 'Jun 2026', mkt: false, cat: 'Serviços ao Cidadão' },
    { n: 'Digitalização Documentos', d: 'DIT', s: 'breve', f: 'Ago 2026', mkt: false, cat: 'Infraestrutura Digital' },
    { n: 'Gestão Ambiental', d: 'PRE', s: 'backlog', f: '—', mkt: false, cat: 'Meio Ambiente' },
    { n: 'Zeladoria', d: 'PRE', s: 'backlog', f: '—', mkt: false, cat: 'Urbanismo' },
    { n: 'Conversa AI', d: 'DDS', s: 'backlog', f: '—', mkt: false, cat: 'IA' },
    { n: 'Documenta AI', d: 'DDS', s: 'backlog', f: '—', mkt: false, cat: 'IA' },
    { n: 'Notifica AI', d: 'DDS', s: 'backlog', f: '—', mkt: false, cat: 'IA' },
    { n: 'Descomplica', d: 'DDS', s: 'backlog', f: '—', mkt: false, cat: 'Serviços ao Cidadão' },
    { n: 'Escola (Floripa)', d: 'DRM', s: 'backlog', f: '—', mkt: false, cat: 'Educação' },
    { n: 'Oracle', d: 'DRM', s: 'backlog', f: '—', mkt: false, cat: 'Infraestrutura Digital' },
    { n: 'Hospitais', d: 'DRM', s: 'backlog', f: '—', mkt: false, cat: 'Saúde' },
    { n: 'SMAE', d: 'DRM', s: 'backlog', f: '—', mkt: false, cat: 'Governança' },
    { n: 'Política de Dados', d: 'DRM', s: 'backlog', f: '—', mkt: false, cat: 'Dados' },
    { n: 'Consultoria Técnica Nuvem', d: 'DIT', s: 'backlog', f: '—', mkt: false, cat: 'Infraestrutura Digital' },
];

async function seed() {
    console.log('Seeding store pipeline data...');
    try {
        await db.delete(storeProducts);
        
        await db.insert(storeProducts).values(
            PRODUCTS.map(p => ({
                name: p.n,
                directorate: p.d as 'DDS' | 'DIT' | 'DRM' | 'PRE',
                status: p.s as 'store' | 'breve' | 'backlog',
                phase: p.f,
                marketplace: p.mkt,
                category: p.cat
            }))
        );
        console.log('Seed completed successfully. Inserted', PRODUCTS.length, 'products.');
    } catch (e) {
        console.error('Seed failed:', e);
    }
}

seed();
