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
 *  Build Fancytree data & initialise widget
 * -----------------------------------------------------*/
(async function initTree () {
  const bindings = await fetchBindings();
  nodeMap = buildNodeMap(bindings);

  /* Build Fancytree node for a single Collection */
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
      key: uri,
      title: n.label ?? uri.split('/').pop(),
      tooltip: n.comment ?? '',
      data: { search: searchParts.join(' ').toLowerCase() },
      children: (n.subGroups ?? []).map(buildNode)
    };
  }

  /* Root collections = no parent links */
  const roots = [...nodeMap.values()]
    .filter(n => n.type === 'Collection' && !n.superGroup && !n.parentGroup)
    .map(n => buildNode(n.uri));

  treeEl
    .fancytree({
      extensions: ['filter'],
      checkbox: true,
      selectMode: 3,
      source: roots,
      filter: { highlight: true, autoExpand: true }
    })
    .on('fancytree-select', (_, data) => {
      selectedSet = new Set(data.tree.getSelectedNodes(true).map(n => n.key));
      generateBtn.prop('disabled', selectedSet.size === 0);
    })
    .on('fancytree-select', (_, data) => {
      if (data.node.isSelected()) data.node.makeVisible();
    });
})();

/* -------------------------------------------------------
 *  Search helpers
 * -----------------------------------------------------*/
function performSearch() {
  const q = searchInput.val().trim().toLowerCase();
  const tree = $.ui.fancytree.getTree(treeEl);

  tree.clearFilter();
  tree.visit(node => node.setExpanded(false));

  if (!q) return;

  tree.filterNodes(node => (node.data.search || '').includes(q));

  tree.getMatchedNodes().forEach(n => n.makeVisible());
}

searchInput.on('keydown', e => { if (e.key === 'Enter') performSearch(); });
searchBtn.on('click', performSearch);
clearFilterBtn.on('click', () => $.ui.fancytree.getTree(treeEl).clearFilter());

/* Collapse tree & untick everything */
foldTreeBtn.on('click', () => {
  const tree = $.ui.fancytree.getTree(treeEl);
  tree.clearFilter();
  tree.visit(node => {
    node.setSelected(false);
    node.setExpanded(false);
  });
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
