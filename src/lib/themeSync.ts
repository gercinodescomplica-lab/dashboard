// Sincroniza o fundo do <body> com o tema escolhido pelo usuário.
//
// O globals.css força o fundo do <body> para escuro sempre (`--background` fixo em :root,
// "Force dark theme tokens globally"), independente do que os componentes React escolhem.
// Isso é intencional para manter o escuro (padrão) inalterado, mas significa que, quando o
// tema claro está ativo, qualquer área fora dos containers das telas (ex.: bounce de scroll,
// espaços fora do conteúdo) mostrava o fundo escuro do <body> por baixo.
//
// Esta função só ajusta o background do <body> via style inline — nunca mexe no CSS/tema
// escuro em si (o valor de escuro nunca é alterado, só removemos o override quando não é claro).
export const THEME_STORAGE_KEY = 'aibertinho-theme';
// Disparado em cada applyBodyTheme — dá pra qualquer componente montado fora das
// telas que trocam o tema (ex.: AiChatWidget, montado uma vez no layout raiz)
// reagir a uma troca feita depois do seu mount, sem precisar de um provider global.
export const THEME_CHANGE_EVENT = 'aibertinho-theme-change';

export function applyBodyTheme(theme: 'dark' | 'light') {
    if (typeof document === 'undefined') return;
    document.body.style.backgroundColor = theme === 'light' ? '#ffffff' : '';
    window.dispatchEvent(new CustomEvent<'dark' | 'light'>(THEME_CHANGE_EVENT, { detail: theme }));
}
