# libraries
library(rdfhelper) # from https://github.com/Damian-Oswald/rdfhelper
library(cld2)
library(xml2)
library(purrr)
library(dplyr)
library(stringr)

# read Acontrol XML
url <- "https://backend.blw.admin.ch/fileservice/sdweb-docs-prod-blwch-files/files/2024/09/09/d9cdabc0-2f76-4343-8ec5-5e5bd328dce1.zip"
temp_zip <- tempfile(fileext = ".zip")
unzip_dir <- tempdir()
download.file(url, temp_zip, mode = "wb")
unzip(temp_zip, exdir = unzip_dir)
xml_file_path <- file.path(unzip_dir, "Masterliste 2025.xml")
XML <- read_xml(xml_file_path)
rm(xml_file_path, url, temp_zip, unzip_dir)

# convert XML to R list containing all data
data <- XML |>
  xml_find_all("//exportRubric") |>
  as_list()


# helper that returns NA if the target node is empty or missing
txt_or_na <- function(node, path) {
  val <- xml_text(xml_find_first(node, path), trim = TRUE)
  ifelse(str_length(val) == 0, NA_character_, val)
}

# convert rubrics to table
rubrics_tbl <- xml_find_all(XML, ".//rubric/description") %>%      # one <description> per rubric
  map_dfr(~{
    tibble(
      versionStableId        = txt_or_na(.x, "./versionStableId"),
      parentVersionStableId  = txt_or_na(.x, "./parentVersionStableId"),
      elementId              = txt_or_na(.x, "./elementId"),
      conjunctElementId      = txt_or_na(.x, "./conjunctElementId"),
      elementName_de         = txt_or_na(.x, "./elementName/nameDe"),
      elementName_fr         = txt_or_na(.x, "./elementName/nameFr"),
      elementName_it         = txt_or_na(.x, "./elementName/nameIt"),
      elementShortName_de    = txt_or_na(.x, "./elementShortName/nameDe"),
      elementShortName_fr    = txt_or_na(.x, "./elementShortName/nameFr"),
      elementShortName_it    = txt_or_na(.x, "./elementShortName/nameIt")
    )
  })

# peek at the result
print(rubrics_tbl)



