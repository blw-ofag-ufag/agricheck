// model.js – data layer for Agricheck, language‑aware -----------------------
const ENDPOINT = 'https://lindas.admin.ch/query';

/* build the SPARQL query for the requested UI language */
function buildQuery(lang) {
  return `
PREFIX :        <https://agriculture.ld.admin.ch/inspection/>
PREFIX schema:  <http://schema.org/>
PREFIX dct:     <http://purl.org/dc/terms/>

SELECT ?class ?item ?name ?description ?parent ?identifier
WHERE {
  VALUES ?lang  { "${lang}" }
  VALUES ?class { :InspectionPoint dct:Collection }

  ?item a ?class ;
        schema:name ?name .
  FILTER(LANG(?name) = ?lang)

  OPTIONAL {
    ?item schema:description ?description .
    FILTER(LANG(?description) = ?lang)
  }

  OPTIONAL {
    ?item ?link ?parent .
    VALUES ?link { schema:isPartOf :belongsToGroup }
  }

  OPTIONAL { ?item schema:identifier ?identifier }
}
ORDER BY ?identifier ?item
`;
}

/* ------------------------------------------------------------------ */
export async function fetchBindings() {
  const lang = window.__APP_LANG || 'de';
  const res  = await fetch(ENDPOINT, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/sparql-query',
      'Accept':       'application/sparql-results+json'
    },
    body: buildQuery(lang)
  });
  if (!res.ok) {
    throw new Error(`SPARQL request failed: ${res.status} – ${res.statusText}`);
  }
  return res.json();
}

/* unchanged helper functions ---------------------------------------- */
export function buildNodeMap(bindingsJson) {
  const rows = bindingsJson.results.bindings;
  const v = (row, key) => row[key]?.value;

  /* instantiate every node once */
  const map = new Map();
  for (const row of rows) {
    const uri = v(row, 'item');
    if (!map.has(uri)) {
      map.set(uri, {
        uri,
        type: v(row, 'class').includes('Collection') ? 'Collection' : 'InspectionPoint',

        label:      v(row, 'name'),
        comment:    v(row, 'description') || null,
        identifier: v(row, 'identifier')   || null,

        subGroups:        [],
        inspectionPoints: [],

        superGroup:  null,
        parentGroup: null
      });
    }
  }

  /* wire parents/children */
  for (const row of rows) {
    const uri    = v(row, 'item');
    const parent = v(row, 'parent');
    if (!parent) continue;

    const node       = map.get(uri);
    const parentNode = map.get(parent);
    if (!node || !parentNode) continue;

    if (node.type === 'Collection') {
      node.superGroup = parent;
      parentNode.subGroups.push(uri);
    } else {
      node.parentGroup = parent;
      parentNode.inspectionPoints.push(uri);
    }
  }
  return map;
}

export function getDescendantIPs(collectionURI, nodeMap, visited = new Set()) {
  if (visited.has(collectionURI)) return [];
  visited.add(collectionURI);

  const node = nodeMap.get(collectionURI);
  if (!node || node.type !== 'Collection') return [];

  let ips = [...node.inspectionPoints];
  for (const sub of node.subGroups) {
    ips = ips.concat(getDescendantIPs(sub, nodeMap, visited));
  }
  return ips;
}

export function getBreadcrumbs(uri, nodeMap) {
  const trail = [];
  let cur = uri;
  while (cur) {
    const n = nodeMap.get(cur);
    if (!n) break;
    trail.unshift(n.label || cur.split('/').pop());
    cur = n.superGroup || n.parentGroup;
  }
  return trail;
}
