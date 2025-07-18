document.addEventListener('DOMContentLoaded', async () => {
    const [headerHTML, footerHTML] = await Promise.all([
        fetch('partials/header.html').then(r => r.text()),
        fetch('partials/footer.html').then(r => r.text())
    ]);

    // Insert header before first child inside <body>
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
    // Append footer at the very end of <body>
    document.body.insertAdjacentHTML('beforeend', footerHTML);

    // set build year once footer exists
    const yearEl = document.getElementById('buildYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
});

