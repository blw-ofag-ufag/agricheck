import { fetchBindings, buildNodeMap, getDescendantIPs } from './model.js';

const treeEl      = $('#tree');
const searchInput = $('#search');
const clearBtn    = $('#clearSearch');
const resetBtn    = $('#resetTree');
const generateBtn = $('#generate');

let nodeMap;
let selected = new Set();

/* ---------- jsTree initialisation ---------- */
(async function init () {
  const bindings = await fetchBindings();
  nodeMap = buildNodeMap(bindings);

  /* build jsTree data recursively */
  function buildNode (uri) {
    const n = nodeMap.get(uri);
  
    // The searchable text for this *collection*:
    //   • its own label + comment
    //   • PLUS the label/comment of inspection points *directly attached* to it
    const searchParts = [];
    if (n.label)   searchParts.push(n.label);
    if (n.comment) searchParts.push(n.comment);
  
    (n.inspectionPoints ?? []).forEach(ipUri => {
      const ip = nodeMap.get(ipUri);
      if (ip?.label)   searchParts.push(ip.label);
      if (ip?.comment) searchParts.push(ip.comment);
    });
  
    return {
      id: uri,
      text: n.label ?? uri.split('/').pop(),
      icon: 'bi bi-collection',
      a_attr: { 'data-search': searchParts.join(' ').toLowerCase() },
      children: (n.subGroups ?? []).map(buildNode)
    };
  }  

  const roots = [];
  for (const [uri, n] of nodeMap) {
    if (n.type === 'Collection' && !n.superGroup && !n.parentGroup) {
      roots.push(buildNode(uri));
    }
  }

  treeEl
    .jstree({
      plugins: ['search', 'checkbox'],
      core:    { data: roots, themes: { icons: true } },
      checkbox:{ three_state: false },
      search:  {
        show_only_matches: false,                 // keep other nodes visible
        search_callback: (q, node) => {
          const hay = treeEl.jstree(true)
                            .get_node(node).a_attr['data-search'] || '';
          return hay.includes(q.toLowerCase());
        }
      }
    })
    .on('changed.jstree', (_, data) => {
      selected = new Set(data.selected);
      generateBtn.prop('disabled', selected.size === 0);
    });
})();

/* ---------- SEARCH & BUTTON LOGIC ---------- */
function performSearch () {
  const query  = searchInput.val().trim();
  const jsTree = treeEl.jstree(true);

  jsTree.clear_search();
  jsTree.close_all();

  if (!query) return;

  jsTree.search(query);

  /* unfold every node that matched, plus its ancestors */
  const { nodes: hits } = jsTree.get_search_result();
  hits.forEach(id => {
    const node = jsTree.get_node(id);
    node.parents.forEach(p => { if (p !== '#') jsTree.open_node(p); });
    jsTree.open_node(id);
  });
}

/* ── Enter triggers search ─────────────────── */
searchInput.on('keydown', e => { if (e.key === 'Enter') performSearch(); });

/* ── clear search button ───────────────────── */
clearBtn.on('click', () => {
  searchInput.val('');
  treeEl.jstree(true).clear_search();
  treeEl.jstree(true).close_all();
});

/* ── reset-tree button (uncheck + collapse) ─ */
resetBtn.on('click', () => {
  const jst = treeEl.jstree(true);
  jst.deselect_all();
  jst.close_all();
  selected.clear();
  generateBtn.prop('disabled', true);
});

/* ---------- Generate checklist nav ---------- */
generateBtn.on('click', () => {
  if (!selected.size) return;
  const qs = [...selected].map(encodeURIComponent).join(',');
  location.href = `checklist.html?groups=${qs}`;
});
