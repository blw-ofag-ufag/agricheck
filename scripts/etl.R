library(rdfhelper) # from https://github.com/Damian-Oswald/rdfhelper
library(cld2)

# read data
data = readxl::read_excel("data/data.xlsx")

# see where text fields are fucked up and fix those lines
for (i in which(!is.na(data[,33]))) {
  
  # get the entire end of the row, omit all NA fields
  x = as.character(na.omit(t(data[i,30:ncol(data)])))
  
  # classify string languages
  lang = detect_language(x)
  print(lang)

  # detect at what point language flips from German to Italian
  s = min(which(lang=="it"))
  
  # construct the reparation of the line
  repaired = data.frame(data[i,1:29],
                        HILFETEXT_DE = paste(x[1:(s-1)], collapse = " "),
                        HILFETEXT_IT = paste(x[s:(length(x)-1)], collapse = " "),
                        NAME = tail(x,1))
  
  # insert corrected row
  data[i,1:32] <- repaired
}

# remove superfluous parts of data frame
data <- data[,1:32]

# sort by mastersort
data <- data[order(data$MASTERSORT),]

# function to truncate extended UUID
truncateUUID <- function(x) {
  unlist(strsplit(x, "_"))[1]
}

# define constants
base = "https://agriculture.ld.admin.ch/inspection/"
classes = c(Gruppe = uri("http://purl.org/dc/terms/Collection"),
            Kontrollpunkt = uri("InspectionPoint", base))

# construct turtle file
sink("rdf/data.ttl")

# set prefixes
cat("\n@prefix : <https://agriculture.ld.admin.ch/inspection/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n")

# loop over each row in dataset
for (i in 1:nrow(data)) {
  
  # construct IRI for the *thing* and define its class
  IRI = uri(data[i,"UUID"], base)
  class = classes[as.character(data[i,"NAME"])]
  level = as.character(data[i,"EBENE"])
  if(!is.na(class)) triple(IRI, "a", class) |> cat()
  if(!is.na(level)) triple(IRI, ":hierarchyLevel", literal(level)) |> cat()
  
  # give the thing a rdfs:label in German, French and Italian
  for (lang in c("de", "fr", "it")) {
    
    x = data[i,paste0("BEZEICHNUNG_",toupper(lang))]
    if(is.na(x)) next
    
    # Escape both double quotes (") and single quotes (')
    x = gsub('"', "\\\\\"", as.character(x))
    
    # write triple
    triple(IRI, "rdfs:label", langstring(x, lang = lang)) |> cat()
  }
  
  # give the thing a rdfs:comment (description) in German and Italian (French is missing)
  for (lang in c("de","it")) {
    x = data[i,paste0("HILFETEXT_",toupper(lang))]
    y = data[i,paste0("BEZEICHNUNG_",toupper(lang))]
    if(is.na(x)) next
    if(!is.na(y)) if(x==y) next # don't write the comment if it's the same as the label
    x = gsub('"', "\\\\\"", as.character(x))
    triple(IRI, "rdfs:comment", langstring(x, lang = lang)) |> cat()
  }
}
sink()

