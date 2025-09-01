/* index.js – navigator logic with cascading checkboxes ------------------*/
import { fetchBindings, buildNodeMap } from './model.js';

/* ensure translations are ready so t() exists ---------------------------*/
await window.__i18nReady;

const BASE_URI      = 'https://agriculture.ld.admin.ch/inspection/';
const treeEl        = $('#tree');
const searchInput   = $('#search');
const searchBtn     = $('#searchBtn');
const generateBtn   = $('#generate');

let nodeMap;
let selectedSet = new Set();
let searchActive = false;

/* ---------- top-level data fetch and initial render ------------------- */
(async function init() {
  const bindings = await fetchBindings();
  nodeMap = buildNodeMap(bindings);

  treeEl.one('ready.jstree', function () {
    const urlParams = new URLSearchParams(location.search);
    const searchTerms = urlParams.getAll('search');
    if (searchTerms.length > 0) {
      searchInput.val(searchTerms.join(' '));
      performSearch();
    }
  });

  rebuildPage(window.__APP_LANG);
})();

/* ---------- page render/rerender function ----------------------------- */
window.rebuildPage = function(lang) {
  if (treeEl.jstree(true)) {
    treeEl.jstree(true).destroy();
  }
  selectedSet.clear(); // Reset selection on language change
  generateBtn.prop('disabled', true);
  
  function buildNode(uri) {
    const n = nodeMap.get(uri);
    const labelText = window.getLocalizedText(n.label, lang);
    const descriptionText = window.getLocalizedText(n.comment, lang, false);

    // Search should cover all available languages for an item
    const searchHaystack = [
        ...Object.values(n.label),
        ...Object.values(n.comment)
    ];
    (n.inspectionPoints ?? []).forEach(ipUri => {
        const ip = nodeMap.get(ipUri);
        if (ip) {
            searchHaystack.push(...Object.values(ip.label));
            searchHaystack.push(...Object.values(ip.comment));
        }
    });
    
    const nodeData = {
      id: uri,
      text: labelText,
      a_attr: { 'data-search': searchHaystack.join(' ').toLowerCase() },
      children: (n.subGroups ?? []).map(buildNode)
    };
    
    // If a description exists, add Bootstrap tooltip attributes
    if (descriptionText) {
      nodeData.a_attr['data-bs-toggle'] = 'tooltip';
      nodeData.a_attr['data-bs-placement'] = 'right';
      nodeData.a_attr['title'] = descriptionText;
    }

    return nodeData;
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
          const tokens = q.toLowerCase()
                          .split(/[ ,/]+| OR /i)
                          .filter(Boolean);
          if (tokens.length === 0) return false;
          return tokens.some(token => hay.includes(token));
        }
      }
    })
    .on('changed.jstree', (_, data) => {
      selectedSet = new Set(data.selected);
      const empty = selectedSet.size === 0;
      generateBtn.prop('disabled', empty)
                 .toggleClass('btn-success', !empty)
                 .toggleClass('btn-primary', empty);
    })
    .on('select_node.jstree', (_, data) => {
      treeEl.jstree(true).open_node(data.node);
    });
    
  // Initialize Bootstrap tooltips with new options
  new bootstrap.Tooltip(treeEl[0], {
    selector: '[data-bs-toggle="tooltip"]',
    trigger: 'hover',
    html: true,
    customClass: 'wide-tooltip',
    delay: { show: 500, hide: 50 }
  });

  // Re-apply static translations and search state
  updateSearchBtn();
  searchInput.attr('placeholder', t('searchPlaceholder'));
};

function updateSearchBtn() {
  if (searchActive) {
    searchBtn
      .html(`<i class="bi bi-x-lg me-2"></i>${t('searchReset')}`)
      .removeClass('btn-outline-primary')
      .addClass('btn-outline-secondary');
  } else {
    searchBtn
      .html(`<span data-i18n="search">${t('search')}</span>`)
      .removeClass('btn-outline-secondary')
      .addClass('btn-outline-primary');
  }
}

function resetSearch() {
  searchInput.val('');
  performSearch();
}

function performSearch() {
  const q      = searchInput.val().trim();
  const jsTree = treeEl.jstree(true);

  const url = new URL(location.href);
  url.searchParams.delete('search');
  if (q) {
    const tokens = q.toLowerCase().split(/[ ,/]+| OR /i).filter(Boolean);
    tokens.forEach(token => url.searchParams.append('search', token));
  }
  history.pushState({}, '', url.toString());

  jsTree.clear_search();
  jsTree.close_all();

  if (!q) {
    searchActive = false;
    updateSearchBtn();
    return;
  }

  jsTree.search(q);

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

/* ---------- launch checklist ------------------------------ */
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

  const url = new URL('checklist.html', location.href);
  url.searchParams.set('groups', qs);
  url.searchParams.set('lang', window.__APP_LANG);
  location.href = url.pathname + url.search;
});

/* external helper ------------------------------------------- */
export function resetTree() {
  const jsTree = treeEl.jstree(true);
  jsTree.deselect_all();
  jsTree.close_all();
  selectedSet.clear();
  generateBtn.prop('disabled', true);
}