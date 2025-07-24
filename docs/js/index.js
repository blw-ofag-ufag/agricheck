/* index.js – navigator logic with cascading checkboxes ------------------*/
import { fetchBindings, buildNodeMap } from './model.js';

/* ── wait until i18n is ready so t() exists ─────────────────────────────*/
await window.__i18nReady;

const BASE_URI      = 'https://agriculture.ld.admin.ch/inspection/';
const treeEl        = $('#tree');
const searchInput   = $('#search');
const searchBtn     = $('#searchBtn');
const generateBtn   = $('#generate');

let nodeMap;
let selectedSet = new Set();
let searchActive = false;

/* ---------- build jsTree ---------------------------------------------- */
(async function initTree() {
  const bindings = await fetchBindings();
  nodeMap = buildNodeMap(bindings);

  function buildNode(uri) {
    const n = nodeMap.get(uri);
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
      a_attr: { 'data-search': searchParts.join(' ').toLowerCase() },
      children: (n.subGroups ?? []).map(buildNode)
    };
  }

  const roots = [...nodeMap.values()]
    .filter(n => n.type === 'Collection' && !n.superGroup && !n.parentGroup)
    .map(n => buildNode(n.uri));

  treeEl
    .jstree({
      plugins: ['search', 'checkbox'],
      core: { data: roots, themes: { icons: false } },
      checkbox: { three_state: true, cascade: 'up+down+undetermined' },
      search: {
        show_only_matches: false,
        search_callback(q, node) {
          const hay = treeEl.jstree(true)
                            .get_node(node)
                            .a_attr['data-search'] || '';
          return hay.includes(q.toLowerCase());
        }
      }
    })
    .on('changed.jstree', (_, data) => {
      selectedSet = new Set(data.selected);
      const empty = selectedSet.size === 0;
      generateBtn.prop('disabled', empty)
                 .toggleClass('btn-success', !empty)
                 .toggleClass('btn-outline-secondary', empty);
    })
    .on('select_node.jstree', (_, data) => {
      treeEl.jstree(true).open_node(data.node);
    });
})();

/* ---------- search helpers -------------------------------------------- */
function updateSearchBtn() {
  if (searchActive) {
    searchBtn
      .html(`<i class="bi bi-x-lg me-2"></i>${t('searchReset')}`)
      .removeClass('btn-outline-primary')
      .addClass('btn-outline-secondary');
  } else {
    searchBtn
      .html(`<i class="bi bi-search me-2"></i>${t('search')}`)
      .removeClass('btn-outline-secondary')
      .addClass('btn-outline-primary');
  }
}
updateSearchBtn();
searchInput.attr('placeholder', t('searchPlaceholder'));

function resetSearch() {
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

  if (!q) { resetSearch(); return; }

  jsTree.search(q);

  /* open matches + their ancestors */
  setTimeout(() => {
    treeEl.find('a.jstree-search').each((_, a) => {
      const id   = $(a).closest('li').attr('id');
      const node = jsTree.get_node(id);
      node.parents.forEach(p => { if (p !== '#') jsTree.open_node(p); });
      jsTree.open_node(id);
    });
  }, 0);

  searchActive = true;
  updateSearchBtn();
}

searchInput.on('keydown', e => { if (e.key === 'Enter') performSearch(); });
searchInput.on('input',  e => { if (!e.target.value.trim() && searchActive) resetSearch(); });
searchBtn  .on('click',  () => { searchActive ? resetSearch() : performSearch(); });

/* ---------- launch checklist ------------------------------------------ */
function compressSelection(set) {
  const compressed = new Set();
  for (const uri of set) {
    let skip = false;
    let cur  = uri;
    while (true) {
      const node   = nodeMap.get(cur);
      const parent = node?.superGroup || node?.parentGroup;
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

  const minimal = compressSelection(selectedSet);
  const qs = [...minimal].map(u => encodeURIComponent(u.split('/').pop())).join(',');

  const url = new URL('checklist.html', location.origin);
  url.searchParams.set('groups', qs);
  url.searchParams.set('lang', window.__APP_LANG);
  location.href = url.pathname + url.search;
});

/* external helper ------------------------------------------------------- */
export function resetTree() {
  const jsTree = treeEl.jstree(true);
  jsTree.deselect_all();
  jsTree.close_all();
  selectedSet.clear();
  generateBtn.prop('disabled', true);
}
