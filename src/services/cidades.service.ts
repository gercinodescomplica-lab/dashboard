import { LeadCidade } from '@/types/cidades';

const POWER_AUTOMATE_WEBHOOK_URL =
    'https://defaultf398df9cfd0c4829a003c770a1c4a0.63.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/21/workflows/9ad9dafb5bac4037b04525986e5dd90d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pMVdMdCn51gKzPLrvMDgyFCXgTsMHtlV3PuutquZB7Q';

/**
 * Parses BRL financial numbers coming from Excel (e.g. "260758,68" or "1.606.531,58")
 */
export function parseValorBRL(valor: any): number {
    if (typeof valor === 'number') return isNaN(valor) ? 0 : valor;
    if (!valor) return 0;
    const str = String(valor).trim().replace(/\./g, '').replace(',', '.');
    const num = Number(str);
    return isNaN(num) ? 0 : num;
}

/**
 * Intelligent date parser for leads.
 * Checks explicit previsao_fechamento field, or extracts embedded date from status string (e.g. "Proposta no cliente 17/03/26").
 */
export function extractLeadDate(lead: { previsao_fechamento?: string; status?: string }): Date | null {
    // 1. Check explicit field previsao_fechamento
    if (lead.previsao_fechamento && lead.previsao_fechamento.trim() !== '') {
        const raw = lead.previsao_fechamento.trim();

        // 1a. Excel Serial Number (e.g. 46260 => 2026-08-26)
        const serialNum = Number(raw);
        if (!isNaN(serialNum) && serialNum > 20000 && serialNum < 70000) {
            const parsedExcelDate = new Date((serialNum - (25567 + 2)) * 86400 * 1000);
            if (!isNaN(parsedExcelDate.getTime())) {
                return parsedExcelDate;
            }
        }

        // 1b. YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const [y, m, d] = raw.split('-').map(Number);
            return new Date(y, m - 1, d);
        }

        // 1c. DD/MM/YYYY or DD/MM/YY
        const matchSlash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (matchSlash) {
            let y = parseInt(matchSlash[3], 10);
            if (y < 100) y += 2000;
            return new Date(y, parseInt(matchSlash[2], 10) - 1, parseInt(matchSlash[1], 10));
        }

        // 1d. Text formatted dates (e.g. "Wednesday, August 26, 2026" or "26 de Agosto de 2026")
        const parsedJsDate = new Date(raw);
        if (!isNaN(parsedJsDate.getTime())) {
            return parsedJsDate;
        }
    }

    // 2. Extract embedded date from status field if previsao_fechamento is empty
    if (lead.status) {
        const matches = lead.status.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g);
        if (matches && matches.length > 0) {
            for (const m of matches) {
                const parts = m.split('/');
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                let year = parts[2] ? parseInt(parts[2], 10) : 2026;
                if (year < 100) year += 2000;

                // Validate realistic date numbers
                if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                    return new Date(year, month - 1, day);
                }
            }
        }
    }

    return null;
}

export async function fetchCidadesLeads(): Promise<LeadCidade[]> {
    try {
        const response = await fetch(POWER_AUTOMATE_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
        }

        const rawData = await response.json();

        if (!Array.isArray(rawData)) {
            console.error('Formato inesperado retornado pelo Power Automate:', rawData);
            return [];
        }

        return rawData.map((item: any, index: number) => {
            const rawUf = String(item.uf || '').trim().toUpperCase();
            const rawCategoria = String(item.categoria || '').trim() || 'Lead';

            const leadObj = {
                id: item.id ? Number(item.id) : index + 1,
                cliente: String(item.cliente || '').trim(),
                solicitacao: String(item.solicitacao || '').trim(),
                status: String(item.status || '').trim(),
                categoria: rawCategoria,
                valor: parseValorBRL(item.valor),
                uf: rawUf,
                municipio: String(item.municipio || '').trim(),
                regiao: item.regiao ? String(item.regiao).trim() : undefined,
                contato_nome: item.contato_nome ? String(item.contato_nome).trim() : undefined,
                contato_email: item.contato_email ? String(item.contato_email).trim() : undefined,
                contato_telefone: item.contato_telefone ? String(item.contato_telefone).trim() : undefined,
                previsao_fechamento: item.previsao_fechamento ? String(item.previsao_fechamento).trim() : undefined,
            };

            // If previsao_fechamento was blank, enrich with parsed date from status
            if (!leadObj.previsao_fechamento) {
                const extractedDate = extractLeadDate(leadObj);
                if (extractedDate) {
                    const yyyy = extractedDate.getFullYear();
                    const mm = String(extractedDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(extractedDate.getDate()).padStart(2, '0');
                    leadObj.previsao_fechamento = `${yyyy}-${mm}-${dd}`;
                }
            }

            return leadObj;
        });
    } catch (error) {
        console.error('Erro ao buscar leads do Power Automate:', error);
        throw error;
    }
}
