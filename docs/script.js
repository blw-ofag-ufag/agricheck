// The LINDAS endpoint (public). Change if pointing somewhere else.
const ENDPOINT = "https://lindas.admin.ch/query";

/**
 * Utility: run a SPARQL query against the endpoint, return JSON results.
 */
async function getSparqlData(query) {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/sparql-results+json" },
  });
  return response.json();
}

/**
 * SPARQL queries:
 * 1) getTopLevelGroups: All dcterms:Collection without a parent (schema:isPartOf).
 * 2) getSubGroups: Find subgroups with schema:isPartOf = groupIRI.
 * 3) getInspectionPointsInGroup: Find all :InspectionPoint resources that belong to the group.
 */
function getTopLevelGroupsQuery() {
  return `
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?group ?label ?comment
    WHERE {
      ?group a dcterms:Collection .
      FILTER NOT EXISTS {
        ?group schema:isPartOf ?someParent .
      }
      OPTIONAL {
        ?group rdfs:label ?lbl .
        FILTER (lang(?lbl) = "de")
      }
      BIND(COALESCE(?lbl, "") AS ?label)
      
      OPTIONAL {
        ?group rdfs:comment ?cmt .
        FILTER (lang(?cmt) = "de")
      }
      BIND(COALESCE(?cmt, "") AS ?comment)
    }
    ORDER BY ?label
  `;
}

function getSubGroupsQuery(parentIRI) {
  return `
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?subgroup ?label ?comment
    WHERE {
      ?subgroup schema:isPartOf <${parentIRI}> ;
                a dcterms:Collection .
      OPTIONAL {
        ?subgroup rdfs:label ?lbl .
        FILTER (lang(?lbl) = "de")
      }
      BIND(COALESCE(?lbl, "") AS ?label)

      OPTIONAL {
        ?subgroup rdfs:comment ?cmt .
        FILTER (lang(?cmt) = "de")
      }
      BIND(COALESCE(?cmt, "") AS ?comment)
    }
    ORDER BY ?label
  `;
}

function getInspectionPointsInGroupQuery(groupIRI) {
  return `
    PREFIX : <https://agriculture.ld.admin.ch/inspection/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?point ?label ?comment
    WHERE {
      <${groupIRI}> :includesInspectionPoints ?point .
      OPTIONAL {
        ?point rdfs:label ?lbl .
        FILTER (lang(?lbl) = "de")
      }
      BIND(COALESCE(?lbl, "") AS ?label)

      OPTIONAL {
        ?point rdfs:comment ?cmt .
        FILTER (lang(?cmt) = "de")
      }
      BIND(COALESCE(?cmt, "") AS ?comment)
    }
    ORDER BY ?label
  `;
}

/**
 * Create a stable ID for an IRI, used for <input id="...">.
 */
function generateId(str) {
  return 'id-' + str.replace(/[^a-zA-Z0-9-_:.]/g, '-');
}

/**
 * Build a DOM tree for a group or subgroup, with a checkbox for expand/collapse.
 */
function buildGroupEntry(group, label, comment, level = 0) {
  const container = document.createElement("div");
  container.classList.add("mb-3");

  const checkboxId = generateId(group);

  // The main markup for the group + checkbox
  const entryLabel = document.createElement("div");
  entryLabel.innerHTML = `
    <input type="checkbox" class="expand-checkbox" id="${checkboxId}">
    <label for="${checkboxId}">
      <strong>${label || group}</strong>
    </label>
    ${comment ? `<p class="mb-1"><small>${comment}</small></p>` : ""}
  `;
  container.appendChild(entryLabel);

  // Sub-container for child groups or inspection points
  const subContainer = document.createElement("div");
  subContainer.classList.add("group-children");
  container.appendChild(subContainer);

  // Checkbox behavior: load subgroups/points when checked
  const checkbox = entryLabel.querySelector("input.expand-checkbox");
  checkbox.addEventListener("change", async (evt) => {
    if (!evt.target.checked) {
      subContainer.innerHTML = "";
      return;
    }
    subContainer.innerHTML = `<div class="loading">Lade Untergruppen / Kontrollpunkte...</div>`;
    
    const subGroups = await getSubGroups(group);
    if (subGroups.length > 0) {
      // We have subgroups
      subContainer.innerHTML = "";
      subGroups.forEach((sg) => {
        const sgEl = buildGroupEntry(sg.iri, sg.label, sg.comment, level + 1);
        subContainer.appendChild(sgEl);
      });
    } else {
      // No subgroups => show inspection points
      const points = await getInspectionPointsInGroup(group);
      subContainer.innerHTML = "";
      if (points.length === 0) {
        subContainer.innerHTML = `<div class="inspection-points">Keine Kontrollpunkte.</div>`;
      } else {
        const ul = document.createElement("ul");
        ul.classList.add("inspection-points");
        points.forEach((p) => {
          const li = document.createElement("li");
          li.innerHTML = `${p.label || p.iri}`
            + (p.comment ? `<br><small class="inspection-comment">${p.comment}</small>` : "");
          ul.appendChild(li);
        });
        subContainer.appendChild(ul);
      }
    }
  });

  return container;
}

/**
 * Fetch subgroups for a given group IRI.
 */
async function getSubGroups(parentIRI) {
  const query = getSubGroupsQuery(parentIRI);
  const results = await getSparqlData(query);
  return parseGroups(results);
}

/**
 * Fetch inspection points for a given group IRI.
 */
async function getInspectionPointsInGroup(groupIRI) {
  const query = getInspectionPointsInGroupQuery(groupIRI);
  const results = await getSparqlData(query);
  return parsePoints(results);
}

/**
 * Parse SPARQL JSON results for groups
 */
function parseGroups(json) {
  if (!json || !json.results) return [];
  return json.results.bindings.map((b) => ({
    iri: b.subgroup.value,
    label: b.label?.value ?? "",
    comment: b.comment?.value ?? "",
  }));
}

/**
 * Parse SPARQL JSON results for points
 */
function parsePoints(json) {
  if (!json || !json.results) return [];
  return json.results.bindings.map((b) => ({
    iri: b.point.value,
    label: b.label?.value ?? "",
    comment: b.comment?.value ?? "",
  }));
}

/**
 * Initial load: get top-level groups, render them.
 */
async function loadTopLevelGroups() {
  const container = document.getElementById("tree-container");
  container.innerHTML = `<div class="loading">Lade Top-Level-Gruppen...</div>`;

  const query = getTopLevelGroupsQuery();
  const data = await getSparqlData(query);

  const topGroups = data.results.bindings.map((b) => ({
    iri: b.group.value,
    label: b.label?.value ?? "",
    comment: b.comment?.value ?? "",
  }));

  if (topGroups.length === 0) {
    container.innerHTML = "Keine Top-Level-Kontrollpunkt-Gruppen gefunden.";
    return;
  }

  container.innerHTML = "";
  topGroups.forEach((g) => {
    const gEl = buildGroupEntry(g.iri, g.label, g.comment, 0);
    container.appendChild(gEl);
  });
}

// Kick it off
loadTopLevelGroups();
