/* checklist.js – builds list, fills date, handles toolbar actions */
import { fetchBindings, buildNodeMap } from './model.js';

const BASE_URI = 'https://agriculture.ld.admin.ch/inspection/';

const content      = document.getElementById('content');
const metaDateEl   = document.getElementById('metaDate');
const printBtn     = document.getElementById('printBtn');
const excelBtn     = document.getElementById('excelBtn');
const copyLinkBtn  = document.getElementById('copyLinkBtn');

/* ---------- toolbar interactions ------------------------------------ */
printBtn.addEventListener('click', () => window.print());

excelBtn.addEventListener('click', () => {
  alert('Excel-Export wird demnächst unterstützt.');
});

copyLinkBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href)
    .then(() => {
      copyLinkBtn.classList.remove('btn-outline-secondary');
      copyLinkBtn.classList.add('btn-success');
      copyLinkBtn.innerHTML = '<i class="bi bi-clipboard-check"></i> Kopiert!';
      setTimeout(() => {
        copyLinkBtn.classList.add('btn-outline-secondary');
        copyLinkBtn.classList.remove('btn-success');
        copyLinkBtn.innerHTML = '<i class="bi bi-clipboard"></i> Link kopieren';
      }, 2000);
    });
});

/* ---------- show current date in German ------------------------------ */
const today = new Date();
metaDateEl.textContent = today.toLocaleDateString('de-CH', {
  weekday: 'long',
  year:    'numeric',
  month:   'long',
  day:     'numeric'
});  // e.g. "Donnerstag, 1. Mai 2025"

/* ---------- fetch data and render checklist -------------------------- */
(async function init () {

  /* 1. read slugs, rebuild full URIs */
  const params    = new URLSearchParams(location.search);
  const slugParam = params.get('groups');
  if (!slugParam) {
    content.innerHTML = '<p class="text-danger">Keine Gruppen angegeben.</p>';
    return;
  }
  const groupUris = slugParam.split(',')
    .map(decodeURIComponent)
    .map(slug => BASE_URI + slug);

  /* 2. fetch & map data */
  const bindings = await fetchBindings();
  const nodeMap  = buildNodeMap(bindings);

  /* 3. render each root collection with recursive section numbers */
  groupUris.forEach((uri, idx) => renderCollection(uri, [idx + 1]));

  /* ---------- helper: recursively render a collection --------------- */
  function renderCollection (uri, numbers) {
    const node = nodeMap.get(uri);
    if (!node) return;

    /* heading */
    const hLevel  = Math.min(numbers.length, 6);
    const heading = document.createElement('h' + hLevel);
    const numSpan = document.createElement('span');
    numSpan.className = 'section-number';
    numSpan.textContent = numbers.join('.');
    heading.appendChild(numSpan);
    heading.append(node.label ?? uri.split('/').pop());
    content.appendChild(heading);

    if (node.comment) {
      const p = document.createElement('p');
      p.textContent = node.comment;
      content.appendChild(p);
    }

    /* checklist points */
    if (node.inspectionPoints?.length) {
      const ul = document.createElement('ul');
      ul.className = 'checklist';
      node.inspectionPoints.forEach(ipUri => {
        const ip = nodeMap.get(ipUri);
        if (!ip) return;

        const li    = document.createElement('li');
        const label = document.createElement('label');
        label.className = 'd-block';

        const cb    = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'form-check-input';
        label.appendChild(cb);

        const strong = document.createElement('strong');
        strong.textContent = ip.label ?? ipUri.split('/').pop();
        label.appendChild(strong);

        if (ip.comment) label.append(' – ' + ip.comment);
        li.appendChild(label);
        ul.appendChild(li);
      });
      content.appendChild(ul);
    }

    /* recurse into sub-collections */
    (node.subGroups ?? []).forEach((subUri, i) =>
      renderCollection(subUri, numbers.concat(i + 1))
    );
  }
})();
