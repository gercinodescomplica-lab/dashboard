/**
 * Formats a number to Brazilian Real (R$) currency format
 * @param value The value in cents or decimal form. Assumes it's an integer representing the real value directly (e.g., 125800000 = R$ 125.800.000,00 as per prompt). 
 */
export function formatCurrency(value: number): string {
    // Assuming the value is already in standard units (reais), considering the prompt: "Valores em centavos NÃO (usar inteiro em reais)."
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

/**
 * Formats a decimal number into a percentage string
 * @param value The value to format (e.g., 0.95 for 95%) or an already full percentage (e.g., 95.5 for 95.5%)
 * @param isDecimal Indicates if the value is a decimal (0.95) instead of a full percentage (95). Default: false since the calc function returns the full percentage.
 */
export function formatPercentage(value: number, isDecimal = false): string {
    const percentage = isDecimal ? value * 100 : value;
    return new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(percentage / 100);
}
