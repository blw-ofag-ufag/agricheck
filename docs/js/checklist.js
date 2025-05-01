import { fetchBindings, buildNodeMap } from './model.js';

const content = document.getElementById('content');
document.getElementById('printBtn').addEventListener('click', () => window.print());

(async function init () {
  const params = new URLSearchParams(location.search);
  const groupParam = params.get('groups');
  if (!groupParam) {
    content.innerHTML = '<p class="text-danger">Keine Gruppen angegeben.</p>';
    return;
  }
  const groups = groupParam.split(',').map(decodeURIComponent);

  const bindings = await fetchBindings();
  const nodeMap  = buildNodeMap(bindings);

  groups.forEach(uri => renderCollection(uri, 1));

  /** Render a collection section (headings + inspection points) recursively. */
  function renderCollection (uri, depth) {
    const node = nodeMap.get(uri);
    if (!node) return;

    const hLevel = Math.min(depth, 6);
    const heading = document.createElement('h' + hLevel);
    heading.textContent = node.label ?? uri.split('/').pop();
    content.appendChild(heading);

    if (node.comment) {
      const p = document.createElement('p');
      p.textContent = node.comment;
      content.appendChild(p);
    }

    // List inspection points first
    if (node.inspectionPoints?.length) {
      const ul = document.createElement('ul');
      node.inspectionPoints.forEach(ipUri => {
        const ip = nodeMap.get(ipUri);
        if (!ip) return;
        const li = document.createElement('li');
        const strong = document.createElement('strong');
        strong.textContent = ip.label ?? ipUri.split('/').pop();
        li.appendChild(strong);
        if (ip.comment) li.append(' – ' + ip.comment);
        ul.appendChild(li);
      });
      content.appendChild(ul);
    }

    // Recurse into sub‑collections
    (node.subGroups ?? []).forEach(sub => renderCollection(sub, depth + 1));
  }
})();
