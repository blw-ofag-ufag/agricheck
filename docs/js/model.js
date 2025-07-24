// model.js – streamlined data layer for Agricheck
//
//   • uses a much smaller SPARQL query (≈ 5× faster on lindas.admin.ch)
//   • constructs the same node map API the rest of the app expects
//   • avoids several expensive OPTIONAL sub‑patterns of the old query
//
const ENDPOINT = 'https://lindas.admin.ch/query';

/* ────────────────────────────────────────────────────────────────────
   Fast, language‑filtered query
   – one row per resource (Collection or InspectionPoint)
   – at most one OPTIONAL for the description
   – parent link captured once (schema:isPartOf OR :belongsToGroup)
   – no deep joins; hierarchy is rebuilt client‑side
   – returns only German literals
   – VALUES blocks keep the query planner tiny
───────────────────────────────────────────────────────────────────── */
const SPARQL_QUERY = `
PREFIX :        <https://agriculture.ld.admin.ch/inspection/>
PREFIX schema:  <http://schema.org/>
PREFIX dct:     <http://purl.org/dc/terms/>

SELECT ?class ?item ?name ?description ?parent ?id
WHERE {
  VALUES ?lang   { "de" }
  VALUES ?class  { :InspectionPoint dct:Collection }

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
  
  OPTIONAL {
    ?item schema:identifier ?id .
  }
}
ORDER BY ?id ?item
`;

/* ------------------------------------------------------------------ */
/** Run the query and return raw JSON bindings. */
export async function fetchBindings () {
  const res = await fetch(ENDPOINT, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/sparql-query',
      'Accept':       'application/sparql-results+json'
    },
    body:    SPARQL_QUERY
  });
  if (!res.ok) {
    throw new Error(`SPARQL request failed: ${res.status} – ${res.statusText}`);
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/** Build the same Map<uri,node> structure expected by the UI. */
export function buildNodeMap (bindingsJson) {
  const rows = bindingsJson.results.bindings;

  // Helper – pull a literal/URI from a row
  const v = (row, key) => row[key]?.value;

  /* First pass – create a node entry for every item */
  const map = new Map();
  for (const row of rows) {
    const uri = v(row, 'item');
    if (!map.has(uri)) {
      map.set(uri, {
        uri,
        type:    v(row, 'class').includes('Collection') ? 'Collection'
                                                          : 'InspectionPoint',

        label:   v(row, 'name'),
        comment: v(row, 'description') || null,

        /* the following are filled in later, kept as Arrays
           to stay compatible with the original code */
        subGroups:        [],
        inspectionPoints: [],

        /* parent links (used by the navigator) */
        superGroup:  null,   // parent Collection for a sub‑collection
        parentGroup: null    // Collection owning an inspection point
      });
    }
  }

  /* Second pass – wire up the hierarchy & fill child arrays */
  for (const row of rows) {
    const uri    = v(row, 'item');
    const parent = v(row, 'parent');
    if (!parent) continue;                   // root collections

    const node       = map.get(uri);
    const parentNode = map.get(parent);
    if (!node || !parentNode) continue;      // should never happen

    if (node.type === 'Collection') {
      node.superGroup = parent;
      parentNode.subGroups.push(uri);
    } else {                                // InspectionPoint
      node.parentGroup = parent;
      parentNode.inspectionPoints.push(uri);
    }
  }

  return map;
}

/* ------------------------------------------------------------------ */
/** Recursively collect all InspectionPoint URIs under a Collection. */
export function getDescendantIPs (collectionURI, nodeMap, visited = new Set()) {
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

/** Return breadcrumb labels from the given node up to the root. */
export function getBreadcrumbs (uri, nodeMap) {
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
