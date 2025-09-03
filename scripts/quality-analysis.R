library(rdfhelper)
library(stringdist)
library(redland)

# helper function: Normalized Levenshtein distance
normalized_lv <- function(x)
{
  dist <- stringdist::stringdist(x[[1]], x[[2]], "lv")
  dist / max(nchar(x[[1]]), nchar(x[[2]]))
}

# define sparql query
query <- "
PREFIX : <https://agriculture.ld.admin.ch/inspection/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX schema: <http://schema.org/>
SELECT DISTINCT *
FROM <https://lindas.admin.ch/foag/inspections>
WHERE {
  :42EA1020A8742ACABFB1B7A426619C42
    schema:hasPart+/:includesInspectionPoints* ?uri .
  ?uri schema:name ?name ;
    schema:description ?description .
  FILTER(LANG(?name)=LANG(?description))
  BIND(LANG(?name) AS ?lang)
}
"

# query data
data <- rdfhelper::sparql(query, "https://ld.admin.ch/query")

# compute the Normalized Levenshtein distance
# (we want to make the metric length-agnostic)
data$dist <- apply(data[, c("name", "description")], 1, normalized_lv)

# rearrange data, we want the most similar names/descriptions on top
data <- data[order(data$dist, decreasing = FALSE), ]

# View results
View(data)