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

# create an ID for each row in the data set
data$URI <- NA
for (i in 1:nrow(data)) {
  data[i,"URI"] <- uri(toupper(rlang::hash(data[i,"Code"])), base)
}

# determine the parent of each point
data$parent <- NA
for (i in 1:nrow(data)) {
  sub("\\.[^.]*$", "", data[i,"Code"])
  data[i,"parent"] <- as.character(subset(data, Code==sub("\\.[^.]*$", "", data[i,"Code"]), select = URI))
}
data[data$parent=="character(0)","parent"] <- uri("A3B3FF82CFC6FC6683E03B546480AE08", base)

# determine the hierarchylevel of each point
data$hierarchyLevel <- NA
for (i in 1:nrow(data)) {
  data[i,"hierarchyLevel"] <- length(strsplit(as.character(data[i,"Code"]), "\\.")[[1]]) + 1
}

# loop trough each row, determine type and handle accordingly
sink("rdf/bioinspecta.ttl")
cat(prefixes)
cat("
:A3B3FF82CFC6FC6683E03B546480AE08 a dcterms:Collection ;
    rdfs:comment \"\"\"
    Hier aufgeführt sind die Anforderungen der BioSuisse, welche über die Verordnung über die biologische Landwirtschaft und die Kennzeichnung biologisch produzierter Erzeugnisse und Lebensmittel (Bio-Verordnung) hinausgehen.
    Die Informationen kommen aus einer Excel-Liste von bio.inspecta.
    \"\"\"@de .
")
for (i in 1:nrow(data))
{
  subject <- as.character(data[i,"URI"])
  if (as.character(data[i,"Art"]) == "Kategorie")
  {
    rdfhelper::triple(subject, "a", uri("http://purl.org/dc/terms/Collection"))
    collection <- subject # assign a new parent for subsequent use
    triple(subject, "schema:isPartOf", as.character(data[i,"parent"]))
    triple(subject, ":hierarchyLevel", literal(as.character(data[i,"hierarchyLevel"])))
  }
  else
  {
    rdfhelper::triple(subject, "a", uri("InspectionPoint", base))
    rdfhelper::triple(subject, uri("belongsToGroup", base), collection)
  }
  rdfhelper::triple(subject, "schema:identifier", literal(as.character(data[i,"Code"])))
  oldtext <- ""
  for (variable in c("Bezeichnung", "Text", "Beschreibung")) {
    text <- data[i, variable] |>
      as.character() |>
      gsub(pattern = "[\r\n]", replacement = " ", x = _) |> # remove any newline or carriage commands
      gsub(pattern = "\\s+", replacement = " ", x = _) |> # replace any sequence of whitespaces by one single whitespace
      gsub(pattern = "\\s+$", replacement = "", x = _) # remove any trailing whitespaces
    if(!is.na(text) && text != oldtext) {
      rdfhelper::triple(
        subject = subject,
        predicate = ifelse(variable=="Bezeichnung", "rdfs:label", "rdfs:comment"),
        object = langstring(text, "de")
      )
    }
    oldtext <- text
  }
}
sink()
