/* checklist.js – builds list, fills date, handles toolbar actions ----------*/
import { fetchBindings, buildNodeMap } from './model.js';

const BASE_URI = 'https://agriculture.ld.admin.ch/inspection/';

const content      = document.getElementById('content');
const metaDateEl   = document.getElementById('metaDate');
const printBtn     = document.getElementById('printBtn');
const excelBtn     = document.getElementById('excelBtn');
const copyLinkBtn  = document.getElementById('copyLinkBtn');

/* ---------- toolbar interactions --------------------------------------- */
printBtn.addEventListener('click', () => window.print());

excelBtn.addEventListener('click', () => {
  alert(t('excelSoon'));
});

copyLinkBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href).then(() => {
    copyLinkBtn.classList.replace('btn-outline-secondary', 'btn-success');
    copyLinkBtn.innerHTML = `<i class="bi bi-clipboard-check"></i> ${t('copied')}`;
    setTimeout(() => {
      copyLinkBtn.classList.replace('btn-success', 'btn-outline-secondary');
      copyLinkBtn.innerHTML = `<i class="bi bi-clipboard"></i> ${t('copyLink')}`;
    }, 2000);
  });
});

/* ---------- show current date in UI language --------------------------- */
const today = new Date();
metaDateEl.textContent = today.toLocaleDateString(window.__APP_LANG, {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

/* ---------- fetch data and render checklist --------------------------- */
(async function init() {
  const params    = new URLSearchParams(location.search);
  const slugParam = params.get('groups');
  if (!slugParam) {
    content.innerHTML = `<p class="text-danger">${t('noGroups')}</p>`;
    return;
  }
  const groupUris = slugParam.split(',')
    .map(decodeURIComponent)
    .map(slug => BASE_URI + slug);

  const bindings = await fetchBindings();
  const nodeMap  = buildNodeMap(bindings);

  groupUris.forEach((uri, idx) => renderCollection(uri, [idx + 1]));

  function renderCollection(uri, numbers) {
    const node = nodeMap.get(uri);
    if (!node) return;

    const hLevel  = Math.min(numbers.length, 6);
    const heading = document.createElement('h' + hLevel);
    const numSpan = document.createElement('span');
    numSpan.className = 'section-number';
    numSpan.textContent = numbers.join('.');
    heading.appendChild(numSpan);
    heading.append(node.label ?? uri.split('/').pop());

    if (node.type === 'Collection' && node.identifier) {
      const chip = document.createElement('span');
      chip.className = 'badge id-chip ms-2';
      chip.textContent = node.identifier;
      heading.appendChild(chip);
    }
    content.appendChild(heading);

    if (node.comment) {
      const p = document.createElement('p');
      p.textContent = node.comment;
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
        strong.textContent = ip.label ?? ipUri.split('/').pop();
        label.appendChild(strong);

        if (ip.comment) {
          label.appendChild(document.createElement('br'));
          const span = document.createElement('span');
          span.className = 'text-muted';
          span.textContent = ip.comment;
          label.appendChild(span);
        }

        li.appendChild(label);
        ul.appendChild(li);
      });
      content.appendChild(ul);
    }

    (node.subGroups ?? []).forEach((subUri, i) =>
      renderCollection(subUri, numbers.concat(i + 1))
    );
  }
})();
