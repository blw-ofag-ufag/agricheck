/* layout.js – inject header/footer, manage language & internal links -----*/

/* helper for localized text with fallback system ----------------------*/
window.getLocalizedText = (textObj, lang, fallbackWrapper = true) => {
  const fallbackOrder = [lang, 'de', 'fr', 'it'];
  for (const l of fallbackOrder) {
    if (textObj[l]) {
      if (l === lang || !fallbackWrapper) {
        return textObj[l];
      } else {
        return `${l.toUpperCase()}: <em>${textObj[l]}</em>`;
      }
    }
  }
  const anyLang = Object.keys(textObj)[0];
  return anyLang ? `<strong>${anyLang.toUpperCase()}:</strong> <em>${textObj[anyLang]}</em>` : '';
};


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

function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  });
}

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
  applyTranslations(document);
  patchLinks(lang);

  /* ---------- language dropdown -------------------------------------- */
  const curLabel = document.getElementById('currentLangLabel');
  if (curLabel) curLabel.textContent = lang.toUpperCase();

  document.querySelectorAll('.lang-option').forEach(a => {
    const code = a.dataset.lang;
    if (code === lang) a.classList.add('active');
    a.addEventListener('click', e => {
      e.preventDefault();
      if (code === window.__APP_LANG) return; // No change

      // Update state
      window.__APP_LANG = code;
      localStorage.setItem('akcLang', code);
      document.documentElement.lang = code;

      // Update UI
      window.__i18nReady = (async () => {
          const translationsAll = await fetch('i18n/translations.json').then(r => r.json());
          const translations    = translationsAll[code] || translationsAll['de'];
          window.t = key => translations[key] ?? key;
          return { lang: code };
      })();
      
      applyTranslations();
      patchLinks(code);
      curLabel.textContent = code.toUpperCase();
      document.querySelectorAll('.lang-option').forEach(el => el.classList.remove('active'));
      e.target.classList.add('active');

      // Trigger page-specific rerender if the function exists
      if (typeof window.rebuildPage === 'function') {
        window.rebuildPage(code);
      }
    });
  });

  /* ---------- keep ?lang= in all internal links ---------------------- */
  function patchLinks(currentLang) {
    document.querySelectorAll('a[href$=".html"]').forEach(a => {
      const raw = a.getAttribute('href');
      if (/^(https?:)?\/\//.test(raw) || raw.startsWith('/')) return;
      const u = new URL(raw, location.href);
      u.searchParams.set('lang', currentLang);
      a.setAttribute('href', u.pathname + u.search);
    });
  }
});