// Shared data/model utilities for Agricheck
const ENDPOINT = 'https://lindas.admin.ch/query';

// SPARQL query fetching the full inspection‑point hierarchy
const SPARQL_QUERY = `
PREFIX :           <https://agriculture.ld.admin.ch/inspection/>
PREFIX dcterms:    <http://purl.org/dc/terms/>
PREFIX schema:     <http://schema.org/>
PREFIX rdfs:       <http://www.w3.org/2000/01/rdf-schema#>

SELECT
  ?s ?sType ?sLabel ?sComment ?hierarchyLevel
  ?subGroup ?subGroupLabel ?subGroupComment
  ?superGroup
  ?inspectionPoint ?inspectionPointLabel ?inspectionPointComment
  ?parentGroup
WHERE {
  ?s a ?sType .
  FILTER(?sType IN (dcterms:Collection, :InspectionPoint))

  OPTIONAL { ?s rdfs:label   ?sLabel   . FILTER(LANG(?sLabel)   = "de") }
  OPTIONAL { ?s rdfs:comment ?sComment . FILTER(LANG(?sComment) = "de") }
  OPTIONAL { ?s :hierarchyLevel ?hierarchyLevel }

  OPTIONAL {
    ?s schema:hasPart ?subGroup .
    OPTIONAL { ?subGroup rdfs:label   ?subGroupLabel   . FILTER(LANG(?subGroupLabel)   = "de") }
    OPTIONAL { ?subGroup rdfs:comment ?subGroupComment . FILTER(LANG(?subGroupComment) = "de") }
  }

  OPTIONAL { ?s schema:isPartOf ?superGroup }

  OPTIONAL {
    ?s :includesInspectionPoints ?inspectionPoint .
    OPTIONAL { ?inspectionPoint rdfs:label   ?inspectionPointLabel   . FILTER(LANG(?inspectionPointLabel)   = "de") }
    OPTIONAL { ?inspectionPoint rdfs:comment ?inspectionPointComment . FILTER(LANG(?inspectionPointComment) = "de") }
  }

  OPTIONAL { ?s :belongsToGroup ?parentGroup }
}
`;

/** Fetch raw SPARQL bindings as JSON. */
export async function fetchBindings () {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sparql-query',
      'Accept': 'application/sparql-results+json'
    },
    body: SPARQL_QUERY
  });
  if (!res.ok) {
    throw new Error(`SPARQL request failed: ${res.status} – ${res.statusText}`);
  }
  return res.json();
}

/** Transform SPARQL bindings into a convenient Map keyed by URI. */
export function buildNodeMap (bindingsJson) {
  const map = new Map();
  const rows = bindingsJson.results.bindings;

  const v = (row, key) => row[key]?.value;

  for (const row of rows) {
    const s = v(row, 's');
    if (!map.has(s)) {
      map.set(s, {
        uri: s,
        type: v(row, 'sType')?.includes('Collection') ? 'Collection' : 'InspectionPoint',
        label: v(row, 'sLabel'),
        comment: v(row, 'sComment'),
        hierarchyLevel: v(row, 'hierarchyLevel'),
        subGroups: new Set(),
        inspectionPoints: new Set()
      });
    }
    const node = map.get(s);

    if (v(row, 'subGroup'))           node.subGroups.add(v(row, 'subGroup'));
    if (v(row, 'inspectionPoint'))    node.inspectionPoints.add(v(row, 'inspectionPoint'));
    if (v(row, 'superGroup'))         node.superGroup  = v(row, 'superGroup');
    if (v(row, 'parentGroup'))        node.parentGroup = v(row, 'parentGroup');

    // Ensure referenced child nodes exist so look‑ups don’t fail later
    if (v(row, 'subGroup') && !map.has(v(row, 'subGroup'))) {
      map.set(v(row, 'subGroup'), {
        uri: v(row, 'subGroup'),
        type: 'Collection',
        label: v(row, 'subGroupLabel'),
        comment: v(row, 'subGroupComment'),
        subGroups: new Set(),
        inspectionPoints: new Set()
      });
    }
    if (v(row, 'inspectionPoint') && !map.has(v(row, 'inspectionPoint'))) {
      map.set(v(row, 'inspectionPoint'), {
        uri: v(row, 'inspectionPoint'),
        type: 'InspectionPoint',
        label: v(row, 'inspectionPointLabel'),
        comment: v(row, 'inspectionPointComment')
      });
    }
  }

  // Convert internal Sets to Arrays for easier serialization / iteration
  for (const node of map.values()) {
    if (node.subGroups)        node.subGroups        = Array.from(node.subGroups);
    if (node.inspectionPoints) node.inspectionPoints = Array.from(node.inspectionPoints);
  }

  return map;
}

/** Recursively collect all InspectionPoint URIs under a given Collection. */
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

/** Return label breadcrumb trail up to the root. Handy for debug / UI. */
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
