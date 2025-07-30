
agricheck
=========

A collection of checkpoints for inspections in the agri-food sector. [Here's an example of such an inspection point.](https://agriculture.ld.admin.ch/inspection/0A60DB5BD8144E25B550D03A3B176B66)

Here are the links to the top-level collections:

- [Legal minimum](https://agriculture.ld.admin.ch/inspection/A07EF60442B92B978AAA3B546480A7C5)
- [Direct payments](https://agriculture.ld.admin.ch/inspection/A07EF60442B92B978BBB3B546480A7C5)
- [Labels](https://agriculture.ld.admin.ch/inspection/A07EF60442B92B978CCC3B546480A7C5)


# The data model

The data model was written using OWL, the web ontology language. It is not only used as a map to write queries, but also for a automatic reasoning process. [You can inspect the data model here.](https://service.tib.eu/webvowl/#iri=https://raw.githubusercontent.com/blw-ofag-ufag/agricheck/refs/heads/main/rdf/ontology.ttl)

# Run the etl pipeline

To run the data integration from excel or XML files to standardized RDF turtle files, run

```sh
sh scripts/pipeline.sh
```

This executes the R script for data conversion (`acontrol.R`, `bioinspecta.R` and `mutterkuh.R`) as well as the data validation, reasoning and merging `validate-syntax.py` and `reason.py`.

# Example queries

- [First three hierarchy levels with URI and labels](https://s.zazuko.com/2r4Xdfn)
- [Get all inspection points with labels, comment and codes](https://s.zazuko.com/2kyE73x)
- [How many inspection points can we find under each inspection point group?](https://s.zazuko.com/76Yr3m)
- [Find inspection point groups with exactly one sub-item](https://s.zazuko.com/32yA9Wd)
- [How many distinct inspection points are there under the public domain?](https://s.zazuko.com/2E3RsSk)
