/* layout.js – injects header/footer, manages language + i18n --------------*/

/* ── expose a promise that resolves when translations + t() are ready ── */
window.__i18nReady = (async () => {
  /* chosen UI‑language --------------------------------------------------- */
  const urlParams  = new URLSearchParams(location.search);
  const urlLang    = urlParams.get('lang');
  const storedLang = localStorage.getItem('akcLang');
  const lang       = (urlLang || storedLang || 'de').toLowerCase();

  window.__APP_LANG          = lang;
  document.documentElement.lang = lang;
  localStorage.setItem('akcLang', lang);

  /* fetch translations JSON --------------------------------------------- */
  const translationsAll = await fetch('i18n/translations.json').then(r => r.json());
  const translations    = translationsAll[lang] || translationsAll['de'];

  /* tiny helper made global                                             */
  window.t = key => translations[key] ?? key;

  return { lang, translations };
})();

/* ── main initialisation routine – runs after DOMContentLoaded ───────────*/
document.addEventListener('DOMContentLoaded', async () => {

  /* inject header & footer ---------------------------------------------- */
  const [headerHTML, footerHTML] = await Promise.all([
    fetch('partials/header.html').then(r => r.text()),
    fetch('partials/footer.html').then(r => r.text())
  ]);

  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  document.body.insertAdjacentHTML('beforeend',  footerHTML);

  /* navbar height → CSS var --------------------------------------------- */
  const nav = document.querySelector('.navbar');
  if (nav) {
    document.documentElement.style
            .setProperty('--akc-navbar-h', nav.offsetHeight + 'px');
  }

  /* wait for i18n; then translate static markup ------------------------- */
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

  /* language selector ---------------------------------------------------- */
  const curLabel = document.getElementById('currentLangLabel');
  if (curLabel) curLabel.textContent = lang.toUpperCase();

  document.querySelectorAll('.lang-option').forEach(a => {
    const code = a.dataset.lang;
    if (code === lang) a.classList.add('active');
    a.addEventListener('click', e => {
      e.preventDefault();
      const params = new URLSearchParams(location.search);
      params.set('lang', code);
      location.search = params.toString();     // reload – new language
    });
  });

  /* internal links should carry ?lang= ---------------------------------- */
  function patchLinks() {
    document.querySelectorAll('a[href$=".html"]').forEach(a => {
      const href = new URL(a.getAttribute('href'), location);
      href.searchParams.set('lang', lang);
      a.setAttribute('href', href.pathname + href.search);
    });
  }
  patchLinks();
});
