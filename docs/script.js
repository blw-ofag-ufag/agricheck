document.addEventListener('DOMContentLoaded', () => {
  const SPARQL_ENDPOINT = "https://lindas.admin.ch/query";
  const TREE_CONTAINER = document.getElementById('tree-container');
  const MAX_HEADING_LEVEL = 6;

  const PREFIXES = `
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX schema: <http://schema.org/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
      PREFIX admin:<https://schema.ld.admin.ch/>
      PREFIX : <https://agriculture.ld.admin.ch/inspection/>
  `;

  // --- SPARQL Query Execution ---
  // fetchSparql function remains the same...
  async function fetchSparql(query) {
      const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(PREFIXES + query)}`;
      try {
          const response = await fetch(url, {
              headers: { 'Accept': 'application/sparql-results+json' }
          });
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
          }
          return await response.json();
      } catch (error) {
          console.error("SPARQL query failed:", error);
          displayError(`Failed to fetch data. Check console for details. Error: ${error.message}`, TREE_CONTAINER);
          return null;
      }
  }


  // --- Data Parsing ---
  // parseSparqlJson function remains the same...
   function parseSparqlJson(json, type) {
      if (!json || !json.results || !json.results.bindings) {
          console.warn("Received empty or invalid SPARQL JSON:", json);
          return [];
      }
      return json.results.bindings.map(b => {
          const iri = type === 'group' ? (b.group?.value || b.subgroup?.value) : b.point?.value;
          const labelFallback = iri ? iri.split(/[/#]/).pop() : (type === 'group' ? 'Unnamed Group' : 'Unnamed Point');
          return {
              iri: iri,
              label: b.label?.value || labelFallback,
              comment: b.comment?.value || ""
          };
      });
  }


  // --- UI Rendering ---
  // displayError function remains the same...
   function displayError(message, parentElement = TREE_CONTAINER) {
      const existingError = parentElement.querySelector(':scope > .error-message');
       if (existingError) {
          existingError.textContent = message;
          return;
       }
       if (parentElement === TREE_CONTAINER && !document.body.contains(parentElement)) {
           console.error("Cannot display error, TREE_CONTAINER not found.");
           return
       } else if (parentElement === TREE_CONTAINER) {
           parentElement.innerHTML = '';
       }
      const errorDiv = document.createElement('div');
      errorDiv.classList.add('error-message');
      errorDiv.textContent = message;
      parentElement.appendChild(errorDiv);
  }

  // createGroupElement function updated to set --level-color on details
   function createGroupElement(groupData, level) {
      const containerDiv = document.createElement('div');
      containerDiv.classList.add('group-container');
      // Removed setting color here, will be set on details element
      containerDiv.dataset.iri = groupData.iri;
      containerDiv.dataset.level = level;
      containerDiv.dataset.loaded = 'false';

      const details = document.createElement('details');
      // Set the calculated level color as a CSS variable *on the details element*
      details.style.setProperty('--level-color', calculateColor(level));

      const summary = document.createElement('summary');
      const summaryContent = document.createElement('div');
      summaryContent.classList.add('summary-content');
      const headingLevel = Math.min(level, MAX_HEADING_LEVEL);
      const heading = document.createElement(`h${headingLevel}`);
      heading.textContent = groupData.label;
      summaryContent.appendChild(heading);
      summary.appendChild(summaryContent);
      details.appendChild(summary);

      if (groupData.comment) {
          const commentWrapper = document.createElement('div');
          commentWrapper.classList.add('group-comment-wrapper');
          commentWrapper.textContent = groupData.comment;
          details.appendChild(commentWrapper);
      }

      details.addEventListener('toggle', handleToggle);
      containerDiv.appendChild(details);
      return containerDiv;
  }


  // renderInspectionPoints function updated to add 'checklist-parent' class
  function renderInspectionPoints(pointsData, parentDetailsElement, level) {
      if (pointsData.length === 0) {
          // ... (no points message handling remains same)
          const noPointsDiv = document.createElement('div');
          noPointsDiv.classList.add('loading-indicator');
          noPointsDiv.textContent = 'No inspection points found for this group.';
          const lastStaticElement = parentDetailsElement.querySelector('.group-comment-wrapper') || parentDetailsElement.querySelector('summary');
          if(lastStaticElement) {
              lastStaticElement.insertAdjacentElement('afterend', noPointsDiv);
          } else {
               parentDetailsElement.appendChild(noPointsDiv);
          }
          return;
      }

      // ** NEW: Add class to parent details element **
      parentDetailsElement.classList.add('checklist-parent');

      pointsData.forEach(point => {
          // ... (creating pointDiv, checkbox, wrapper, label, comment remains same)
           const pointDiv = document.createElement('div');
          pointDiv.classList.add('inspection-point');

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `point-${point.iri.replace(/[^a-zA-Z0-9]/g, '-')}`;
          checkbox.value = point.iri;

          const pointLabelCommentWrapper = document.createElement('div');
          pointLabelCommentWrapper.classList.add('point-label-comment-wrapper');

          const label = document.createElement('label');
          label.htmlFor = checkbox.id;
          label.textContent = point.label;
          pointLabelCommentWrapper.appendChild(label);

          if (point.comment) {
              const comment = document.createElement('p');
              comment.classList.add('point-comment');
              comment.textContent = point.comment;
              pointLabelCommentWrapper.appendChild(comment);
          }

          pointDiv.appendChild(checkbox);
          pointDiv.appendChild(pointLabelCommentWrapper);

          parentDetailsElement.appendChild(pointDiv);
      });
  }


  // --- Event Handling & Data Loading Logic ---
  // handleToggle function remains the same...
  async function handleToggle(event) {
      const detailsElement = event.target;
      const containerDiv = detailsElement.closest('.group-container');
      if (!containerDiv || detailsElement.tagName !== 'DETAILS') { return; }

      if (detailsElement.open && containerDiv.dataset.loaded === 'false') {
          containerDiv.dataset.loaded = 'true';
          const groupIri = containerDiv.dataset.iri;
          const currentLevel = parseInt(containerDiv.dataset.level, 10);

          const loadingIndicator = document.createElement('div');
          loadingIndicator.textContent = 'Loading...';
          loadingIndicator.classList.add('loading-indicator');
          const lastStaticElement = detailsElement.querySelector('.group-comment-wrapper') || detailsElement.querySelector('summary');
          if (lastStaticElement) { lastStaticElement.insertAdjacentElement('afterend', loadingIndicator); }
          else { detailsElement.appendChild(loadingIndicator); }

          let contentAdded = false;
          let fetchErrorOccurred = false;

          try {
              const subGroups = await fetchSubGroups(groupIri);
              if (subGroups === null) { fetchErrorOccurred = true; }
              else if (subGroups.length > 0) {
                  // ** Before adding subgroup, remove checklist-parent class if it exists **
                  // (Handles cases where data might change - e.g. points removed, subgroups added)
                  detailsElement.classList.remove('checklist-parent');

                  subGroups.forEach(subGroup => {
                      const subGroupElement = createGroupElement(subGroup, currentLevel + 1);
                      detailsElement.appendChild(subGroupElement);
                  });
                  contentAdded = true;
              } else {
                  const inspectionPoints = await fetchInspectionPoints(groupIri);
                  if (inspectionPoints === null) { fetchErrorOccurred = true; }
                  else {
                      // renderInspectionPoints adds the class if points exist
                      renderInspectionPoints(inspectionPoints, detailsElement, currentLevel + 1);
                      if (inspectionPoints.length > 0) contentAdded = true;
                      else {
                          // ** If no points were rendered, ensure class is removed **
                          detailsElement.classList.remove('checklist-parent');
                      }
                  }
              }
          } catch(error) {
               console.error("Error processing subgroups or points:", error);
               displayError(`Error displaying content: ${error.message}`, detailsElement);
               fetchErrorOccurred = true;
          } finally {
               if (loadingIndicator.parentNode === detailsElement) {
                  detailsElement.removeChild(loadingIndicator);
               }
               if (!contentAdded && !fetchErrorOccurred) {
                  const noChildrenDiv = document.createElement('div');
                  noChildrenDiv.classList.add('loading-indicator');
                  noChildrenDiv.textContent = 'No subgroups or inspection points found.';
                  detailsElement.classList.remove('checklist-parent'); // Ensure class removed if empty
                  const lastElement = detailsElement.querySelector('.inspection-point:last-of-type') || detailsElement.querySelector('.group-container:last-of-type') || detailsElement.querySelector('.group-comment-wrapper') || detailsElement.querySelector('summary');
                   if(lastElement) { lastElement.insertAdjacentElement('afterend', noChildrenDiv); }
                   else { detailsElement.appendChild(noChildrenDiv); }
               }
          }
      } else if (!detailsElement.open) { /* Optional close logic */ }
  }


  // fetchSubGroups function remains the same...
  async function fetchSubGroups(parentIri) {
      if (!parentIri) return null;
      const safeParentIri = `<${parentIri}>`;
      const query = ` SELECT ?subgroup ?label ?comment WHERE { BIND(${safeParentIri} AS ?parentGroup) ?subgroup schema:isPartOf ?parentGroup ; a dcterms:Collection . OPTIONAL { ?subgroup skos:prefLabel|rdfs:label ?lbl . FILTER (langMatches(lang(?lbl), "de") || langMatches(lang(?lbl), "")) } OPTIONAL { ?subgroup rdfs:comment ?cmt . FILTER (langMatches(lang(?cmt), "de") || langMatches(lang(?cmt), "")) } BIND(COALESCE(?lbl, "") AS ?label) BIND(COALESCE(?cmt, "") AS ?comment) } ORDER BY ?label `;
      const json = await fetchSparql(query);
      return json ? parseSparqlJson(json, 'group') : null;
  }

  // fetchInspectionPoints function remains the same...
  async function fetchInspectionPoints(groupIri) {
      if (!groupIri) return null;
      const safeGroupIri = `<${groupIri}>`;
      const query = ` SELECT ?point ?label ?comment WHERE { BIND(${safeGroupIri} AS ?groupIRI) ?groupIRI :includesInspectionPoints ?point . OPTIONAL { ?point skos:prefLabel|rdfs:label ?lbl . FILTER (langMatches(lang(?lbl), "de") || langMatches(lang(?lbl), "")) } OPTIONAL { ?point rdfs:comment ?cmt . FILTER (langMatches(lang(?cmt), "de") || langMatches(lang(?cmt), "")) } BIND(COALESCE(?lbl, "") AS ?label) BIND(COALESCE(?cmt, "") AS ?comment) } ORDER BY ?label `;
      const json = await fetchSparql(query);
      return json ? parseSparqlJson(json, 'point') : null;
  }


  // --- Color Calculation ---
  // ** UPDATED for inverted shading (dark to light) **
  function calculateColor(level) {
      const baseHue = 210;        // Blueish base color
      const baseSaturation = 55;  // Slightly adjusted saturation
      const startLightness = 65;  // Start darker for level 1
      const lightnessStep = 8;    // How much *lighter* each level gets
      const maxLightness = 95;    // Cap near white (don't exceed)

      // Increase lightness for deeper levels, but ensure it doesn't exceed maxLightness
      const targetLightness = Math.min(maxLightness, startLightness + ((level - 1) * lightnessStep));

      return `hsl(${baseHue}, ${baseSaturation}%, ${targetLightness}%)`;
  }


  // --- Initial Load ---
  // initialize function remains the same...
  async function initialize() {
      const query = ` SELECT ?group ?label ?comment WHERE { ?group a dcterms:Collection . FILTER NOT EXISTS { ?group schema:isPartOf ?someParent . } OPTIONAL { ?group skos:prefLabel|rdfs:label ?lbl . FILTER (langMatches(lang(?lbl), "de") || langMatches(lang(?lbl), "")) } OPTIONAL { ?group rdfs:comment ?cmt . FILTER (langMatches(lang(?cmt), "de") || langMatches(lang(?cmt), "")) } BIND(COALESCE(?lbl, "") AS ?label) BIND(COALESCE(?cmt, "") AS ?comment) } ORDER BY ?label `;
      TREE_CONTAINER.innerHTML = '<p class="loading-indicator" style="padding-left: 15px;">Loading top-level groups...</p>';
      const json = await fetchSparql(query);
      if (json) {
          const topLevelGroups = parseSparqlJson(json, 'group');
           if (document.body.contains(TREE_CONTAINER)) { TREE_CONTAINER.innerHTML = ''; }
           else { console.error("TREE_CONTAINER not found after initial fetch."); return; }

          if (topLevelGroups.length === 0) {
              TREE_CONTAINER.innerHTML = '<p style="padding-left: 15px;">No top-level groups found.</p>';
          } else {
              topLevelGroups.forEach(group => {
                  const groupElement = createGroupElement(group, 1);
                  TREE_CONTAINER.appendChild(groupElement);
              });
          }
      }
  }

  initialize();
});