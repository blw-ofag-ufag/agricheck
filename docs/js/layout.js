document.addEventListener('DOMContentLoaded', async () => {
    const [headerHTML, footerHTML] = await Promise.all([
      fetch('partials/header.html').then(r => r.text()),
      fetch('partials/footer.html').then(r => r.text())
    ]);
  
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
    document.body.insertAdjacentHTML('beforeend',  footerHTML);
  
    /* ► NOW the navbar exists – update the CSS custom property */
    const nav = document.querySelector('.navbar');
    if (nav) {
      document.documentElement
              .style.setProperty('--akc-navbar-h', nav.offsetHeight + 'px');
    }
  
    /* year stamp */
    const yearEl = document.getElementById('buildYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  });
  