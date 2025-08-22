/* checklist.js – builds list, fills date, handles toolbar actions --------*/
import { fetchBindings, buildNodeMap } from './model.js';

/* wait for i18n before anything else */
await window.__i18nReady;

const BASE_URI = 'https://agriculture.ld.admin.ch/inspection/';

const content      = document.getElementById('content');
const metaDateEl   = document.getElementById('metaDate');
const printBtn     = document.getElementById('printBtn');
const copyLinkBtn  = document.getElementById('copyLinkBtn');
let nodeMap;

/* ---------- toolbar (unchanged) ---------------------------------------- */
printBtn.addEventListener('click', () => window.print());
copyLinkBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(location.href).then(() => {
    copyLinkBtn.classList.replace('btn-outline-secondary', 'btn-success');
    copyLinkBtn.innerHTML = `<i class="bi bi-clipboard-check"></i> ${t('copied')}`;
    setTimeout(() => {
      copyLinkBtn.classList.replace('btn-success', 'btn-outline-secondary');
      copyLinkBtn.innerHTML = `<i class="bi bi-clipboard"></i> ${t('copyLink')}`;
    }, 2000);
  });
});

/* ---------- top-level data fetch and initial render -------------------- */
(async function init() {
  const bindings = await fetchBindings();
  nodeMap  = buildNodeMap(bindings);
  rebuildPage(window.__APP_LANG); // Initial render
})();


/* ---------- page render/rerender function ----------------------------- */
window.rebuildPage = function(lang) {
  content.innerHTML = ''; // Clear previous content

  // Update date based on new language
  metaDateEl.textContent = new Date().toLocaleDateString(lang, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const params    = new URLSearchParams(location.search);
  const slugParam = params.get('groups');

  if (!slugParam) {
    content.innerHTML = `<p class="text-danger">${t('noGroups')}</p>`;
    return;
  }
  const groupUris = slugParam.split(',')
    .map(decodeURIComponent)
    .map(slug => BASE_URI + slug);

  groupUris.forEach((uri, idx) => renderCollection(uri, [idx + 1], lang));
};

/* recurse and render a collection with the correct language and fallbacks */
function renderCollection(uri, numbers, lang) {
  const node = nodeMap.get(uri);
  if (!node) return;

  const hLevel  = Math.min(numbers.length, 6);
  const heading = document.createElement('h' + hLevel);
  const numSpan = document.createElement('span');
  numSpan.className = 'section-number';
  numSpan.textContent = numbers.join('.');
  heading.appendChild(numSpan);
  heading.innerHTML += window.getLocalizedText(node.label, lang);
  content.appendChild(heading);

  const commentText = window.getLocalizedText(node.comment, lang);
  if (commentText) {
    const p = document.createElement('p');
    p.innerHTML = commentText;
    content.appendChild(p);
  }

  if (node.inspectionPoints?.length) {
    const ul = document.createElement('ul');
    ul.className = 'checklist';
    node.inspectionPoints.forEach(ipUri => {
      const ip = nodeMap.get(ipUri);
      if (!ip) return;

      const li = document.createElement('li');
      const label = document.createElement('label');
      label.className = 'd-block';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'form-check-input';
      label.appendChild(cb);

      const strong = document.createElement('strong');
      strong.innerHTML = window.getLocalizedText(ip.label, lang);
      label.appendChild(strong);

      const ipCommentText = window.getLocalizedText(ip.comment, lang);
      if (ipCommentText) {
        label.appendChild(document.createElement('br'));
        const span = document.createElement('span');
        span.className = 'text-muted';
        span.innerHTML = ipCommentText;
        label.appendChild(span);
      }

      li.appendChild(label);
      ul.appendChild(li);
    });
    content.appendChild(ul);
  }

  (node.subGroups ?? []).forEach((subUri, i) =>
    renderCollection(subUri, numbers.concat(i + 1), lang)
  );
}