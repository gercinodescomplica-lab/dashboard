import OpenAI from 'openai';

// DeepSeek expõe uma API compatível com a da OpenAI — usamos o SDK `openai`
// apontado pra base deles. NÃO usar o SDK da Anthropic aqui.
export const AI_MODEL = 'deepseek-chat';

export function getAiClient(): OpenAI {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY não configurada — assistente de IA indisponível.');
    }
    return new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey });
}
