/* index.js – Navigator logic with cascading checkboxes */
import {
  fetchBindings,
  buildNodeMap
} from './model.js';

const BASE_URI      = 'https://agriculture.ld.admin.ch/inspection/';
const treeEl        = $('#tree');
const searchInput   = $('#search');
const searchBtn     = $('#searchBtn');
const generateBtn   = $('#generate');

let nodeMap;                   // Map<uri, node>
let selectedSet = new Set();   // URIs currently ticked
let searchActive = false;      // remembers if a query is active

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
      core: { data: roots, themes: { icons: false } },
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
      const empty = selectedSet.size === 0;
      generateBtn.prop('disabled', empty);
      generateBtn.toggleClass('btn-success', !empty);
      generateBtn.toggleClass('btn-outline-secondary', empty);
    })

    /* --- open node one level when it’s ticked --- */
    .on('select_node.jstree', (_, data) => {
      treeEl.jstree(true).open_node(data.node); // open, but no recursion
    });
})();

/* -------------------------------------------------------
 *  Search helpers
 * -----------------------------------------------------*/
function updateSearchBtn() {                     // toggles button UI
  if (searchActive) {
    searchBtn
      .html('<i class="bi bi-x-lg me-2"></i>Suche zurücksetzen')
      .removeClass('btn-outline-primary')
      .addClass('btn-outline-secondary');
  } else {
    searchBtn
      .html('<i class="bi bi-search me-2"></i>Suche')
      .removeClass('btn-outline-secondary')
      .addClass('btn-outline-primary');
  }
}
updateSearchBtn();                                // set initial label

function resetSearch() {                          // clears input & highlights
  const jsTree = treeEl.jstree(true);
  jsTree.clear_search();
  jsTree.close_all();
  searchInput.val('');
  searchActive = false;
  updateSearchBtn();
}

function performSearch() {
  const q      = searchInput.val().trim();
  const jsTree = treeEl.jstree(true);

  jsTree.clear_search();
  jsTree.close_all();

  if (!q) {                                      // empty ⇒ just reset
    resetSearch();
    return;
  }

  jsTree.search(q);

  /* ------------------------------------------------------------------
    jsTree ≥ 3.3 no longer exposes get_search_result().  
    Instead, wait a tick for the plugin to paint `.jstree-search`
    classes, grab the DOM matches and open them together with
    all their ancestors.                                           */
  setTimeout(() => {
    treeEl.find('a.jstree-search').each((_, a) => {
      const id   = $(a).closest('li').attr('id');
      const node = jsTree.get_node(id);
      // open the full ancestry chain once
      node.parents.forEach(p => { if (p !== '#') jsTree.open_node(p); });
      jsTree.open_node(id);
    });
  }, 0);

  searchActive = true;
  updateSearchBtn();
}

// Enter key triggers search
searchInput.on('keydown', e => {
  if (e.key === 'Enter') performSearch();
});

// live‑reset when the user deletes everything manually
searchInput.on('input', e => {
  if (!e.target.value.trim() && searchActive) resetSearch();
});

// dual‑behaviour button
searchBtn.on('click', () => {
  if (searchActive) resetSearch();
  else              performSearch();
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

// when clearing selection we now only deselect & disable generateBtn
export function resetTree() {
  const jsTree = treeEl.jstree(true);
  jsTree.deselect_all();
  jsTree.close_all();
  selectedSet.clear();
  generateBtn.prop('disabled', true);
}
