// Tema claro/escuro e tamanho do texto.

export function applyAppearance(settings) {
  const root = document.documentElement;
  if (settings.theme === 'light' || settings.theme === 'dark') root.setAttribute('data-theme', settings.theme);
  else root.removeAttribute('data-theme');
  root.style.setProperty('--font-scale', String(settings.fontScale || 1));
}

export function effectiveTheme(settings) {
  if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
