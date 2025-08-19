
AGRICHECK
=========

The current multitude of inspections in both the private and public sectors represents a significant administrative burden for farms in Switzerland. With over 5000 inspection points[^1] and more than 20 different inspection programs, the system lacks a user-friendly coordination. Existing processes are neither very digitized nor harmonized, leading to redundancies and inefficiencies for both farmers and authorities.

[^1]: Here, an inspection point is a specific, verifiable criterion within an agricultural control program used to assess a farm's compliance with a particular regulation or standard.

The goal of agricheck is to first collect and harmonize inspection points from both the private and public agricultural sector, and second to provide [a simple web application for farmers](https://blw-ofag-ufag.github.io/agricheck/) to quickly search and navigate these inspection points.

# The data

The data from various sources is standardized and freely provided in the RDF format via the linked data service LINDAS by the Federal Archive. [Here's an example example inspection point as a linked data object on LINDAS.](https://agriculture.ld.admin.ch/inspection/0A60DB5BD8144E25B550D03A3B176B66)

The data of agricheck is organized hierarchically.
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

- [Get all inspection points with labels, comment and codes](https://s.zazuko.com/2kyE73x)
- [Find inspection point groups with exactly one sub-item](https://s.zazuko.com/32yA9Wd)
- [How many distinct inspection points are there under the public domain?](https://s.zazuko.com/2E3RsSk)
