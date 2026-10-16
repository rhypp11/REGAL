/* Chargé avant les styles pour éviter un flash au changement de page. */
(() => {
  const key = 'jtd:theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try {
    const saved = localStorage.getItem(key);
    if(saved === 'light' || saved === 'dark') preference = saved;
  } catch { /* Le thème reste utilisable si le stockage est indisponible. */ }

  function apply(theme) {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#195e70');
    document.querySelector('link[rel="icon"]')?.setAttribute('href', dark ? 'logo-icon-dark.svg?v=regal-1' : 'logo-icon-light.svg?v=regal-1');
    document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', dark ? 'logo-icon-apple-dark.png?v=regal-1' : 'logo-icon-apple.png?v=regal-1');
    const button = document.getElementById('theme-toggle');
    if(button) {
      const label = dark ? 'Activer le thème clair' : 'Activer le thème sombre';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  }
  const current = () => preference || (system.matches ? 'dark' : 'light');
  apply(current());
  document.addEventListener('DOMContentLoaded', () => {
    apply(current());
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch { /* Choix valable pour cette session. */ }
      apply(preference);
    });
  });
  system.addEventListener('change', () => { if(!preference) apply(current()); });
  window.addEventListener('storage', event => {
    if(event.key === key || event.key === null) {
      preference = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : null;
      apply(current());
    }
  });
})();
