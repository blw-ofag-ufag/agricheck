# Run R preprocessing steps
for r in acontrol bioinspecta mutterkuh qm swissgap sga; do
  Rscript "scripts/${r}.R"
done

# Process RDF files using Python scrips
python3 scripts/validate-syntax.py
python3 scripts/reason.py rdf/{ontology,bioinspecta,mapping,acontrol,mutterkuh,qm,swissgap,sga}.ttl
python3 scripts/remove-redundancy.py
python3 scripts/validate-shape.py