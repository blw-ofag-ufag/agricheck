/* index.js – Navigator logic with cascading checkboxes */
import {
  fetchBindings,
  buildNodeMap
} from './model.js';

const BASE_URI = 'https://agriculture.ld.admin.ch/inspection/';
const treeEl         = $('#tree');
const searchInput    = $('#search');
const searchBtn      = $('#searchBtn');
const clearFilterBtn = $('#clearFilterBtn');
const foldTreeBtn    = $('#foldTreeBtn');
const generateBtn    = $('#generate');

let nodeMap;                 // Map<uri, node>
let selectedSet = new Set(); // URIs currently ticked

/* -------------------------------------------------------
 *  Build jsTree data & initialise widget
 * -----------------------------------------------------*/
(async function initTree () {
  const bindings = await fetchBindings();
  nodeMap = buildNodeMap(bindings);

  /* Build jsTree node for a single Collection */
  function buildNode (uri) {
    const n = nodeMap.get(uri);

    // Search text = own label/comment + direct IP labels/comments
    const searchParts = [];
    if (n.label)   searchParts.push(n.label);
    if (n.comment) searchParts.push(n.comment);
    (n.inspectionPoints ?? []).forEach(ipUri => {
      const ip = nodeMap.get(ipUri);
      if (ip?.label)   searchParts.push(ip.label);
      if (ip?.comment) searchParts.push(ip.comment);
    });

    return {
      id:   uri,
      text: n.label ?? uri.split('/').pop(),
      icon: 'bi bi-collection',
      a_attr: { 'data-search': searchParts.join(' ').toLowerCase() },
      children: (n.subGroups ?? []).map(buildNode)
    };
  }

  /* Root collections = no parent links */
  const roots = [...nodeMap.values()]
    .filter(n => n.type === 'Collection' && !n.superGroup && !n.parentGroup)
    .map(n => buildNode(n.uri));

  treeEl
    .jstree({
      plugins: ['search', 'checkbox'],
      core: { data: roots, themes: { icons: true } },
      checkbox: {
        three_state: true,                      // enable half-checked state
        cascade: 'up+down+undetermined'         // parents & children sync
      },
      search: {
        show_only_matches: false,
        search_callback(query, node) {
          const hay = treeEl.jstree(true)
                            .get_node(node)
                            .a_attr['data-search'] || '';
          return hay.includes(query.toLowerCase());
        }
      }
    })

    /* --- update local Set whenever selection changes --- */
    .on('changed.jstree', (_, data) => {
      selectedSet = new Set(data.selected);
      generateBtn.prop('disabled', selectedSet.size === 0);
    })

    /* --- open node one level when it’s ticked --- */
    .on('select_node.jstree', (_, data) => {
      treeEl.jstree(true).open_node(data.node); // open, but no recursion
    });
})();

/* -------------------------------------------------------
 *  Search helpers
 * -----------------------------------------------------*/
function performSearch() {
  const q = searchInput.val().trim();
  const jsTree = treeEl.jstree(true);

  jsTree.clear_search();
  jsTree.close_all();

  if (!q) return;

  jsTree.search(q);

  // open each hit & its ancestors once
  const { nodes: hits } = jsTree.get_search_result();
  hits.forEach(id => {
    const node = jsTree.get_node(id);
    node.parents.forEach(p => { if (p !== '#') jsTree.open_node(p); });
    jsTree.open_node(id);
  });
}

searchInput.on('keydown', e => { if (e.key === 'Enter') performSearch(); });
searchBtn.on('click', performSearch);
clearFilterBtn.on('click', () => treeEl.jstree(true).clear_search());

/* Collapse tree & untick everything */
foldTreeBtn.on('click', () => {
  const jsTree = treeEl.jstree(true);
  jsTree.deselect_all();
  jsTree.close_all();
  selectedSet.clear();
  generateBtn.prop('disabled', true);
});

/* -------------------------------------------------------
 *  Launch checklist – compress selection first
 * -----------------------------------------------------*/
function compressSelection(set) {
  const compressed = new Set();

  for (const uri of set) {
    let skip = false;
    let cur  = uri;
    // Walk up to root; if any ancestor is in the selection, skip this uri
    while (true) {
      const node = nodeMap.get(cur);
      if (!node) break;
      const parent = node.superGroup || node.parentGroup;
      if (!parent) break;
      if (set.has(parent)) { skip = true; break; }
      cur = parent;
    }
    if (!skip) compressed.add(uri);
  }
  return compressed;
}

generateBtn.on('click', () => {
  if (!selectedSet.size) return;

  // strip redundant descendants first
  const minimal = compressSelection(selectedSet);

  // convert each full URI → slug (text after the final “/”)
  const qs = [...minimal]
    .map(uri => encodeURIComponent(uri.split('/').pop()))
    .join(',');

  location.href = `checklist.html?groups=${qs}`;
});
