/* layout.js – inject header/footer, manage language & internal links -----*/

/* expose a promise so other modules can await translations --------------*/
window.__i18nReady = (async () => {
  const urlParams  = new URLSearchParams(location.search);
  const urlLang    = urlParams.get('lang');
  const storedLang = localStorage.getItem('akcLang');
  const lang       = (urlLang || storedLang || 'de').toLowerCase();

  window.__APP_LANG          = lang;
  document.documentElement.lang = lang;
  localStorage.setItem('akcLang', lang);

  const translationsAll = await fetch('i18n/translations.json').then(r => r.json());
  const translations    = translationsAll[lang] || translationsAll['de'];
  window.t = key => translations[key] ?? key;

  return { lang };
})();

/* ----------------------------------------------------------------------*/
document.addEventListener('DOMContentLoaded', async () => {
  /* inject header / footer -------------------------------------------- */
  const [headerHTML, footerHTML] = await Promise.all([
    fetch('partials/header.html').then(r => r.text()),
    fetch('partials/footer.html').then(r => r.text())
  ]);
  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  document.body.insertAdjacentHTML('beforeend',  footerHTML);

  /* navbar‑height CSS variable ---------------------------------------- */
  const nav = document.querySelector('.navbar');
  if (nav) {
    document.documentElement.style
            .setProperty('--akc-navbar-h', nav.offsetHeight + 'px');
  }

  /* wait until translations exist, then translate static markup --------*/
  const { lang } = await window.__i18nReady;

  function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.innerHTML = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });
  }
  applyTranslations(document);

  /* ---------- language dropdown -------------------------------------- */
  const curLabel = document.getElementById('currentLangLabel');
  if (curLabel) curLabel.textContent = lang.toUpperCase();

  document.querySelectorAll('.lang-option').forEach(a => {
    const code = a.dataset.lang;
    if (code === lang) a.classList.add('active');
    a.addEventListener('click', e => {
      e.preventDefault();
      const params = new URLSearchParams(location.search);
      params.set('lang', code);
      location.search = params.toString();          // reload in new lang
    });
  });

  /* ---------- keep ?lang= in all internal links ---------------------- */
  function patchLinks() {
    /* base directory of current file, incl. trailing slash              */
    const baseDir = location.pathname.replace(/[^/]*$/, '');

    document.querySelectorAll('a[href$=".html"]').forEach(a => {
      const raw = a.getAttribute('href');

      /* skip absolute URLs or “rooted” paths that already start with / */
      if (/^(https?:)?\/\//.test(raw) || raw.startsWith('/')) return;

      /* resolve relative link *against the full current URL*           */
      const u = new URL(raw, location.href);        // keeps /s/…/docs/…
      u.searchParams.set('lang', lang);

      /* set absolute path incl. dir + query – keeps env sub‑path       */
      a.setAttribute('href', u.pathname + u.search);
    });
  }
  patchLinks();
});
