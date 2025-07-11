library(readxl)
library(rdfhelper)

# define RDF prefixes, bases etc.
base <- "https://agriculture.ld.admin.ch/inspection/"
prefixes <- "
@prefix : <https://agriculture.ld.admin.ch/inspection/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
"

# read Excel file
data <- readxl::read_excel("data/data_Bioinspecta.xlsx", skip = 1)

# subset only two "classes"
data <- subset(data, subset = data$Art %in% c("Kategorie", "CheckPunkt"))

# loop trough each row, determine type and handle accordingly
sink("rdf/raw_bioinspecta.ttl")
cat(prefixes)
for (i in 1:nrow(data))
{
  subject <- uri(rdfhelper::nano(l = 20, prefix = "Q"), base)
  if (as.character(data[i,"Art"]) == "Kategorie")
  {
    rdfhelper::triple(subject, "a", uri("http://purl.org/dc/terms/Collection"))
    parent <- subject # assign a new parent for subsequent use

    # TODO: To which overall parent do these groups belong?
    # (probably something like "BioSuisse inspection points")
    triple(subject, "schema:isPartOf", uri("QbS4eJtXm3LDNMeF1oil", base))

  }
  else
  {
    rdfhelper::triple(subject, "a", uri("InspectionPoint", base))
    rdfhelper::triple(subject, uri("belongsToGroup", base), parent)
  }
  rdfhelper::triple(subject, "schema:identifier", literal(as.character(data[i,"Code"])))
  for (variable in c("Bezeichnung", "Text", "Beschreibung")) {
    text <- data[i, variable] |>
      as.character() |>
      gsub(pattern = "[\r\n]", replacement = " ", x = _) |> # remove any newline or carriage commands
      gsub(pattern = "\\s+", replacement = " ", x = _) |> # replace any sequence of whitespaces by one single whitespace
      gsub(pattern = "\\s+$", replacement = "", x = _) # remove any trailing whitespaces
    rdfhelper::triple(
      subject = subject,
      predicate = ifelse(variable=="Bezeichnung", "rdfs:label", "rdfs:comment"),
      object = langstring(text, "de")
      )
  }
}
sink()
