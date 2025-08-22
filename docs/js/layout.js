/* layout.js – inject header/footer, manage language & internal links -----*/

/* helper for localized text with fallback system ----------------------*/
window.getLocalizedText = (textObj, lang, fallbackWrapper = true) => {
  const fallbackOrder = [lang, 'de', 'fr', 'it'];
  for (const l of fallbackOrder) {
    if (textObj[l]) {
      if (l === lang || !fallbackWrapper) {
        return textObj[l];
      } else {
        return `<strong>${l.toUpperCase()}:</strong> <em>${textObj[l]}</em>`;
      }
    }
  }
  const anyLang = Object.keys(textObj)[0];
  return anyLang ? `<strong>${anyLang.toUpperCase()}:</strong> <em>${textObj[anyLang]}</em>` : '';
};


/* expose a promise so other modules can await initial translations ------*/
window.__i18nReady = (async () => {
  const urlParams  = new URLSearchParams(location.search);
  const urlLang    = urlParams.get('lang');
  const storedLang = localStorage.getItem('akcLang');
  const lang       = (urlLang || storedLang || 'de').toLowerCase();

  window.__APP_LANG = lang;
  document.documentElement.lang = lang;
  localStorage.setItem('akcLang', lang);

  const translationsAll = await fetch('i18n/translations.json').then(r => r.json());
  return { lang, translationsAll };
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

  /* wait until initial language and all translations are ready --------*/
  const { lang: initialLang, translationsAll } = await window.__i18nReady;

  /* define the global translation function `t` for the first time -----*/
  window.t = key => (translationsAll[initialLang] || translationsAll['de'])[key] ?? key;

  function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.innerHTML = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });
  }
  applyTranslations(document); // Initial translation run

  function patchLinks(currentLang) {
    document.querySelectorAll('a[href$=".html"]').forEach(a => {
      const raw = a.getAttribute('href');
      if (/^(https?:)?\/\//.test(raw) || raw.startsWith('/')) return;
      const u = new URL(raw, location.href);
      u.searchParams.set('lang', currentLang);
      a.setAttribute('href', u.pathname + u.search);
    });
  }
  patchLinks(initialLang); // Initial link patching

  /* ---------- language dropdown -------------------------------------- */
  const curLabel = document.getElementById('currentLangLabel');
  if (curLabel) curLabel.textContent = initialLang.toUpperCase();

  document.querySelectorAll('.lang-option').forEach(a => {
    const code = a.dataset.lang;
    if (code === initialLang) a.classList.add('active');

    a.addEventListener('click', e => {
      e.preventDefault();
      const newLang = a.dataset.lang;
      if (newLang === window.__APP_LANG) return;

      // 1. Update global state
      window.__APP_LANG = newLang;
      localStorage.setItem('akcLang', newLang);
      document.documentElement.lang = newLang;

      // 2. Update the URL without reloading the page
      const url = new URL(location.href);
      url.searchParams.set('lang', newLang);
      history.pushState({}, '', url.toString());

      // 3. Update the `t` function and re-apply all static translations
      window.t = key => (translationsAll[newLang] || translationsAll['de'])[key] ?? key;
      applyTranslations(document);

      // 4. Update the language selector's UI
      curLabel.textContent = newLang.toUpperCase();
      document.querySelectorAll('.lang-option').forEach(el => el.classList.remove('active'));
      a.classList.add('active');

      // 5. Update internal links to carry the new language parameter
      patchLinks(newLang);

      // 6. Trigger a re-render of the page's dynamic content
      if (typeof window.rebuildPage === 'function') {
        window.rebuildPage(newLang);
      }
    });
  });
});