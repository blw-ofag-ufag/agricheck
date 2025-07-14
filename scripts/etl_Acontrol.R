# libraries
library(rdfhelper) # from https://github.com/Damian-Oswald/rdfhelper
library(cld2)
library(xml2)
library(purrr)
library(dplyr)
library(stringr)

# define RDF prefixes, bases etc.
base <- "https://agriculture.ld.admin.ch/inspection/"
prefixes <- "
@prefix : <https://agriculture.ld.admin.ch/inspection/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
"

# read Acontrol XML
url <- "https://backend.blw.admin.ch/fileservice/sdweb-docs-prod-blwch-files/files/2024/09/09/d9cdabc0-2f76-4343-8ec5-5e5bd328dce1.zip"
temp_zip <- tempfile(fileext = ".zip")
unzip_dir <- tempdir()
download.file(url, temp_zip, mode = "wb")
unzip(temp_zip, exdir = unzip_dir)
xml_file_path <- file.path(unzip_dir, "Masterliste 2025.xml")
XML <- read_xml(xml_file_path)
rm(xml_file_path, url, temp_zip, unzip_dir)

# HELPER FUNCTIONS
# ================

# function to convert one [thing] description
describe <- function(x, class, hierarchyLevel = NULL, relationPredicate = "schema:isPartOf") {
  subject <- x |> getElement("versionStableId") |> unlist() |> uri(base)
  triple(subject, "a", uri(class))
  for (tag in c("elementShortName", "elementName")) {
    for (lang in c("De", "Fr", "It")) {
      predicate <- ifelse(tag=="elementShortName", "rdfs:label", "rdfs:comment")
      langKey <- paste0("name", lang)
      text <- x |> getElement(tag) |>
        getElement(langKey) |>
        unlist()
      text |>
        langstring(tolower(lang), multiline = tag=="elementName") |>
        triple(subject, predicate, object = _)
    }
  }
  x |>
    getElement("parentVersionStableId") |>
    unlist() |>
    uri(prefix = base) |>
    triple(subject, relationPredicate, object = _)
  x |>
    getElement("elementId") |>
    unlist() |>
    literal() |>
    triple(subject, "schema:identifier", object = _)
  x |>
    getElement("conjunctElementId") |>
    unlist() |>
    literal() |>
    triple(subject, uri("conjunctIdentifier", base), object = _)

  if(!is.null(hierarchyLevel)) {
    triple(subject, ":hierarchyLevel", literal(hierarchyLevel))
  }
}

# convert (a part of the XML) to an R list for quicker processing
xml_to_list <- function(XML, xpath) {
  XML |>
    xml_find_all(xpath) |>
    as_list()
}

# PARSE RUBRICS
# =============

sink("rdf/acontrol.ttl")

cat(prefixes)

# convert XML to R list containing all data
data <- xml_to_list(XML, "//rubric")

# convert all rubrics
for (i in 1:length(data)) {
  data[[i]][["description"]] |>
    describe(class = "http://purl.org/dc/terms/Collection", hierarchyLevel = 3)
}

# PARSE GROUPS
# =============

# convert XML to R list containing all data
data <- xml_to_list(XML, "//group")

# convert all rubrics
for (i in 1:length(data)) {
  data[[i]][["description"]] |>
    describe(class = "http://purl.org/dc/terms/Collection", hierarchyLevel = 4)
}

# PARSE INSPECTION POINTS
# =======================

# convert XML to R list containing all data
data <- xml_to_list(XML, "//point")

# convert all rubrics
for (i in 1:length(data)) {
  data[[i]][["description"]] |>
    describe(class = "https://agriculture.ld.admin.ch/inspection/InspectionPoint", relationPredicate = ":belongsToGroup")
}

sink()

