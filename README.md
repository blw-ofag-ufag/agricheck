agricheck
=========

A collection of checkpoints for inspections in the agri-food sector. [Here's an example of such an inspection point.](https://agriculture.ld.admin.ch/inspection/0A60DB5BD8144E25B550D03A3B176B66)

# The data model

The data model was written using OWL, the web ontology language. It is not only used as a map to write queries, but also for a automatic reasoning process. [You can inspect the data model here.](https://service.tib.eu/webvowl/#iri=https://raw.githubusercontent.com/blw-ofag-ufag/agricheck/refs/heads/main/rdf/ontology.ttl)

# Example queries

- [Return the URI, name and level of each inspection point](https://s.zazuko.com/GA9HNb)
- [How many inspection points can we find under each inspection point group?](https://s.zazuko.com/24AEuhj)
- [Find inspection point groups with exactly one sub-item](https://s.zazuko.com/3pmApnf)

```
PREFIX : <https://agriculture.ld.admin.ch/inspection/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT ?grandParent ?grandParentLabel ?parent ?parentLabel ?child ?childLabel ?childIdentifier
WHERE {
  ?grandParent a dcterms:Collection ;
    :hierarchyLevel "1" ;
    schema:hasPart ?parent ;
    rdfs:label ?grandParentLabel .
  ?parent a dcterms:Collection ;
    schema:hasPart ?child ;
    rdfs:label ?parentLabel .
  ?child a dcterms:Collection ;
    rdfs:label ?childLabel ;
    schema:identifier ?childIdentifier .
  FILTER(LANG(?parentLabel)="de" && LANG(?childLabel)="de" && LANG(?grandParentLabel)="de")
}
ORDER BY ?childIdentifier
```