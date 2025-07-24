/* layout.js – injects header/footer, handles language + i18n ----------------*/
(async () => {
  /* ---------- language detection / persistence -------------------------- */
  const urlParams  = new URLSearchParams(location.search);
  const urlLang    = urlParams.get('lang');
  const storedLang = localStorage.getItem('akcLang');
  const lang       = (urlLang || storedLang || 'de').toLowerCase();

  /* expose globally */
  window.__APP_LANG = lang;
  document.documentElement.lang = lang;
  localStorage.setItem('akcLang', lang);

  /* ---------- inject header & footer ------------------------------------ */
  const [headerHTML, footerHTML] = await Promise.all([
    fetch('partials/header.html').then(r => r.text()),
    fetch('partials/footer.html').then(r => r.text())
  ]);

  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  document.body.insertAdjacentHTML('beforeend',  footerHTML);

  /* ---------- update navbar height CSS var ------------------------------ */
  const nav = document.querySelector('.navbar');
  if (nav) {
    document.documentElement.style
            .setProperty('--akc-navbar-h', nav.offsetHeight + 'px');
  }

  /* ---------- language selector logic ----------------------------------- */
  const curLabel = document.getElementById('currentLangLabel');
  if (curLabel) curLabel.textContent = lang.toUpperCase();

  document.querySelectorAll('.lang-option').forEach(a => {
    const langCode = a.dataset.lang;
    if (langCode === lang) a.classList.add('active');
    a.addEventListener('click', e => {
      e.preventDefault();
      const params = new URLSearchParams(location.search);
      params.set('lang', langCode);
      location.search = params.toString();     // reload with new lang
    });
  });

  /* ensure internal links carry ?lang= ----------------------------------- */
  function patchLinks() {
    document.querySelectorAll('a[href$=".html"]').forEach(a => {
      const href = new URL(a.getAttribute('href'), location.href);
      href.searchParams.set('lang', lang);
      a.setAttribute('href', href.pathname + href.search);
    });
  }
  patchLinks();

  /* ---------- load translations & apply --------------------------------- */
  const translationsAll = await fetch('i18n/translations.json').then(r => r.json());
  const translations    = translationsAll[lang] || translationsAll['de'];

  /* simple translator helper */
  window.t = key => translations[key] || key;

  function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.innerHTML = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });
  }
  applyTranslations(document);
})();
