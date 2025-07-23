# Run R preprocessing steps
for r in acontrol bioinspecta mutterkuh; do
  Rscript "scripts/${r}.R"
done

# Validate and reason over the RDF
python3 scripts/validate-syntax.py
python3 scripts/reason.py rdf/{ontology,bioinspecta,mapping,acontrol,mutterkuh}.ttl
