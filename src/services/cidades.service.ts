import { LeadCidade } from '@/types/cidades';

const POWER_AUTOMATE_WEBHOOK_URL =
    'https://defaultf398df9cfd0c4829a003c770a1c4a0.63.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/21/workflows/9ad9dafb5bac4037b04525986e5dd90d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pMVdMdCn51gKzPLrvMDgyFCXgTsMHtlV3PuutquZB7Q';

/**
 * Robust BRL financial numbers parser coming from Excel / Power Automate
 * Handles formats like: " R$ 9.099.830,44", "349,020,12", "1.047,060,36", "4239525,6"
 */
export function parseValorBRL(valor: any): number {
    if (typeof valor === 'number') return isNaN(valor) ? 0 : valor;
    if (!valor) return 0;
    const s = String(valor).trim();
    if (!s) return 0;

    // Strip "R$", currency symbols, spaces, keeping only numbers, dots, and commas
    const clean = s.replace(/[^0-9.,]/g, '');
    if (!clean) return 0;

    let formatted = clean;
    if (clean.includes(',')) {
        const parts = clean.split(',');
        const decimal = parts[parts.length - 1];
        const integer = parts.slice(0, parts.length - 1).join('').replace(/\./g, '');
        formatted = `${integer}.${decimal}`;
    } else if (clean.includes('.')) {
        const lastDotIndex = clean.lastIndexOf('.');
        const decimalPart = clean.substring(lastDotIndex + 1);
        if (decimalPart.length === 2) {
            const intPart = clean.substring(0, lastDotIndex).replace(/\./g, '');
            formatted = `${intPart}.${decimalPart}`;
        } else {
            formatted = clean.replace(/\./g, '');
        }
    }

    const num = Number(formatted);
    return isNaN(num) ? 0 : num;
}

/**
 * Date parser for leads.
 * Strictly parses explicit previsao_fechamento field.
 */
export function extractLeadDate(lead: { previsao_fechamento?: string }): Date | null {
    if (!lead.previsao_fechamento || lead.previsao_fechamento.trim() === '') {
        return null;
    }

    const raw = lead.previsao_fechamento.trim();

    // 1. Excel Serial Number (e.g. 46260 => 2026-08-26)
    const serialNum = Number(raw);
    if (!isNaN(serialNum) && serialNum > 20000 && serialNum < 70000) {
        const parsedExcelDate = new Date((serialNum - (25567 + 2)) * 86400 * 1000);
        if (!isNaN(parsedExcelDate.getTime())) {
            return parsedExcelDate;
        }
    }

    // 2. YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    // 3. DD/MM/YYYY or DD/MM/YY
    const matchSlash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (matchSlash) {
        let y = parseInt(matchSlash[3], 10);
        if (y < 100) y += 2000;
        return new Date(y, parseInt(matchSlash[2], 10) - 1, parseInt(matchSlash[1], 10));
    }

    // 4. Text formatted dates
    const parsedJsDate = new Date(raw);
    if (!isNaN(parsedJsDate.getTime())) {
        return parsedJsDate;
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

        const validItems = rawData.filter((item: any) => {
            const cliente = String(item.cliente || '').trim();
            const solicitacao = String(item.solicitacao || '').trim();
            const status = String(item.status || '').trim();
            const municipio = String(item.municipio || '').trim();
            const uf = String(item.uf || '').trim();
            const valor = parseValorBRL(item.valor);

            // Ignore section divider / title rows (e.g., 'Propostas Perdidas' header row in Excel)
            if (cliente.toLowerCase() === 'propostas perdidas' && !solicitacao && !status && !uf) {
                return false;
            }

            return cliente !== '' || solicitacao !== '' || municipio !== '' || valor > 0;
        });

        return validItems.map((item: any, index: number) => {
            const rawUf = String(item.uf || '').trim().toUpperCase();
            let rawCategoria = String(item.categoria || '').trim() || 'Lead';

            // Fix typos coming from Excel/SharePoint
            if (rawCategoria.toLowerCase() === 'em trataivas') {
                rawCategoria = 'Em tratativas';
            }

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

            return leadObj;
        });
    } catch (error) {
        console.error('Erro ao buscar leads do Power Automate:', error);
        throw error;
    }
}
