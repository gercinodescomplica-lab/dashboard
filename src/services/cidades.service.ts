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
    if (!lead.previsao_fechamento || String(lead.previsao_fechamento).trim() === '') {
        return null;
    }

    const raw = String(lead.previsao_fechamento).trim();

    // 1. Excel Serial Number (e.g. 46336 => 10/11/2026)
    const serialNum = Number(raw);
    if (!isNaN(serialNum) && serialNum > 20000 && serialNum < 70000) {
        const utcDate = new Date((serialNum - 25569) * 86400 * 1000);
        if (!isNaN(utcDate.getTime())) {
            return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
        }
    }

    // 2. YYYY-MM-DD or ISO
    const matchIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchIso) {
        return new Date(Number(matchIso[1]), Number(matchIso[2]) - 1, Number(matchIso[3]));
    }

    // 3. DD/MM/YYYY or DD/MM/YY
    const matchSlash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
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
            let rawCategoria = String(item.categoria_padrao || item.categoria || '').trim() || 'Lead';

            // Fix typos coming from Excel/SharePoint
            if (rawCategoria.toLowerCase() === 'em trataivas') {
                rawCategoria = 'Em tratativas';
            }

            // Clean city name extraction
            let municipioClean = String(item.municipio || '').trim();
            if (!municipioClean || municipioClean === '#VALUE!' || municipioClean === '#VALOR!') {
                const clienteStr = String(item.cliente || '').trim();
                const matchDe = clienteStr.match(/de\s+([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑa-záàâãéèêíïóôõöúçñ\s\-]+)/i);
                if (matchDe) {
                    municipioClean = matchDe[1].replace(/\s*\([A-Z]{2}\)\s*/i, '').trim();
                } else {
                    municipioClean = clienteStr
                        .replace(/^(Prefeitura|Câmara Municipal|Assembleia Legislativa|Secretaria|Governo)\s+(do|da|de|dos|das)?\s+/i, '')
                        .trim();
                }
            }

            const leadObj: LeadCidade = {
                id: item.id ? Number(item.id) : index + 1,
                cliente: String(item.cliente || '').trim(),
                solicitacao: String(item.solicitacao || '').trim(),
                status: String(item.status || '').trim(),
                categoria: rawCategoria,
                valor: parseValorBRL(item.valor),
                uf: rawUf,
                municipio: municipioClean,
                regiao: item.regiao ? String(item.regiao).trim() : undefined,
                contato_nome: item.contato_nome ? String(item.contato_nome).trim() : undefined,
                contato_email: item.contato_email ? String(item.contato_email).trim() : undefined,
                contato_telefone: item.contato_telefone ? String(item.contato_telefone).trim() : undefined,
                previsao_fechamento: item.previsao_fechamento ? String(item.previsao_fechamento).trim() : undefined,

                // Campos Padronizados Power Automate
                categoria_padrao: item.categoria_padrao ? String(item.categoria_padrao).trim() : undefined,
                etapa_padrao: item.etapa_padrao ? String(item.etapa_padrao).trim() : undefined,
                situacao_padrao: item.situacao_padrao ? String(item.situacao_padrao).trim() : undefined,
                motivo_padrao: item.motivo_padrao ? String(item.motivo_padrao).trim() : undefined,
                familia_demanda: item.familia_demanda ? String(item.familia_demanda).trim() : undefined,
                solicitacao_padrao: item.solicitacao_padrao ? String(item.solicitacao_padrao).trim() : undefined,
            };

            return leadObj;
        });
    } catch (error) {
        console.error('Erro ao buscar leads do Power Automate:', error);
        throw error;
    }
}
