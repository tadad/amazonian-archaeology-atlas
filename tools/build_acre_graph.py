#!/usr/bin/env python3
"""Build the Acre research graph using the El Salvador vault ontology.

The generated graph is deliberately bibliography-first. Paper records distinguish
locally archived PDFs, open-access links, repository metadata, unpublished reports,
and bibliographic leads so that discovery breadth is not confused with source review.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VAULT = ROOT / "vault"
COLLECTIONS = ("Places", "Periods", "Cultures", "Papers", "Authors", "Organizations")


def slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")


def q(value: object) -> str:
    return json.dumps(str(value), ensure_ascii=False)


def yaml_value(key: str, value: object) -> list[str]:
    if value is None:
        return [f"{key}:"]
    if isinstance(value, bool):
        return [f"{key}: {'true' if value else 'false'}"]
    if isinstance(value, (int, float)):
        return [f"{key}: {value}"]
    return [f"{key}: {q(value)}"]


def yaml_list(key: str, values: list[str]) -> list[str]:
    if not values:
        return [f"{key}: []"]
    return [f"{key}:", *(f"  - {q(value)}" for value in values)]


def frontmatter(blocks: list[list[str]]) -> str:
    return "\n".join(["---", *(line for block in blocks for line in block), "---", ""])


def author_link(name: str) -> str:
    return f"[[Authors/{slug(name)}|{name}]]"


def paper_link(paper_id: str) -> str:
    paper = PAPERS_BY_ID[paper_id]
    return f"[[Papers/{paper_id}|{paper['title']}]]"


def paper_authors(paper_id: str) -> list[str]:
    """Load large collaborative author lists from checked-in source metadata."""
    filename = ROOT / "_data" / "paper-authors" / f"{paper_id}.json"
    record = json.loads(filename.read_text(encoding="utf-8"))
    if record.get("paper_id") != paper_id or not isinstance(record.get("authors"), list):
        raise ValueError(f"invalid author metadata for {paper_id}")
    return [str(name) for name in record["authors"]]


def culture_link(culture_id: str) -> str:
    culture = CULTURES_BY_ID[culture_id]
    return f"[[Cultures/{culture_id}|{culture['name']}]]"


def period_link(period_id: str) -> str:
    period = PERIODS_BY_ID[period_id]
    return f"[[Periods/{period_id}|{period['name']}]]"


PAPERS = [
    {
        "id": "1988-dias-carvalho-estruturas-terra-acre",
        "title": "As estruturas de terra na arqueologia do Acre",
        "authors": ["Ondemar Ferreira Dias Jr.", "Eliana Teixeira de Carvalho"],
        "year": 1988,
        "work_type": "article",
        "languages": ["pt"],
        "source_url": "https://www.scielo.br/j/bgoeldi/a/Kj3Q49dRQx48JSfShXQsQ6P/",
        "access_status": "bibliographic-lead",
        "scope": "First published description of eight Acre earthwork sites located during PRONAPABA; reprinted on pages 45-56 of the 2008 edited volume.",
    },
    {
        "id": "2001-ranzi-aguiar-registro-geoglifos",
        "title": "Registro de geoglifos na região Amazônica - Brasil",
        "authors": ["Alceu Ranzi", "Rodrigo Luiz Simas de Aguiar"],
        "year": 2001,
        "work_type": "article",
        "languages": ["pt"],
        "source_url": "https://portal.iphan.gov.br/uploads/ckfinder/arquivos/Geoglifos_paisagens_da_amazonia_ocidental.pdf",
        "access_status": "bibliographic-lead",
        "scope": "Early aerial and regional registration of Amazonian geoglyphs; references variously date the Munda 42 publication to 2000 or 2001.",
    },
    {
        "id": "2003-parssinen-ranzi-saunaluoma-siiriainen-rio-branco",
        "title": "Geometrically Patterned Ancient Earthworks in the Rio Branco Region of Acre, Brazil",
        "authors": ["Martti Pärssinen", "Alceu Ranzi", "Sanna Saunaluoma", "Ari Siiriäinen"],
        "year": 2003,
        "work_type": "book-chapter",
        "languages": ["en"],
        "source_url": "https://researchportal.helsinki.fi/en/publications/western-amazonia-amaz%C3%B4nia-ocidental/",
        "access_status": "bibliographic-lead",
        "scope": "Foundational regional synthesis of geometric earthworks, roads, chronology, and proposed social complexity in the Rio Branco region.",
    },
    {
        "id": "2003-ranzi-geoglifos-patrimonio-cultural-acre",
        "title": "Geoglifos: patrimônio cultural do Acre",
        "authors": ["Alceu Ranzi"],
        "year": 2003,
        "work_type": "book-chapter",
        "languages": ["pt"],
        "source_url": "https://portal.iphan.gov.br/uploads/ckfinder/arquivos/Geoglifos_paisagens_da_amazonia_ocidental.pdf",
        "access_status": "bibliographic-lead",
        "scope": "Early heritage inventory and advocacy chapter in Western Amazonia - Amazônia Ocidental, pages 135-172.",
    },
    {
        "id": "2004-ranzi-aguiar-geoglifos-perspectiva-aerea",
        "title": "Geoglifos da Amazônia: perspectiva aérea",
        "authors": ["Alceu Ranzi", "Rodrigo Luiz Simas de Aguiar"],
        "year": 2004,
        "work_type": "book",
        "languages": ["pt"],
        "source_url": "https://portal.iphan.gov.br/uploads/ckfinder/arquivos/Geoglifos_paisagens_da_amazonia_ocidental.pdf",
        "access_status": "bibliographic-lead",
        "scope": "Aerial photographic documentation and typological discussion of Acre geoglyphs.",
    },
    {
        "id": "2005-ranzi-parssinen-barbosa-novos-vestigios",
        "title": "Geoglifos da Amazônia Ocidental: novos vestígios arqueológicos no estado do Acre, Brasil",
        "authors": ["Alceu Ranzi", "Martti Pärssinen", "Antonia Damasceno Barbosa"],
        "year": 2005,
        "work_type": "article",
        "languages": ["pt"],
        "source_url": "https://revista.sabnet.org/ojs/index.php/sab/",
        "access_status": "bibliographic-lead",
        "scope": "Reports newly recognized earthworks and expands the documented Acre distribution.",
    },
    {
        "id": "2006-dias-estruturas-arqueologicas-terra-acre",
        "title": "As estruturas arqueológicas de terra no estado do Acre - Amazônia Ocidental, Brasil: um caso de resiliência?",
        "authors": ["Ondemar Ferreira Dias Jr."],
        "year": 2006,
        "work_type": "book-chapter",
        "languages": ["pt"],
        "source_url": "https://portal.iphan.gov.br/uploads/ckfinder/arquivos/Geoglifos_paisagens_da_amazonia_ocidental.pdf",
        "access_status": "bibliographic-lead",
        "scope": "Expanded account of PRONAPABA-era Acre research and earth structures, pages 59-168 in Estudos Contemporâneos de Arqueologia.",
    },
    {
        "id": "2007-ranzi-feres-brown-internet-software",
        "title": "Internet Software Programs Aid in Search for Amazonian Geoglyphs",
        "authors": ["Alceu Ranzi", "Roberto Feres", "Foster Brown"],
        "year": 2007,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1029/2007EO210003",
        "source_url": "https://doi.org/10.1029/2007EO210003",
        "access_status": "publisher-record",
        "scope": "Documents the use of online satellite imagery to discover and monitor geoglyphs.",
    },
    {
        "id": "2007-schaan-parssinen-ranzi-piccoli-complexidade",
        "title": "Geoglifos da Amazônia Ocidental: evidência de complexidade social entre povos de terra firme",
        "authors": ["Denise Pahl Schaan", "Martti Pärssinen", "Alceu Ranzi", "Jacqueline Piccoli"],
        "year": 2007,
        "work_type": "article",
        "languages": ["pt"],
        "doi": "10.24885/sab.v20i1.229",
        "source_url": "https://revista.sabnet.org/ojs/index.php/sab/article/view/229",
        "access_status": "open-access",
        "scope": "Early synthesis arguing that monumental Acre earthworks imply organized labour and regional social complexity.",
    },
    {
        "id": "2008-schaan-ranzi-parssinen-arqueologia-amazonia-ocidental",
        "title": "Arqueologia da Amazônia Ocidental: os geoglifos do Acre",
        "authors": ["Denise Pahl Schaan", "Alceu Ranzi", "Martti Pärssinen"],
        "year": 2008,
        "work_type": "edited-book",
        "languages": ["pt"],
        "source_url": "https://madrid.fi/libro/arqueologia-da-amazonia-ocidental/",
        "access_status": "open-access",
        "scope": "192-page foundational anthology covering Acre research history, pioneering reports, earthworks, rescue archaeology, Indigenous comparisons, and a site inventory.",
    },
    {
        "id": "2009-parssinen-schaan-ranzi-upper-purus",
        "title": "Pre-Columbian Geometric Earthworks in the Upper Purús: A Complex Society in Western Amazonia",
        "authors": ["Martti Pärssinen", "Denise Pahl Schaan", "Alceu Ranzi"],
        "year": 2009,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1017/S0003598X00099373",
        "source_url": "https://doi.org/10.1017/S0003598X00099373",
        "access_status": "open-access",
        "scope": "Regional model based on earthwork scale, roads, ceramics, radiocarbon dating, and labour estimates.",
    },
    {
        "id": "2010-schaan-et-al-construindo-paisagens",
        "title": "Construindo paisagens como espaços sociais: o caso dos geoglifos do Acre",
        "authors": ["Denise Pahl Schaan", "Miriam Bueno", "Alceu Ranzi", "Antonia Damasceno Barbosa", "Arlan Hudson Souza e Silva", "Edegar Casagrande", "Allana Rodrigues", "Alessandra Dantas", "Ivandra Rampanelli"],
        "year": 2010,
        "work_type": "article",
        "languages": ["pt"],
        "doi": "10.24885/sab.v23i1.286",
        "source_url": "https://revista.sabnet.org/ojs/index.php/sab/article/view/286",
        "access_status": "open-access",
        "scope": "Landscape-archaeology synthesis of excavations, spatial relations, roads, and social use of Acre geoglyphs.",
    },
    {
        "id": "2012-carmo-relacoes-geoambientais-geoglifos",
        "title": "Relações geoambientais nos geoglifos do sudeste do estado do Acre",
        "authors": ["Lúcio Flávio Zancanela do Carmo"],
        "contributors": ["Carlos Ernesto Gonçalves Reynaud Schaefer"],
        "year": 2012,
        "work_type": "thesis",
        "languages": ["pt"],
        "source_url": "https://locus.ufv.br/items/87c978bf-002e-468a-8dd4-7f3dc3bd2021",
        "access_status": "open-access",
        "scope": "Pedological, geomorphological, and artifact study of southeastern Acre geoglyph settings.",
    },
    {
        "id": "2012-saunaluoma-fazenda-atlantica-quinaua",
        "title": "Geometric Earthworks in the State of Acre, Brazil: Excavations at the Fazenda Atlântica and Quinauá Sites",
        "authors": ["Sanna Saunaluoma"],
        "year": 2012,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.7183/1045-6635.23.4.565",
        "source_url": "https://doi.org/10.7183/1045-6635.23.4.565",
        "access_status": "publisher-record",
        "scope": "Excavation report for Fazenda Atlântica and Quinauá, including chronology, architecture, and material assemblages.",
    },
    {
        "id": "2012-saunaluoma-schaan-monumentality",
        "title": "Monumentality in Western Amazonian Formative Societies: Geometric Ditched Enclosures in the Brazilian State of Acre",
        "authors": ["Sanna Saunaluoma", "Denise Pahl Schaan"],
        "year": 2012,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.4081/antiqua.2012.e1",
        "source_url": "https://doi.org/10.4081/antiqua.2012.e1",
        "access_status": "open-access",
        "scope": "Comparative interpretation of monumentality, enclosure form, chronology, and social practice.",
    },
    {
        "id": "2012-schaan-et-al-new-radiometric-dates",
        "title": "New Radiometric Dates for Precolumbian (2000-700 B.P.) Earthworks in Western Amazonia, Brazil",
        "authors": ["Denise Pahl Schaan", "Martti Pärssinen", "Sanna Saunaluoma", "Alceu Ranzi", "Miriam Bueno", "Antonia Damasceno Barbosa"],
        "year": 2012,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1179/0093469012Z.00000000012",
        "source_url": "https://doi.org/10.1179/0093469012Z.00000000012",
        "access_status": "publisher-record",
        "scope": "Radiocarbon chronology for western Amazonian earthworks, including multiple Acre sites.",
    },
    {
        "id": "2014-barbosa-analise-espacial-sitios-monumentais",
        "title": "Análise espacial dos sítios monumentais do leste da Amazônia Ocidental",
        "authors": ["Antonia Damasceno Barbosa"],
        "contributors": ["Denise Pahl Schaan"],
        "year": 2014,
        "work_type": "thesis",
        "languages": ["pt"],
        "source_url": "https://repositorio.ufpa.br/jspui/handle/2011/8855",
        "access_status": "open-access",
        "scope": "GIS and statistical analysis of 419 geometric enclosures in eastern Acre, addressing morphology, placement, orientation, and preservation.",
    },
    {
        "id": "2014-balee-et-al-tres-vertentes",
        "title": "Florestas antrópicas no Acre: inventário florestal no geoglifo Três Vertentes, Acrelândia",
        "authors": ["William Balée", "Denise Pahl Schaan", "James Andrew Whitaker", "Rosângela Holanda"],
        "year": 2014,
        "work_type": "article",
        "languages": ["pt"],
        "doi": "10.18542/amazonica.v6i1.1752",
        "source_url": "https://periodicos.ufpa.br/index.php/amazonica/article/view/1752",
        "access_status": "open-access",
        "scope": "One-hectare forest inventory at Três Vertentes examining long-term vegetation legacies at a forested geoglyph.",
    },
    {
        "id": "2015-watling-et-al-subsistence-phytoliths",
        "title": "Subsistence Practices among Earthwork Builders: Phytolith Evidence from Archaeological Sites in the Southwest Amazonian Interfluves",
        "authors": ["Jennifer Watling", "Sanna Saunaluoma", "Martti Pärssinen", "Denise Pahl Schaan"],
        "year": 2015,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1016/j.jasrep.2015.10.014",
        "source_url": "https://doi.org/10.1016/j.jasrep.2015.10.014",
        "access_status": "publisher-record",
        "scope": "Phytolith study of crops, palms, and forest-resource use at southwestern Amazonian earthworks.",
    },
    {
        "id": "2016-neves-et-al-pesc-final-report",
        "title": "Pesquisa e formação nos sítios arqueológicos Espinhara e Sol de Campinas do Acre - PESC: relatório final",
        "authors": ["Eduardo Góes Neves", "Francisco Antonio Pugliese Jr.", "Myrtle Pearl Shock", "Laura Furquim", "Carlos Augusto Zimpel Neto", "Carla Gibertoni Carneiro"],
        "year": 2016,
        "work_type": "report",
        "languages": ["pt"],
        "source_url": "https://repositorio.usp.br/",
        "access_status": "unpublished-report",
        "scope": "Final technical report for field research and training at Espinhara and Sol de Campinas under IPHAN permit 48/2014.",
    },
    {
        "id": "2017-khan-aragao-iriarte-uav-lidar-system",
        "title": "A UAV-LiDAR System to Map Amazonian Rainforest and Its Ancient Landscape Transformations",
        "authors": ["Salman Saeed Khan", "Luiz E. O. C. Aragão", "José Iriarte"],
        "year": 2017,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1080/01431161.2017.1295486",
        "source_url": "https://doi.org/10.1080/01431161.2017.1295486",
        "access_status": "publisher-record",
        "scope": "Introduces the survey-grade UAV-LiDAR and multispectral system subsequently used to map forest-covered Acre earthworks and the Sanna rectangular mound-village landscape.",
    },
    {
        "id": "2017-watling-impact-geoglyph-builders",
        "title": "Impact of Pre-Columbian 'Geoglyph' Builders on Amazonian Forests",
        "authors": ["Jennifer Watling", "José Iriarte", "Francis E. Mayle", "Denise Pahl Schaan", "Luiz C. R. Pessenda", "Neil J. Loader", "F. Alayne Street-Perrott", "Ruth Dickau", "Antonia Damasceno Barbosa", "Alceu Ranzi"],
        "year": 2017,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1073/pnas.1614359114",
        "source_url": "https://centaur.reading.ac.uk/69096/",
        "access_status": "local-pdf-restricted",
        "local_source": "sources/documents/2017-watling-acre-geoglyph-builders.pdf",
        "pages": 43,
        "sha256": "d28c9bee335852a4926c79f39ab0bc81ac43e5486f2498e2d402972f8bee83ca",
        "scope": "Paleoecological reconstruction showing millennia of forest management around Acre geoglyphs without long-term regional-scale clearance.",
    },
    {
        "id": "2017-virtanen-saunaluoma-visualization-movement",
        "title": "Visualization and Movement as Configurations of Human-Nonhuman Engagements: Precolonial Geometric Earthwork Landscapes of the Upper Purus, Brazil",
        "authors": ["Pirjo Kristiina Virtanen", "Sanna Saunaluoma"],
        "year": 2017,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1111/aman.12923",
        "source_url": "https://doi.org/10.1111/aman.12923",
        "access_status": "publisher-record",
        "scope": "Relational and Indigenous-studies interpretation using Tequinho, Fazenda Colorada, Jacó Sá, and Seu Chiquinho.",
    },
    {
        "id": "2017-silva-sobre-sujeitos-lugares-patrimonio",
        "title": "Sobre sujeitos, lugares e patrimônio: um olhar reflexivo a partir do caso da Vila Pia, no estado do Acre",
        "authors": ["Arlan Hudson Souza e Silva"],
        "contributors": ["Cláudia Feierabend Baeta Leal"],
        "year": 2017,
        "work_type": "thesis",
        "languages": ["pt"],
        "source_url": "https://www.gov.br/iphan/pt-br/unidades-especiais/centro-lucio-costa/mestrado-profissional/dissertacoes-1/ficha-tecnica-sobre-sujeitos-lugares-e-patrimonio-um-olhar-reflexivo-a-partir-do-caso-da-vila-pia-no-estado-do-acre",
        "access_status": "open-access",
        "scope": "Participatory heritage-management study of Vila Pia residents' relationships with nearby earthworks.",
    },
    {
        "id": "2018-watling-mayle-schaan-historical-ecology",
        "title": "Historical Ecology, Human Niche Construction and Landscape in Pre-Columbian Amazonia: A Case Study of the Geoglyph Builders of Acre, Brazil",
        "authors": ["Jennifer Watling", "Francis E. Mayle", "Denise Pahl Schaan"],
        "year": 2018,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1016/j.jaa.2018.05.001",
        "source_url": "https://centaur.reading.ac.uk/77826/",
        "access_status": "open-access",
        "scope": "Historical-ecology and niche-construction interpretation of archaeological and palaeoecological Acre data.",
    },
    {
        "id": "2018-saunaluoma-parssinen-schaan-diversity",
        "title": "Diversity of Pre-Colonial Earthworks in the Brazilian State of Acre, Southwestern Amazonia",
        "authors": ["Sanna Saunaluoma", "Martti Pärssinen", "Denise Pahl Schaan"],
        "year": 2018,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1080/00934690.2018.1483686",
        "source_url": "https://helda.helsinki.fi/",
        "access_status": "open-access",
        "scope": "Field and comparative synthesis distinguishing multiple Acre earthwork forms and occupational settings.",
    },
    {
        "id": "2018-silva-micromorfologia-sol-campinas",
        "title": "Análise micromorfológica do processo de formação do sítio arqueológico Sol de Campinas do Acre - AC",
        "authors": ["Kelly Brandão Vaz da Silva"],
        "contributors": ["Ximena Suárez Villagrán"],
        "year": 2018,
        "work_type": "thesis",
        "languages": ["pt"],
        "source_url": "https://repositorio.usp.br/item/002920962",
        "access_status": "open-access",
        "scope": "Geoarchaeological and micromorphological study of mound construction and site formation at Sol de Campinas.",
    },
    {
        "id": "2018-desouza-southern-amazon-earth-builders",
        "title": "Pre-Columbian Earth-Builders Settled along the Entire Southern Rim of the Amazon",
        "authors": ["Jonas Gregorio de Souza", "Denise Pahl Schaan", "Mark Robinson", "Antonia Damasceno Barbosa", "Luiz E. O. C. Aragão", "Ben Hur Marimon Jr.", "Beatriz Schwantes Marimon", "José Iriarte"],
        "year": 2018,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1038/s41467-018-03510-7",
        "source_url": "https://doi.org/10.1038/s41467-018-03510-7",
        "access_status": "local-pdf-restricted",
        "local_source": "sources/documents/2018-desouza-southern-amazon-earth-builders.pdf",
        "pages": 10,
        "sha256": "7503685a064c8698d0f07e06eee779f1123f5bbf564467bc7642bc2acc9aa49f",
        "scope": "Predictive modelling and field survey across the southern Amazon rim; uses Acre geoglyphs and mound villages as a major comparison region.",
    },
    {
        "id": "2019-saunaluoma-anttiroiko-moat-uav",
        "title": "UAV Survey at Archaeological Earthwork Sites in the Brazilian State of Acre, Southwestern Amazonia",
        "authors": ["Sanna Saunaluoma", "Niku Anttiroiko", "Justin Moat"],
        "year": 2019,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1002/arp.1747",
        "source_url": "https://doi.org/10.1002/arp.1747",
        "access_status": "publisher-record",
        "scope": "Evaluates UAV photogrammetry for documenting Acre earthwork morphology and condition.",
    },
    {
        "id": "2020-parssinen-balee-ranzi-barbosa-ten-thousand-years",
        "title": "The Geoglyph Sites of Acre, Brazil: 10,000-Year-Old Land-Use Practices and Climate Change in Amazonia",
        "authors": ["Martti Pärssinen", "William Balée", "Alceu Ranzi", "Antonia Damasceno Barbosa"],
        "year": 2020,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.15184/aqy.2020.208",
        "source_url": "https://doi.org/10.15184/aqy.2020.208",
        "access_status": "open-access",
        "scope": "Long-duration land-use and climate synthesis connecting pre-geoglyph soils, earthwork construction, and forest history.",
    },
    {
        "id": "2020-riris-spatial-structure-earthworks",
        "title": "Spatial Structure among the Geometric Earthworks of Western Amazonia (Acre, Brazil)",
        "authors": ["Philip Riris"],
        "year": 2020,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1016/j.jaa.2020.101177",
        "source_url": "https://doi.org/10.1016/j.jaa.2020.101177",
        "access_status": "publisher-record",
        "scope": "Reproducible point-process modelling of earthwork distribution and possible territorial integration.",
    },
    {
        "id": "2020-iriarte-et-al-geometry-by-design",
        "title": "Geometry by Design: Contribution of LiDAR to the Understanding of Settlement Patterns of the Mound Villages in SW Amazonia",
        "authors": ["José Iriarte", "Mark Robinson", "Jonas Gregorio de Souza", "Antonia Damasceno Barbosa", "Franciele da Silva", "Francisco Nakahara", "Alceu Ranzi", "Luiz E. O. C. Aragão"],
        "year": 2020,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.5334/jcaa.45",
        "source_url": "https://journal.caa-international.org/articles/10.5334/jcaa.45",
        "access_status": "open-access",
        "scope": "LiDAR mapping of circular and rectangular mound villages and their road networks in southeastern Acre.",
    },
    {
        "id": "2020-silva-etnogeometria-geoglifos-acre",
        "title": "Etnogeometria: geometrias das antigas civilizações e os geoglifos dos povos ancestrais que viveram no estado do Acre",
        "authors": ["Oziel dos Santos Silva"],
        "year": 2020,
        "work_type": "thesis",
        "languages": ["pt"],
        "source_url": "https://www.ufac.br/mpecim/academico/dissertacoes/2020/dissertacao-titulo-etnogeometria-geometrias-das-antigas-civilizacoes-e-os-geoglifos-dos-povos-ancestrais-que-viveram-no-estado-do-acre-oziel-dos-santos-silva/view",
        "access_status": "open-access",
        "scope": "Education-focused ethnomathematics study using Acre geoglyph geometry.",
    },
    {
        "id": "2021-iriarte-et-al-mound-village-chronology",
        "title": "Refining the Chronology and Occupation Dynamics of the Mound Villages of South-Eastern Acre, Brazil",
        "authors": ["José Iriarte", "Jonas Gregorio de Souza", "Mark Robinson", "Antonia Damasceno Barbosa", "Franciele da Silva"],
        "year": 2021,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.18542/amazonica.v13i1.9005",
        "source_url": "https://periodicos.ufpa.br/index.php/amazonica/article/view/9005",
        "access_status": "open-access",
        "scope": "Test excavations and Bayesian modelling for Caboquinho, Boa Esperança, Tocantins, Dos Círculos IV, Dos Círculos V, and other mound villages.",
    },
    {
        "id": "2021-parssinen-tequinho-polychrome-horizon",
        "title": "Tequinho Geoglyph Site and Early Polychrome Horizon BC 500/300-AD 300/500 in the Brazilian State of Acre",
        "authors": ["Martti Pärssinen"],
        "year": 2021,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.18542/amazonica.v13i1.9095",
        "source_url": "https://periodicos.ufpa.br/index.php/amazonica/article/view/9095",
        "access_status": "open-access",
        "scope": "Defines a Tequinho ceramic sub-phase and situates it within a proposed early Polychrome Horizon.",
    },
    {
        "id": "2021-parssinen-et-al-domestication-motion",
        "title": "Domestication in Motion: Macrofossils of Pre-Colonial Brazilian Nuts, Palms and Other Amazonian Planted Tree Species Found in the Upper Purus",
        "authors": ["Martti Pärssinen", "Evandro Ferreira", "Pirjo Kristiina Virtanen", "Alceu Ranzi"],
        "year": 2021,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1080/14614103.2020.1765295",
        "source_url": "https://doi.org/10.1080/14614103.2020.1765295",
        "access_status": "publisher-record",
        "scope": "Macrobotanical evidence for Brazil nuts, palms, and planted-tree use in the Upper Purus earthwork region.",
    },
    {
        "id": "2021-saunaluoma-et-al-patterned-villagescapes",
        "title": "Patterned Villagescapes and Road Networks in Ancient Southwestern Amazonia",
        "authors": ["Sanna Saunaluoma", "Justin Moat", "Francisco Antonio Pugliese Jr.", "Eduardo Góes Neves"],
        "year": 2021,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1017/laq.2020.79",
        "source_url": "https://doi.org/10.1017/laq.2020.79",
        "access_status": "open-access",
        "scope": "Regional account of patterned mound villages and road systems in ancient southeastern Acre.",
    },
    {
        "id": "2021-ranzi-parssinen-geoglifos-civilizacao-aquiry",
        "title": "Amazônia: os geoglifos e a civilização Aquiry",
        "authors": ["Alceu Ranzi", "Martti Pärssinen"],
        "year": 2021,
        "work_type": "book",
        "languages": ["pt"],
        "source_url": "https://madrid.fi/wp-content/uploads/2023/09/Ranzi_Parssinen_Os-Geoglifos_2021.pdf",
        "access_status": "open-access",
        "scope": "Book-length synthesis proposing the Aquiry label for a multicultural earthwork-building civilization.",
    },
    {
        "id": "2022-pessoa-geoglifos-acre-passado-profundo",
        "title": "Geoglifos do Acre: passado profundo",
        "authors": ["Cliverson Pessoa"],
        "year": 2022,
        "work_type": "book-review",
        "languages": ["pt"],
        "doi": "10.24885/sab.v35i2.949",
        "source_url": "https://revista.sabnet.org/ojs/index.php/sab/article/view/949",
        "access_status": "open-access",
        "scope": "Review of Alceu Ranzi's 2021 book and history of Acre geoglyph advocacy and research.",
    },
    {
        "id": "2022-wagner-et-al-fast-dtm-geoglyph-detection",
        "title": "Fast Computation of Digital Terrain Model Anomalies Based on LiDAR Data for Geoglyph Detection in the Amazon",
        "authors": ["Fabien H. Wagner", "Vinícius Peripato", "Renato Kipnis", "Sara L. Werdesheim", "Ricardo Dalagnola", "Luiz E. O. C. Aragão", "Mayumi C. M. Hirye"],
        "year": 2022,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1080/2150704X.2022.2109942",
        "source_url": "https://doi.org/10.1080/2150704X.2022.2109942",
        "access_status": "publisher-record",
        "scope": "Automated terrain-anomaly workflow applicable to detecting low-relief Amazonian earthworks.",
    },
    {
        "id": "2023-peripato-et-al-hidden-earthworks",
        "title": "More than 10,000 Pre-Columbian Earthworks Are Still Hidden throughout Amazonia",
        "authors": paper_authors("2023-peripato-et-al-hidden-earthworks"),
        "year": 2023,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1126/science.ade2541",
        "source_url": "https://doi.org/10.1126/science.ade2541",
        "access_status": "local-pdf-restricted",
        "local_source": "sources/documents/2023-peripato-hidden-earthworks.pdf",
        "pages": 73,
        "sha256": "886f626570091bcaac9bc213e31db177f53eb170cec4ec04f1e8389422b02fb0",
        "scope": "Amazon-wide LiDAR survey and predictive model reporting 24 previously undocumented earthworks, including ten provisional Acre records (ACE-01 through ACE-10) between Rio Branco and Senador Guiomard.",
    },
    {
        "id": "2024-kalliola-et-al-geography-earthworks",
        "title": "Geography of Ancient Geometric Earthworks and Their Builders in Southwestern Amazonia",
        "authors": ["Risto Kalliola", "Martti Pärssinen", "Alceu Ranzi", "Iiro Seppä", "Antonia Damasceno Barbosa"],
        "year": 2024,
        "work_type": "article",
        "languages": ["en", "pt"],
        "doi": "10.1590/1809-4392202203511",
        "source_url": "https://www.scielo.br/j/aa/a/6mwCFLMkt6SQCmSpnBMRqgR/",
        "access_status": "local-pdf-restricted",
        "local_source": "sources/documents/2024-kalliola-earthworks-coordinate-list.pdf",
        "sha256": "f608c73f80d10a15da27ca2aaecb9708a85f9eb78c69cedb6e1e335df432ab22",
        "pages": 29,
        "scope": "Maps and classifies 1,279 earthworks over 27,569 square kilometres and reviews radiocarbon evidence for geoglyph and mound-village phases. The restricted local supplement is the authors' coordinate list used only to derive coarse public density cells.",
    },
    {
        "id": "2024-de-souza-tequinho-roads",
        "title": "The Pre-Colombian Roads of Geoglyph Sites in the State of Acre: The Tequinho Site Road Complex",
        "authors": ["Rubens Barros de Souza"],
        "year": 2024,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.15406/jhaas.2024.09.00297",
        "source_url": "https://medcraveonline.com/JHAAS/JHAAS-09-00297.pdf",
        "access_status": "open-access",
        "scope": "Satellite-based study of Tequinho roads and a broader sample of 289 Acre geoglyph structures.",
    },
    {
        "id": "2024-watling-et-al-paleoecological-anthropocene",
        "title": "O que os dados paleoecológicos nos dizem sobre o Antropoceno na Amazônia?",
        "authors": ["Jennifer Watling", "S. Yoshi Maezumi", "Myrtle Pearl Shock", "José Iriarte"],
        "year": 2024,
        "work_type": "article",
        "languages": ["pt"],
        "doi": "10.1590/s0103-4014.202438112.009",
        "source_url": "https://www.scielo.br/j/ea/a/C9p9MFJdWZMNWGmYj5vy8gM/",
        "access_status": "open-access",
        "scope": "Comparative paleoecological synthesis including the Acre geoglyph region as one of four Amazonian cases.",
    },
    {
        "id": "2026-lopes-campos-geoglifos-acre-amazonas",
        "title": "Os geoglifos no Acre e sul do Amazonas: paisagem, território e territorialidade na Amazônia pré-colonial",
        "authors": ["Felipe Ribeiro da Silva Lopes", "Iolanda Aida de Medeiros Campos"],
        "year": 2026,
        "work_type": "article",
        "languages": ["pt"],
        "source_url": "https://periodicos.uea.edu.br/index.php/marupiara/article/view/5186",
        "access_status": "open-access",
        "scope": "Archaeogeographical and human-geography review of landscape, territory, and memory around Acre and southern Amazonas geoglyphs.",
    },
    {
        "id": "2026-parssinen-et-al-over-20000-earthworks",
        "title": "Over 20,000 Precolonial Earthworks in the Southwest Amazonia",
        "authors": ["Martti Pärssinen", "Risto Kalliola", "Alceu Ranzi", "Eetu Puttonen", "Rhuan Carlos Lopes", "Pirjo Kristiina Virtanen", "Francisco Apurinã", "Kalle Ruokolainen", "Juha Hyyppä", "Antero Kukko", "Mariana Campos", "Fabio de Novaes", "Markku Oinonen", "Antonia Damasceno Barbosa", "Sanna Saunaluoma", "Evandro Ferreira"],
        "year": 2026,
        "work_type": "article",
        "languages": ["en"],
        "doi": "10.1038/s41586-026-10835-7",
        "source_url": "https://www.nature.com/articles/s41586-026-10835-7",
        "access_status": "local-pdf-restricted",
        "local_source": "sources/documents/2026-parssinen-over-20000-earthworks.pdf",
        "pages": 21,
        "sha256": "e940bc3aaf284207b3534290cc5c6f948c08097fcf454cf198f9ef3581f30e00",
        "scope": "Open-access Nature article using 2024 airborne LiDAR to document 432 earthworks, refine the proposed Aquiry extent, and model the regional earthwork count and population.",
    },
]


PERIODS = [
    {"id": "acre-geoglyph-horizon", "name": "Acre Geoglyph Horizon", "sort_order": 100, "start_year": -600, "end_year": 850, "aliases": ["Geoglyph-building period", "Aquiry period"]},
    {"id": "acre-mound-village-horizon", "name": "Acre Mound-Village Horizon", "sort_order": 200, "start_year": 950, "end_year": 1650, "aliases": ["Mound village period"]},
    {"id": "tequinho-early-polychrome-subphase", "name": "Tequinho Early Polychrome Subphase", "sort_order": 150, "start_year": -50, "end_year": 200, "aliases": ["Tequinho sub-phase"]},
]


CULTURES = [
    {"id": "acre-geoglyph-building-tradition", "name": "Acre Geoglyph-Building Tradition", "sort_order": 100, "aliases": ["Geoglyph builders of Acre"], "papers": ["2009-parssinen-schaan-ranzi-upper-purus", "2010-schaan-et-al-construindo-paisagens", "2012-saunaluoma-schaan-monumentality", "2018-saunaluoma-parssinen-schaan-diversity", "2023-peripato-et-al-hidden-earthworks"], "description": "A cautious archaeological classification for communities that constructed and reused geometric ditched enclosures in Acre. It does not identify one ethnic or linguistic people."},
    {"id": "aquiry-interpretive-model", "name": "Aquiry Interpretive Model", "sort_order": 110, "aliases": ["Aquiry civilization"], "papers": ["2021-ranzi-parssinen-geoglifos-civilizacao-aquiry", "2026-parssinen-et-al-over-20000-earthworks"], "description": "A recent research label proposed for a multicultural complex linked by monumental earthworks and a shared sociocosmology. Treat as a model advanced most fully in 2021 and 2026, not as a demonstrated single ethnicity."},
    {"id": "acre-mound-village-tradition", "name": "Acre Mound-Village Tradition", "sort_order": 200, "aliases": ["Patterned villagescapes"], "papers": ["2020-iriarte-et-al-geometry-by-design", "2021-iriarte-et-al-mound-village-chronology", "2021-saunaluoma-et-al-patterned-villagescapes"], "description": "Post-geoglyph settlement tradition represented by circular and rectangular mound villages, plazas, and radiating road networks in southeastern Acre."},
    {"id": "tequinho-ceramic-subphase", "name": "Tequinho Ceramic Subphase", "sort_order": 150, "aliases": ["Tequinho sub-phase"], "papers": ["2021-parssinen-tequinho-polychrome-horizon", "2021-parssinen-et-al-domestication-motion", "2024-de-souza-tequinho-roads"], "description": "Ceramic subphase proposed from the Tequinho site and assigned to an early Polychrome Horizon; its wider cultural and linguistic associations remain interpretive."},
    {"id": "apurinã", "name": "Apurinã", "sort_order": 300, "aliases": ["Ipurinã"], "papers": ["2026-parssinen-et-al-over-20000-earthworks"], "description": "Contemporary Arawak-speaking Indigenous people of the Purus region. The linked 2026 study includes an Apurinã co-author and Indigenous knowledge, but that collaboration does not by itself establish direct authorship of ancient earthworks."},
    {"id": "manchineri", "name": "Manchineri", "sort_order": 310, "aliases": ["Manchineri people"], "papers": ["2017-virtanen-saunaluoma-visualization-movement"], "description": "Contemporary Arawak-speaking Indigenous people discussed in comparative work on regional landscapes. No simple one-to-one identification with geoglyph builders is assumed."},
]


PUBLIC_PLACEMENTS = {
    "acre-geoglyph-landscape": {
        "latitude": -10.0,
        "longitude": -67.8,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 75,
        "coordinate_basis": "Generalized centroid for the eastern Acre earthwork research landscape.",
        "coordinate_note": "This broad area summarizes a regional archaeological landscape, not a site or access point.",
    },
    "tequinho": {
        "latitude": -9.9,
        "longitude": -67.4,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the 2024 Kalliola et al. inventory.",
        "coordinate_note": "The source-published site coordinates remain outside the public graph; this marker represents the surrounding research area.",
    },
    "fazenda-atlantica": {
        "latitude": -10.1,
        "longitude": -67.6,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the 2024 Kalliola et al. inventory.",
        "coordinate_note": "This marker represents the surrounding research area, not the archaeological structures or an access point.",
    },
    "quinaua": {
        "latitude": -10.1,
        "longitude": -67.6,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the 2024 Kalliola et al. inventory.",
        "coordinate_note": "This marker represents the Balneário Quinauá research area, not the archaeological structures or an access point.",
    },
    "jaco-sa": {
        "latitude": -10.0,
        "longitude": -67.5,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the 2024 Kalliola et al. inventory.",
        "coordinate_note": "This marker represents the surrounding research area, not the archaeological complex or an access point.",
    },
    "tres-vertentes": {
        "latitude": -9.7,
        "longitude": -67.1,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the 2024 Kalliola et al. inventory and the Acrelândia study description.",
        "coordinate_note": "This marker represents the surrounding Acrelândia research area, not the forested earthwork or an access point.",
    },
    "sol-de-campinas": {
        "latitude": -10.1,
        "longitude": -67.3,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the 2024 Kalliola et al. inventory.",
        "coordinate_note": "This marker represents the surrounding research area, not the mound village or an access point.",
    },
    "espinhara": {
        "latitude": -10.1,
        "longitude": -67.3,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 25,
        "coordinate_basis": "Generalized PESC project-area placement from the joint Espinhara and Sol de Campinas field report.",
        "coordinate_note": "The available public record supports an eastern Acre project area but not a defensible public site point; the broad placement is intentionally shared with PESC.",
    },
    "southeastern-acre-mound-villages": {
        "latitude": -10.0,
        "longitude": -67.4,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 55,
        "coordinate_basis": "Generalized centroid of the southeastern Acre mound-village study region in Iriarte et al. 2020 and 2021.",
        "coordinate_note": "This marker summarizes a multi-site research landscape and three LiDAR transects; it is not an archaeological-site coordinate.",
    },
    "vila-pia-earthworks": {
        "latitude": -9.9,
        "longitude": -67.4,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the 2024 Kalliola et al. inventory.",
        "coordinate_note": "This marker represents the Vila Pia heritage landscape, not an individual earthwork or access point.",
    },
    "fazenda-colorada": {
        "latitude": -9.9,
        "longitude": -67.5,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the 2024 Kalliola et al. inventory.",
        "coordinate_note": "This marker represents the surrounding research area, not the archaeological structures or an access point.",
    },
    "seu-chiquinho": {
        "latitude": -10.0,
        "longitude": -67.5,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the 2024 Kalliola et al. inventory.",
        "coordinate_note": "This marker represents the surrounding research area, not the archaeological site or an access point.",
    },
    "caboquinho": {
        "latitude": -9.8,
        "longitude": -67.2,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the source-published UTM location in Iriarte et al. 2020.",
        "coordinate_note": "This marker represents the Dona Maria LiDAR research corridor, not the mound village or an access point.",
    },
    "boa-esperanca-mound-village": {
        "latitude": -9.8,
        "longitude": -67.2,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the source-published UTM location in Iriarte et al. 2020.",
        "coordinate_note": "This marker represents the Dona Maria LiDAR research corridor, not the mound village or an access point.",
    },
    "tocantins-mound-village": {
        "latitude": -9.9,
        "longitude": -67.2,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the source-published UTM location in Iriarte et al. 2020.",
        "coordinate_note": "This marker represents the Dona Maria LiDAR research corridor, not the mound village or an access point.",
    },
    "dos-circulos-iv": {
        "latitude": -10.2,
        "longitude": -67.7,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the source-published UTM location in Iriarte et al. 2020.",
        "coordinate_note": "This marker represents the Dois Círculos LiDAR research corridor, not the mound village or an access point.",
    },
    "dos-circulos-v": {
        "latitude": -10.2,
        "longitude": -67.7,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the source-published UTM location in Iriarte et al. 2020.",
        "coordinate_note": "This marker represents the Dois Círculos LiDAR research corridor, not the mound-village complex or an access point.",
    },
    "piloto-fazenda-cipoal": {
        "latitude": -9.9,
        "longitude": -67.6,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the Piloto record in the 2024 Kalliola et al. inventory.",
        "coordinate_note": "This marker represents the surrounding Fazenda Cipoal research area, not the geoglyph complex or an access point.",
    },
    "fonte-boa-mound-village": {
        "latitude": -10.1,
        "longitude": -67.3,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 10,
        "coordinate_basis": "Generalized to a 0.1° public research grid from the 2024 Kalliola et al. inventory.",
        "coordinate_note": "This marker represents the surrounding research area, not the mound village, adjacent geoglyph, or an access point.",
    },
    "sanna-uav-lidar-test-landscape": {
        "latitude": -9.75,
        "longitude": -67.45,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 30,
        "coordinate_basis": "Generalized eastern Acre placement for the UAV-LiDAR prototype tests discussed by Khan et al. 2017 and Iriarte et al. 2020.",
        "coordinate_note": "This marker represents a broad technology-demonstration landscape, not the Sanna village or any archaeological structure.",
    },
    "ace-01-10-lidar-discoveries": {
        "latitude": -10.05,
        "longitude": -67.75,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 35,
        "coordinate_basis": "Generalized Rio Branco-Senador Guiomard research zone from Peripato et al. 2023.",
        "coordinate_note": "ACE-01 through ACE-10 are represented as one protected research cluster; their individual locations are intentionally not published here.",
    },
    "bujari-porto-acre-earthwork-corridor": {
        "latitude": -9.65,
        "longitude": -67.85,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 45,
        "coordinate_basis": "Generalized Bujari-Porto Acre corridor named in the 2024 airborne LiDAR survey and regional distribution studies.",
        "coordinate_note": "This marker represents a broad, multi-municipality research corridor north of Rio Branco, not an archaeological site or flight line.",
    },
    "sena-madureira-iaco-geoglyph-zone": {
        "latitude": -9.15,
        "longitude": -68.65,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 35,
        "coordinate_basis": "Generalized Sena Madureira and Iaco valley research zone supported by regional surveys, the 2024 earthwork inventory, and airborne LiDAR coverage.",
        "coordinate_note": "Named inventory records and regional studies establish earthworks in this area; the marker does not identify any individual structure.",
    },
    "manoel-urbano-upper-purus-frontier": {
        "latitude": -8.85,
        "longitude": -69.25,
        "coordinate_precision": "regional-centroid",
        "coordinate_uncertainty_km": 45,
        "coordinate_basis": "Generalized Manoel Urbano-upper Purus distribution frontier defined by Pärssinen et al. 2026.",
        "coordinate_note": "This is a regional boundary marker for documented ditched-enclosure distribution, not a site coordinate; sampled areas farther west produced no comparable geoglyph belt.",
    },
}


PLACES = [
    {
        "id": "acre-geoglyph-landscape",
        "name": "Acre Geoglyph Landscape",
        "aliases": ["Geoglifos do Acre", "Acre earthworks"],
        "place_kind": "archaeological-landscape",
        **PUBLIC_PLACEMENTS["acre-geoglyph-landscape"],
        "periods": ["acre-geoglyph-horizon", "acre-mound-village-horizon"],
        "cultures": ["acre-geoglyph-building-tradition", "aquiry-interpretive-model", "acre-mound-village-tradition"],
        "finds": ["ditched enclosures", "embankments", "roads", "mound villages", "ceramics", "archaeobotanical remains"],
        "papers": [paper["id"] for paper in PAPERS],
        "description": "Regional parent record for geometric ditched enclosures, embanked sites, roads, and later mound villages documented across Acre. The coordinate is a deliberately coarse research centroid, not a site location.",
        "studies": [
            "2026: Airborne LiDAR documented 432 earthworks along survey lines in Acre and Amazonas; 396 were previously unrecorded. The paper extrapolates 24,000-30,000 earthworks across its larger proposed cultural area, a model that should be tested as more forest is surveyed. [[Papers/2026-parssinen-et-al-over-20000-earthworks|Nature study]], restricted local PDF pages 1-4.",
            "2017: Terrestrial paleoecology found that earthworks were constructed in forests managed over millennia and that long-term regional deforestation is modern rather than pre-Columbian. [[Papers/2017-watling-impact-geoglyph-builders|PNAS study]], restricted local PDF pages 4-6.",
            "1988: Dias and Carvalho published the first account of eight earth structures recorded during PRONAPABA fieldwork beginning in 1977. [[Papers/1988-dias-carvalho-estruturas-terra-acre|Pioneering report]].",
        ],
    },
    {
        "id": "tequinho",
        "name": "Tequinho",
        "aliases": ["Tequinho geoglyph"],
        "place_kind": "geoglyph-complex",
        **PUBLIC_PLACEMENTS["tequinho"],
        "periods": ["acre-geoglyph-horizon", "tequinho-early-polychrome-subphase"],
        "cultures": ["acre-geoglyph-building-tradition", "tequinho-ceramic-subphase", "aquiry-interpretive-model"],
        "finds": ["ditched enclosures", "roads", "ceramics", "plant macrofossils"],
        "papers": ["2021-parssinen-tequinho-polychrome-horizon", "2021-parssinen-et-al-domestication-motion", "2024-de-souza-tequinho-roads", "2017-virtanen-saunaluoma-visualization-movement", "2026-parssinen-et-al-over-20000-earthworks"],
        "description": "Publicly named geoglyph complex with multiple enclosures and a conspicuous road system; ceramic and botanical work makes it central to chronological and subsistence debates.",
        "studies": [
            "2024: A road study analysed Tequinho within a satellite sample of 289 earthworks and interpreted its aligned roads as parts of a land-river network. [[Papers/2024-de-souza-tequinho-roads|Road-complex study]].",
            "2021: Ceramic analysis proposed the Tequinho subphase and an early Polychrome Horizon placement. [[Papers/2021-parssinen-tequinho-polychrome-horizon|Tequinho ceramic study]].",
        ],
    },
    {
        "id": "fazenda-atlantica",
        "name": "Fazenda Atlântica",
        "aliases": [],
        "place_kind": "geoglyph-site",
        **PUBLIC_PLACEMENTS["fazenda-atlantica"],
        "periods": ["acre-geoglyph-horizon"],
        "cultures": ["acre-geoglyph-building-tradition", "aquiry-interpretive-model"],
        "finds": ["ditched enclosures", "ceramics", "embanked outer structure"],
        "papers": ["2012-saunaluoma-fazenda-atlantica-quinaua", "2012-schaan-et-al-new-radiometric-dates", "2026-parssinen-et-al-over-20000-earthworks"],
        "description": "Excavated geoglyph site used to establish chronology and material context; 2024 LiDAR revealed an outer embanked structure not apparent in earlier imagery.",
        "studies": ["2026: LiDAR showed a previously unseen outer embanked structure. [[Papers/2026-parssinen-et-al-over-20000-earthworks|Nature study]], restricted local PDF page 3."],
    },
    {
        "id": "quinaua",
        "name": "Quinauá",
        "aliases": ["Quinaua"],
        "place_kind": "geoglyph-site",
        **PUBLIC_PLACEMENTS["quinaua"],
        "periods": ["acre-geoglyph-horizon"],
        "cultures": ["acre-geoglyph-building-tradition"],
        "finds": ["ditched enclosure", "ceramics"],
        "papers": ["2012-saunaluoma-fazenda-atlantica-quinaua", "2012-schaan-et-al-new-radiometric-dates"],
        "description": "Excavated geometric earthwork paired with Fazenda Atlântica in a major 2012 site report.",
        "studies": ["2012: Excavation established architectural, chronological, and material evidence. [[Papers/2012-saunaluoma-fazenda-atlantica-quinaua|Excavation report]]."],
    },
    {
        "id": "jaco-sa",
        "name": "Jacó Sá",
        "aliases": ["Jaco Sa"],
        "place_kind": "geoglyph-complex",
        **PUBLIC_PLACEMENTS["jaco-sa"],
        "periods": ["acre-geoglyph-horizon", "acre-mound-village-horizon"],
        "cultures": ["acre-geoglyph-building-tradition", "acre-mound-village-tradition"],
        "finds": ["ditched enclosures", "walled enclosures", "avenues", "mound village"],
        "papers": ["2017-watling-impact-geoglyph-builders", "2017-virtanen-saunaluoma-visualization-movement", "2018-desouza-southern-amazon-earth-builders", "2024-kalliola-et-al-geography-earthworks"],
        "description": "Earthwork complex with multiple enclosure forms and roads; it also anchors an off-site paleoecological transect.",
        "studies": [
            "2018: LiDAR illustrated geometric enclosures, walled enclosures, and avenues at Jacó Sá. [[Papers/2018-desouza-southern-amazon-earth-builders|Southern-rim study]], restricted local PDF page 3.",
            "2017: On-site and off-site soil sequences were used to reconstruct forest history around the geoglyph. [[Papers/2017-watling-impact-geoglyph-builders|PNAS study]].",
        ],
    },
    {
        "id": "tres-vertentes",
        "name": "Três Vertentes",
        "aliases": [],
        "place_kind": "geoglyph-site",
        **PUBLIC_PLACEMENTS["tres-vertentes"],
        "periods": ["acre-geoglyph-horizon"],
        "cultures": ["acre-geoglyph-building-tradition"],
        "finds": ["forested geoglyph", "botanical inventory"],
        "papers": ["2014-balee-et-al-tres-vertentes", "2012-schaan-et-al-new-radiometric-dates"],
        "description": "Forested geoglyph in Acrelândia where a one-hectare inventory examined present vegetation as a possible long-term anthropogenic legacy.",
        "studies": ["2014: A one-hectare forest inventory documented high species diversity and examined disturbance history. [[Papers/2014-balee-et-al-tres-vertentes|Forest inventory]]."],
    },
    {
        "id": "sol-de-campinas",
        "name": "Sol de Campinas",
        "aliases": ["SCA"],
        "place_kind": "mound-village",
        **PUBLIC_PLACEMENTS["sol-de-campinas"],
        "periods": ["acre-mound-village-horizon"],
        "cultures": ["acre-mound-village-tradition"],
        "finds": ["15 mounds", "central plaza", "construction layers", "ceramics"],
        "papers": ["2016-neves-et-al-pesc-final-report", "2018-silva-micromorfologia-sol-campinas", "2020-iriarte-et-al-geometry-by-design", "2021-saunaluoma-et-al-patterned-villagescapes", "2024-kalliola-et-al-geography-earthworks"],
        "description": "Mound village arranged around a central plaza. It was once registered as a circular geoglyph but excavation and micromorphology distinguish its later construction history.",
        "studies": [
            "2018: Micromorphology and radiocarbon work examined how the site's mounds accumulated and placed them later than most regional geoglyphs. [[Papers/2018-silva-micromorfologia-sol-campinas|Micromorphology thesis]].",
            "2016: PESC conducted field research and training at Sol de Campinas and Espinhara. [[Papers/2016-neves-et-al-pesc-final-report|PESC final report]].",
        ],
    },
    {
        "id": "espinhara",
        "name": "Espinhara",
        "aliases": [],
        "place_kind": "archaeological-site",
        **PUBLIC_PLACEMENTS["espinhara"],
        "periods": ["acre-mound-village-horizon"],
        "cultures": ["acre-mound-village-tradition"],
        "finds": ["settlement evidence", "ceramics"],
        "papers": ["2016-neves-et-al-pesc-final-report"],
        "description": "Archaeological site investigated with Sol de Campinas in the PESC research and training project.",
        "studies": ["2016: PESC field research and training. [[Papers/2016-neves-et-al-pesc-final-report|PESC final report]]."],
    },
    {
        "id": "southeastern-acre-mound-villages",
        "name": "Southeastern Acre Mound Villages",
        "aliases": ["Acre patterned villagescapes"],
        "place_kind": "archaeological-landscape",
        **PUBLIC_PLACEMENTS["southeastern-acre-mound-villages"],
        "periods": ["acre-mound-village-horizon"],
        "cultures": ["acre-mound-village-tradition"],
        "finds": ["circular mound villages", "rectangular mound villages", "plazas", "radial roads"],
        "papers": ["2020-iriarte-et-al-geometry-by-design", "2021-iriarte-et-al-mound-village-chronology", "2021-saunaluoma-et-al-patterned-villagescapes", "2024-kalliola-et-al-geography-earthworks", "2026-parssinen-et-al-over-20000-earthworks"],
        "description": "Regional record for later circular and rectangular mound villages, including Caboquinho, Boa Esperança, Tocantins, and Dos Círculos IV-V.",
        "studies": [
            "2021: Test excavations and Bayesian modelling place the beginning of the mound-village tradition around AD 952-1216 and show repeated construction phases. [[Papers/2021-iriarte-et-al-mound-village-chronology|Chronology study]].",
            "2020: LiDAR documented planned village layouts and connecting roads beyond what single-mound excavations could reveal. [[Papers/2020-iriarte-et-al-geometry-by-design|LiDAR study]].",
        ],
    },
    {
        "id": "vila-pia-earthworks",
        "name": "Vila Pia Earthworks",
        "aliases": ["Vila Pia geoglyph landscape"],
        "place_kind": "heritage-landscape",
        **PUBLIC_PLACEMENTS["vila-pia-earthworks"],
        "periods": ["acre-geoglyph-horizon"],
        "cultures": ["acre-geoglyph-building-tradition"],
        "finds": ["ditched earthworks", "community place-names", "heritage meanings"],
        "papers": ["2017-silva-sobre-sujeitos-lugares-patrimonio"],
        "description": "Heritage landscape studied through residents' terms, experiences, and proposals for shared management rather than only archaeological classification.",
        "studies": ["2017: Participatory research recommended shared management connecting state agencies and residents. [[Papers/2017-silva-sobre-sujeitos-lugares-patrimonio|Heritage thesis]]."],
    },
    {
        "id": "fazenda-colorada",
        "name": "Fazenda Colorada",
        "aliases": [],
        "place_kind": "geoglyph-site",
        **PUBLIC_PLACEMENTS["fazenda-colorada"],
        "periods": ["acre-geoglyph-horizon"],
        "cultures": ["acre-geoglyph-building-tradition"],
        "finds": ["geometric earthwork", "movement landscape"],
        "papers": ["2017-virtanen-saunaluoma-visualization-movement", "2018-saunaluoma-parssinen-schaan-diversity"],
        "description": "Named earthwork site used in comparative interpretation of visibility, movement, and human-nonhuman engagement.",
        "studies": ["2017: Comparative landscape interpretation with Tequinho, Jacó Sá, and Seu Chiquinho. [[Papers/2017-virtanen-saunaluoma-visualization-movement|American Anthropologist study]]."],
    },
    {
        "id": "seu-chiquinho",
        "name": "Seu Chiquinho",
        "aliases": [],
        "place_kind": "geoglyph-site",
        **PUBLIC_PLACEMENTS["seu-chiquinho"],
        "periods": ["acre-geoglyph-horizon"],
        "cultures": ["acre-geoglyph-building-tradition"],
        "finds": ["geometric earthwork", "movement landscape"],
        "papers": ["2017-virtanen-saunaluoma-visualization-movement", "2018-saunaluoma-parssinen-schaan-diversity"],
        "description": "Named earthwork site included in comparative work on architecture, movement, and relational landscapes.",
        "studies": ["2017: Comparative landscape interpretation. [[Papers/2017-virtanen-saunaluoma-visualization-movement|American Anthropologist study]]."],
    },
    {
        "id": "caboquinho",
        "name": "Caboquinho",
        "aliases": [],
        "place_kind": "mound-village",
        **PUBLIC_PLACEMENTS["caboquinho"],
        "periods": ["acre-mound-village-horizon"],
        "cultures": ["acre-mound-village-tradition"],
        "finds": ["mounds", "plaza", "construction phases", "ceramics"],
        "papers": ["2021-iriarte-et-al-mound-village-chronology", "2020-iriarte-et-al-geometry-by-design"],
        "description": "Mound village with the longest dated construction sequence in the 2021 southeastern Acre chronology study.",
        "studies": ["2021: Nine dates model multiple construction phases from approximately AD 1169-1309 into colonial times. [[Papers/2021-iriarte-et-al-mound-village-chronology|Chronology study]]."],
    },
    {
        "id": "boa-esperanca-mound-village",
        "name": "Boa Esperança Mound Village",
        "aliases": ["Boa Esperança"],
        "place_kind": "mound-village",
        **PUBLIC_PLACEMENTS["boa-esperanca-mound-village"],
        "periods": ["acre-mound-village-horizon"],
        "cultures": ["acre-mound-village-tradition"],
        "finds": ["mounds", "plaza", "ceramics"],
        "papers": ["2021-iriarte-et-al-mound-village-chronology", "2020-iriarte-et-al-geometry-by-design"],
        "description": "Southeastern Acre mound village included in test excavation, dating, and LiDAR settlement studies.",
        "studies": ["2021: Test excavation contributed to the regional Bayesian chronology. [[Papers/2021-iriarte-et-al-mound-village-chronology|Chronology study]]."],
    },
    {
        "id": "tocantins-mound-village",
        "name": "Tocantins Mound Village",
        "aliases": ["Tocantins"],
        "place_kind": "mound-village",
        **PUBLIC_PLACEMENTS["tocantins-mound-village"],
        "periods": ["acre-mound-village-horizon"],
        "cultures": ["acre-mound-village-tradition"],
        "finds": ["mounds", "plaza", "ceramics"],
        "papers": ["2021-iriarte-et-al-mound-village-chronology", "2020-iriarte-et-al-geometry-by-design"],
        "description": "Southeastern Acre mound village included in test excavation, dating, and LiDAR settlement studies.",
        "studies": ["2021: Test excavation contributed to the regional Bayesian chronology. [[Papers/2021-iriarte-et-al-mound-village-chronology|Chronology study]]."],
    },
    {
        "id": "dos-circulos-iv",
        "name": "Dos Círculos IV",
        "aliases": ["Dos Circulos IV"],
        "place_kind": "rectangular-mound-village",
        **PUBLIC_PLACEMENTS["dos-circulos-iv"],
        "periods": ["acre-mound-village-horizon"],
        "cultures": ["acre-mound-village-tradition"],
        "finds": ["rectangular village layout", "mounds", "ceramics"],
        "papers": ["2021-iriarte-et-al-mound-village-chronology", "2020-iriarte-et-al-geometry-by-design"],
        "description": "Rectangular mound village whose dating shows that rectangular and circular village plans overlapped in time.",
        "studies": ["2021: A modeled date around AD 1367-1451 places the rectangular village within the broader mound-village horizon. [[Papers/2021-iriarte-et-al-mound-village-chronology|Chronology study]]."],
    },
    {
        "id": "dos-circulos-v",
        "name": "Dos Círculos V",
        "aliases": ["Dos Circulos V"],
        "place_kind": "superimposed-mound-villages",
        **PUBLIC_PLACEMENTS["dos-circulos-v"],
        "periods": ["acre-mound-village-horizon"],
        "cultures": ["acre-mound-village-tradition"],
        "finds": ["three superimposed villages", "mounds", "ceramics"],
        "papers": ["2021-iriarte-et-al-mound-village-chronology", "2020-iriarte-et-al-geometry-by-design"],
        "description": "Location with three superimposed mound-village plans, important for studying rebuilding and settlement succession.",
        "studies": ["2021: Dates and superposition support successive episodes of village construction. [[Papers/2021-iriarte-et-al-mound-village-chronology|Chronology study]]."],
    },
    {
        "id": "piloto-fazenda-cipoal",
        "name": "Piloto at Fazenda Cipoal",
        "aliases": ["Piloto", "Fazenda Cipoal"],
        "place_kind": "geoglyph-complex",
        **PUBLIC_PLACEMENTS["piloto-fazenda-cipoal"],
        "periods": ["acre-geoglyph-horizon"],
        "cultures": ["acre-geoglyph-building-tradition", "aquiry-interpretive-model"],
        "finds": ["ditched geoglyph", "outer embanked enclosure", "LiDAR terrain model"],
        "papers": ["2024-kalliola-et-al-geography-earthworks", "2026-parssinen-et-al-over-20000-earthworks"],
        "description": "Geoglyph complex whose LiDAR terrain model revealed associated architecture not visible in ordinary satellite imagery.",
        "studies": ["2026: LiDAR documented an outer embanked structure around the known geoglyph. [[Papers/2026-parssinen-et-al-over-20000-earthworks|Nature study]], restricted local PDF page 3."],
    },
    {
        "id": "fonte-boa-mound-village",
        "name": "Fonte Boa Mound Village",
        "aliases": ["Fonte Boa"],
        "place_kind": "mound-village-and-geoglyph",
        **PUBLIC_PLACEMENTS["fonte-boa-mound-village"],
        "periods": ["acre-geoglyph-horizon", "acre-mound-village-horizon"],
        "cultures": ["acre-geoglyph-building-tradition", "acre-mound-village-tradition"],
        "finds": ["mounded ring village", "radiating roads", "earlier geometric enclosure"],
        "papers": ["2018-desouza-southern-amazon-earth-builders", "2020-iriarte-et-al-geometry-by-design"],
        "description": "Mounded ring village with radiating roads adjacent to an earlier geometric enclosure, illustrating reuse of the regional monumental landscape.",
        "studies": ["2018: Aerial imagery shows a ring village and roads beside the earlier enclosure. [[Papers/2018-desouza-southern-amazon-earth-builders|Southern-rim study]], restricted local PDF page 3."],
    },
    {
        "id": "sanna-uav-lidar-test-landscape",
        "name": "Sanna UAV-LiDAR Test Landscape",
        "aliases": ["Sanna rectangular village research area"],
        "place_kind": "lidar-research-landscape",
        **PUBLIC_PLACEMENTS["sanna-uav-lidar-test-landscape"],
        "periods": ["acre-mound-village-horizon"],
        "cultures": ["acre-mound-village-tradition"],
        "finds": ["rectangular mound village", "UAV-LiDAR terrain model", "multispectral survey"],
        "papers": ["2017-khan-aragao-iriarte-uav-lidar-system", "2020-iriarte-et-al-geometry-by-design"],
        "description": "Generalized research landscape for the survey-grade UAV-LiDAR prototype tests that preceded Acre's first dedicated archaeological LiDAR transects.",
        "studies": ["2017: A survey-grade UAV system combined LiDAR and multispectral imaging for Amazonian archaeology. [[Papers/2017-khan-aragao-iriarte-uav-lidar-system|UAV-LiDAR system paper]]."],
    },
    {
        "id": "ace-01-10-lidar-discoveries",
        "name": "ACE-01-ACE-10 LiDAR Discoveries",
        "aliases": ["ACE-01 through ACE-10"],
        "place_kind": "protected-lidar-discovery-cluster",
        **PUBLIC_PLACEMENTS["ace-01-10-lidar-discoveries"],
        "periods": ["acre-geoglyph-horizon"],
        "cultures": ["acre-geoglyph-building-tradition"],
        "finds": ["ten newly reported earthworks", "ditched and embanked enclosures", "roads", "forest-covered geoglyphs"],
        "papers": ["2023-peripato-et-al-hidden-earthworks"],
        "description": "Protected group record for ten provisional earthworks reported from LiDAR samples between Rio Branco and Senador Guiomard. It is deliberately one generalized map record rather than ten site markers.",
        "studies": ["2023: LiDAR documented ACE-01 through ACE-10, including forest-covered enclosures, road features at ACE-07, and semicircular forms at ACE-06 and ACE-10. [[Papers/2023-peripato-et-al-hidden-earthworks|Science study]], restricted local PDF pages 39 and 49-52."],
    },
    {
        "id": "bujari-porto-acre-earthwork-corridor",
        "name": "Bujari-Porto Acre Earthwork Corridor",
        "aliases": ["Northern Rio Branco earthwork corridor"],
        "place_kind": "regional-earthwork-corridor",
        **PUBLIC_PLACEMENTS["bujari-porto-acre-earthwork-corridor"],
        "periods": ["acre-geoglyph-horizon"],
        "cultures": ["acre-geoglyph-building-tradition", "aquiry-interpretive-model"],
        "finds": ["geometric earthworks", "ditched and embanked enclosures", "LiDAR survey coverage", "northern distribution corridor"],
        "papers": ["2010-schaan-et-al-construindo-paisagens", "2024-kalliola-et-al-geography-earthworks", "2026-parssinen-et-al-over-20000-earthworks"],
        "description": "Generalized research corridor north of Rio Branco through Bujari and Porto Acre. It corrects the impression that Acre's documented earthwork landscape is confined to the southeastern municipalities.",
        "studies": [
            "2026: The Acre-Amazonas airborne LiDAR campaign explicitly crossed Bujari and Porto Acre, and the authors identify a high-density earthwork region extending north from Rio Branco. [[Papers/2026-parssinen-et-al-over-20000-earthworks|Nature study]], restricted local PDF pages 3 and 7.",
            "2024: Regional satellite mapping placed the corridor within a 1,279-earthwork inventory while emphasizing that forest cover still suppresses discovery. [[Papers/2024-kalliola-et-al-geography-earthworks|Distribution study]].",
        ],
    },
    {
        "id": "sena-madureira-iaco-geoglyph-zone",
        "name": "Sena Madureira-Iaco Geoglyph Zone",
        "aliases": ["Sena Madureira earthworks", "Iaco valley geoglyphs"],
        "place_kind": "regional-geoglyph-zone",
        **PUBLIC_PLACEMENTS["sena-madureira-iaco-geoglyph-zone"],
        "periods": ["acre-geoglyph-horizon"],
        "cultures": ["acre-geoglyph-building-tradition", "aquiry-interpretive-model"],
        "finds": ["circular geoglyphs", "geometric earthworks", "ceramics", "LiDAR survey coverage"],
        "papers": ["2007-schaan-parssinen-ranzi-piccoli-complexidade", "2010-schaan-et-al-construindo-paisagens", "2024-kalliola-et-al-geography-earthworks", "2026-parssinen-et-al-over-20000-earthworks"],
        "description": "Central Acre research zone around Sena Madureira and the Iaco valley, where circular geoglyphs, other earthworks, and distinct ceramic contexts have been documented. This is a regional record, not a single site.",
        "studies": [
            "2010: Five years of regional survey described the known geoglyph distribution as reaching west to Sena Madureira. [[Papers/2010-schaan-et-al-construindo-paisagens|Regional landscape study]].",
            "2024: The published coordinate inventory includes named earthwork records around Sena Madureira. [[Papers/2024-kalliola-et-al-geography-earthworks|Distribution study]], restricted coordinate-list PDF pages 12 and 27.",
            "2026: Airborne LiDAR coverage crossed Sena Madureira while testing the western extent of the monumental earthwork tradition. [[Papers/2026-parssinen-et-al-over-20000-earthworks|Nature study]], restricted local PDF page 7.",
        ],
    },
    {
        "id": "manoel-urbano-upper-purus-frontier",
        "name": "Manoel Urbano-Upper Purus Frontier",
        "aliases": ["Western Aquiry earthwork frontier", "Upper Purus distribution boundary"],
        "place_kind": "archaeological-distribution-frontier",
        **PUBLIC_PLACEMENTS["manoel-urbano-upper-purus-frontier"],
        "periods": ["acre-geoglyph-horizon"],
        "cultures": ["acre-geoglyph-building-tradition", "aquiry-interpretive-model"],
        "finds": ["ditched enclosures", "upper Purus distribution boundary", "LiDAR survey coverage", "western low-density transition"],
        "papers": ["2009-parssinen-schaan-ranzi-upper-purus", "2021-parssinen-et-al-domestication-motion", "2026-parssinen-et-al-over-20000-earthworks"],
        "description": "Generalized western and northern frontier of the monumental ditched-enclosure distribution near the Purus at Manoel Urbano. Evidence becomes sparse beyond this transition toward the upper Juruá.",
        "studies": [
            "2026: The study places the western and northern frontier of the geoglyph-building society at the Purus near Manoel Urbano. It found no continuous ditched-earthwork belt farther west along the sampled routes. [[Papers/2026-parssinen-et-al-over-20000-earthworks|Nature study]], restricted local PDF pages 2-3.",
            "2021: Upper Purus plant macrofossils provide additional evidence for long-term Indigenous landscape management in the wider region. [[Papers/2021-parssinen-et-al-domestication-motion|Macrofossil study]].",
        ],
    },
]


ORGANIZATIONS = [
    {"id": "iphan", "name": "Instituto do Patrimônio Histórico e Artístico Nacional", "sort_name": "Instituto do Patrimônio Histórico e Artístico Nacional", "kind": "government-agency", "country": "Brazil", "website": "https://www.gov.br/iphan/", "people": ["Antonia Damasceno Barbosa", "Arlan Hudson Souza e Silva"], "papers": ["2016-neves-et-al-pesc-final-report", "2017-silva-sobre-sujeitos-lugares-patrimonio", "2026-parssinen-et-al-over-20000-earthworks"], "places": ["acre-geoglyph-landscape", "vila-pia-earthworks", "bujari-porto-acre-earthwork-corridor", "sena-madureira-iaco-geoglyph-zone", "manoel-urbano-upper-purus-frontier"], "description": "Federal heritage agency responsible for archaeological authorization, inventory, protection, and public heritage work in Acre."},
    {"id": "ufac", "name": "Universidade Federal do Acre", "sort_name": "Universidade Federal do Acre", "kind": "university", "country": "Brazil", "website": "https://www.ufac.br/", "people": ["Alceu Ranzi", "Foster Brown", "Evandro Ferreira", "Oziel dos Santos Silva"], "papers": ["2007-ranzi-feres-brown-internet-software", "2020-silva-etnogeometria-geoglifos-acre", "2021-parssinen-et-al-domestication-motion", "2026-parssinen-et-al-over-20000-earthworks"], "places": ["acre-geoglyph-landscape", "tequinho", "bujari-porto-acre-earthwork-corridor", "sena-madureira-iaco-geoglyph-zone", "manoel-urbano-upper-purus-frontier"], "description": "Acre-based university and institutional home for regional research, teaching, collections, and geoglyph documentation."},
    {"id": "ufpa", "name": "Universidade Federal do Pará", "sort_name": "Universidade Federal do Pará", "kind": "university", "country": "Brazil", "website": "https://www.ufpa.br/", "people": ["Denise Pahl Schaan", "Antonia Damasceno Barbosa", "Rubens Barros de Souza", "Rhuan Carlos Lopes"], "papers": ["2007-schaan-parssinen-ranzi-piccoli-complexidade", "2010-schaan-et-al-construindo-paisagens", "2014-barbosa-analise-espacial-sitios-monumentais", "2024-de-souza-tequinho-roads"], "places": ["acre-geoglyph-landscape", "tequinho"], "description": "Major institutional base for Denise Schaan's Acre geoglyph research and related graduate work."},
    {"id": "mae-usp", "name": "Museu de Arqueologia e Etnologia da Universidade de São Paulo", "sort_name": "Museu de Arqueologia e Etnologia da Universidade de São Paulo", "kind": "museum-university", "country": "Brazil", "website": "https://mae.usp.br/", "people": ["Eduardo Góes Neves", "Jennifer Watling", "Kelly Brandão Vaz da Silva", "Ximena Suárez Villagrán"], "papers": ["2016-neves-et-al-pesc-final-report", "2017-watling-impact-geoglyph-builders", "2018-silva-micromorfologia-sol-campinas"], "places": ["sol-de-campinas", "espinhara"], "description": "Institutional base for PESC, Sol de Campinas, and multiple archaeobotanical and geoarchaeological studies."},
    {"id": "university-helsinki", "name": "University of Helsinki", "sort_name": "University of Helsinki", "kind": "university", "country": "Finland", "website": "https://www.helsinki.fi/", "people": ["Martti Pärssinen", "Sanna Saunaluoma", "Pirjo Kristiina Virtanen", "Ari Siiriäinen"], "papers": ["2003-parssinen-ranzi-saunaluoma-siiriainen-rio-branco", "2009-parssinen-schaan-ranzi-upper-purus", "2017-virtanen-saunaluoma-visualization-movement", "2026-parssinen-et-al-over-20000-earthworks"], "places": ["acre-geoglyph-landscape", "tequinho", "bujari-porto-acre-earthwork-corridor", "sena-madureira-iaco-geoglyph-zone", "manoel-urbano-upper-purus-frontier"], "description": "Long-term partner in Acre earthwork research, chronology, Indigenous studies, and regional synthesis."},
    {"id": "university-exeter", "name": "University of Exeter", "sort_name": "University of Exeter", "kind": "university", "country": "United Kingdom", "website": "https://www.exeter.ac.uk/", "people": ["Salman Saeed Khan", "José Iriarte", "Mark Robinson", "Jonas Gregorio de Souza"], "papers": ["2017-khan-aragao-iriarte-uav-lidar-system", "2018-desouza-southern-amazon-earth-builders", "2020-iriarte-et-al-geometry-by-design", "2021-iriarte-et-al-mound-village-chronology", "2023-peripato-et-al-hidden-earthworks"], "places": ["sanna-uav-lidar-test-landscape", "southeastern-acre-mound-villages", "ace-01-10-lidar-discoveries"], "description": "Institutional base for LiDAR, landscape, and mound-village research led by José Iriarte and collaborators."},
    {"id": "inpe", "name": "Instituto Nacional de Pesquisas Espaciais", "sort_name": "Instituto Nacional de Pesquisas Espaciais", "kind": "government-research-institute", "country": "Brazil", "website": "https://www.gov.br/inpe/", "people": ["Vinícius Peripato", "Luiz E. O. C. Aragão", "Ricardo Dalagnola"], "papers": ["2017-khan-aragao-iriarte-uav-lidar-system", "2022-wagner-et-al-fast-dtm-geoglyph-detection", "2023-peripato-et-al-hidden-earthworks"], "places": ["sanna-uav-lidar-test-landscape", "ace-01-10-lidar-discoveries"], "description": "Brazilian remote-sensing institute contributing airborne LiDAR analysis, terrain-anomaly methods, and Amazon-wide predictive modelling."},
    {"id": "instituto-arqueologia-brasileira", "name": "Instituto de Arqueologia Brasileira", "sort_name": "Instituto de Arqueologia Brasileira", "kind": "research-institute", "country": "Brazil", "website": "", "people": ["Ondemar Ferreira Dias Jr.", "Eliana Teixeira de Carvalho"], "papers": ["1988-dias-carvalho-estruturas-terra-acre", "2006-dias-estruturas-arqueologicas-terra-acre"], "places": ["acre-geoglyph-landscape"], "description": "Institute responsible for PRONAPABA fieldwork in Acre and publication of the pioneering 1988 earthwork article."},
    {"id": "smithsonian-institution", "name": "Smithsonian Institution", "sort_name": "Smithsonian Institution", "kind": "museum-research-institute", "country": "United States", "website": "https://www.si.edu/", "people": ["Ondemar Ferreira Dias Jr."], "papers": ["1988-dias-carvalho-estruturas-terra-acre"], "places": ["acre-geoglyph-landscape"], "description": "Institutional partner in PRONAPABA, the program under which the first Acre earth structures were formally recorded in 1977."},
]


PAPERS_BY_ID = {paper["id"]: paper for paper in PAPERS}
PERIODS_BY_ID = {period["id"]: period for period in PERIODS}
CULTURES_BY_ID = {culture["id"]: culture for culture in CULTURES}


def render_paper(paper: dict[str, object]) -> str:
    authors = [author_link(name) for name in paper["authors"]]
    contributors = [author_link(name) for name in paper.get("contributors", [])]
    local_source = paper.get("local_source")
    blocks = [
        yaml_value("type", "paper"),
        yaml_value("paper_id", paper["id"]),
        yaml_value("title", paper["title"]),
        yaml_list("authors", authors),
        yaml_list("contributors", contributors),
        yaml_value("creator_raw", "; ".join(paper["authors"])),
        yaml_value("publication_year", paper["year"]),
        yaml_value("work_type", paper["work_type"]),
        yaml_list("languages", paper["languages"]),
        yaml_value("collection", "Acre research corpus"),
        yaml_value("pdf", None),
        yaml_value("source_url", paper["source_url"]),
        yaml_value("doi", paper.get("doi")),
        yaml_value("source_sha256", paper.get("sha256")),
        yaml_value("pages", paper.get("pages")),
        yaml_value("access_status", paper["access_status"]),
        yaml_value("extraction_status", "pending-restricted-source" if local_source else "not-acquired"),
        yaml_value("review_status", "bibliographic-verified"),
    ]
    access_note = {
        "local-pdf-restricted": "A local source PDF is archived outside the navigable vault because source articles can contain exact archaeological coordinates; its path is intentionally not emitted here.",
        "open-access": "The linked full text or repository copy was open at discovery time; no local PDF is archived yet.",
        "publisher-record": "Canonical publisher metadata is verified; local full text has not been acquired.",
        "unpublished-report": "The report is cited by later scholarship; locate the agency or project copy before relying on details.",
        "bibliographic-lead": "The citation is supported by later bibliographies or a reprint, but the original full text is not locally archived.",
    }[paper["access_status"]]
    return frontmatter(blocks) + f"# {paper['title']}\n\n## Notes\n\n{paper['scope']}\n\n## Access\n\n- Status: {paper['access_status']}\n- {access_note}\n\n<!-- ocr:start -->\n## Provenance\n\n- Source: {paper['source_url']}\n" + (f"- DOI: https://doi.org/{paper['doi']}\n" if paper.get("doi") else "") + (f"- Restricted local PDF SHA-256: `{paper['sha256']}`\n- Restricted local PDF pages: {paper['pages']}\n" if local_source else "") + "\n## Extracted text\n\nNot yet extracted.\n<!-- ocr:end -->\n"


def render_author(name: str) -> str:
    aid = slug(name)
    blocks = [
        yaml_value("type", "author"),
        yaml_value("author_id", aid),
        yaml_value("name", name),
        yaml_value("sort_name", name),
        yaml_value("author_kind", "person"),
        yaml_list("aliases", []),
    ]
    return frontmatter(blocks) + f"# {name}\n\nAuthor or credited contributor in the Acre research corpus. Paper relationships are available through backlinks.\n"


def render_period(period: dict[str, object]) -> str:
    blocks = [
        yaml_value("type", "period"),
        yaml_value("period_id", period["id"]),
        yaml_value("name", period["name"]),
        yaml_value("sort_order", period["sort_order"]),
        yaml_value("start_year", period["start_year"]),
        yaml_value("end_year", period["end_year"]),
        yaml_list("aliases", period["aliases"]),
    ]
    return frontmatter(blocks) + f"# {period['name']}\n\nControlled chronological facet for Acre archaeological records. Boundaries are research models and should be refined as dates accumulate.\n"


def render_culture(culture: dict[str, object]) -> str:
    linked_places = [place for place in PLACES if culture["id"] in place["cultures"]]
    linked_paper_ids = culture.get("papers", [])
    blocks = [
        yaml_value("type", "culture"),
        yaml_value("culture_id", culture["id"]),
        yaml_value("name", culture["name"]),
        yaml_value("sort_order", culture["sort_order"]),
        yaml_list("aliases", culture["aliases"]),
        yaml_list("papers", [paper_link(pid) for pid in linked_paper_ids]),
        yaml_list("places", [f"[[Places/{place['id']}|{place['name']}]]" for place in linked_places]),
    ]
    return frontmatter(blocks) + f"# {culture['name']}\n\n{culture['description']}\n"


def render_place(place: dict[str, object]) -> str:
    papers = [paper_link(pid) for pid in place["papers"]]
    precision = place.get("coordinate_precision", "withheld")
    precision_label = "Regional centroid" if precision == "regional-centroid" else "Withheld"
    precision_short_label = "regional" if precision == "regional-centroid" else "withheld"
    precision_description = (
        "Approximate regional research centroid; not an archaeological-site coordinate."
        if precision == "regional-centroid"
        else "No coordinate is published in this graph."
    )
    blocks = [
        yaml_value("type", "place"),
        yaml_value("place_id", place["id"]),
        yaml_value("name", place["name"]),
        yaml_list("aliases", place["aliases"]),
        yaml_value("place_kind", place["place_kind"]),
        yaml_value("atlas", False),
        yaml_value("latitude", place.get("latitude")),
        yaml_value("longitude", place.get("longitude")),
        yaml_value("coordinate_precision", precision),
        yaml_value("coordinate_precision_label", precision_label),
        yaml_value("coordinate_precision_short_label", precision_short_label),
        yaml_value("coordinate_precision_description", precision_description),
        yaml_value("coordinate_basis", place.get("coordinate_basis", "coarse public research geography" if place.get("latitude") else "not published in graph")),
        yaml_value("coordinate_note", place.get("coordinate_note", "Exact archaeological coordinates are intentionally omitted from this first-pass public graph.")),
        yaml_value("coordinate_uncertainty_km", place.get("coordinate_uncertainty_km")),
        yaml_value(
            "location_visibility",
            "public-generalized" if precision == "regional-centroid" else "withheld",
        ),
        yaml_list("periods", [period_link(pid) for pid in place["periods"]]),
        yaml_list("cultures", [culture_link(cid) for cid in place["cultures"]]),
        yaml_list("finds", place["finds"]),
        yaml_list("papers", papers),
        yaml_value("latest_study_year", max(PAPERS_BY_ID[pid]["year"] for pid in place["papers"])),
        yaml_value("latest_study_label", "latest included publication"),
        yaml_value("last_fieldwork_year", None),
        yaml_value("last_fieldwork_label", "not yet normalized"),
    ]
    studies = "\n\n".join(f"### {item}" for item in place["studies"])
    return frontmatter(blocks) + f"# {place['name']}\n\n## Description\n\n{place['description']}\n\n## Studies\n\n{studies}\n"


def render_organization(org: dict[str, object]) -> str:
    blocks = [
        yaml_value("type", "organization"),
        yaml_value("organization_id", org["id"]),
        yaml_value("name", org["name"]),
        yaml_value("sort_name", org["sort_name"]),
        yaml_list("aliases", []),
        yaml_value("organization_kind", org["kind"]),
        yaml_value("status", "current"),
        yaml_value("country", org["country"]),
        yaml_value("website", org["website"]),
        yaml_list("parent_organizations", []),
        yaml_list("predecessors", []),
        yaml_list("successors", []),
        yaml_list("people", [author_link(name) for name in org["people"]]),
        yaml_list("papers", [paper_link(pid) for pid in org["papers"]]),
        yaml_list("places", [f"[[Places/{pid}|{next(place['name'] for place in PLACES if place['id'] == pid)}]]" for pid in org["places"]]),
    ]
    return frontmatter(blocks) + f"# {org['name']}\n\n{org['description']}\n"


def validate() -> None:
    paper_ids = [paper["id"] for paper in PAPERS]
    if len(paper_ids) != len(set(paper_ids)):
        raise ValueError("duplicate paper ids")
    for paper in PAPERS:
        local_source = paper.get("local_source")
        if local_source and not (ROOT / local_source).is_file():
            raise ValueError(f"{paper['id']}: missing restricted local source")
    for place in PLACES:
        missing_papers = set(place["papers"]) - PAPERS_BY_ID.keys()
        missing_periods = set(place["periods"]) - PERIODS_BY_ID.keys()
        missing_cultures = set(place["cultures"]) - CULTURES_BY_ID.keys()
        if missing_papers or missing_periods or missing_cultures:
            raise ValueError(f"{place['id']}: unresolved ids {missing_papers=} {missing_periods=} {missing_cultures=}")
        if place.get("coordinate_precision") == "regional-centroid":
            uncertainty = place.get("coordinate_uncertainty_km")
            if not isinstance(uncertainty, (int, float)) or uncertainty < 8:
                raise ValueError(f"{place['id']}: public placement requires at least 8 km uncertainty")
    for culture in CULTURES:
        missing_papers = set(culture.get("papers", [])) - PAPERS_BY_ID.keys()
        if missing_papers:
            raise ValueError(f"{culture['id']}: unresolved ids {missing_papers=}")
    known_authors = {name for paper in PAPERS for role in ("authors", "contributors") for name in paper.get(role, [])}
    known_places = {place["id"] for place in PLACES}
    for org in ORGANIZATIONS:
        missing_people = set(org["people"]) - known_authors
        missing_papers = set(org["papers"]) - PAPERS_BY_ID.keys()
        missing_places = set(org["places"]) - known_places
        if missing_people or missing_papers or missing_places:
            raise ValueError(f"{org['id']}: unresolved ids {missing_people=} {missing_papers=} {missing_places=}")


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> None:
    validate()
    paper_ids = [paper["id"] for paper in PAPERS]
    for collection in COLLECTIONS:
        (VAULT / collection).mkdir(parents=True, exist_ok=True)

    for paper in PAPERS:
        write(VAULT / "Papers" / f"{paper['id']}.md", render_paper(paper))

    author_names = sorted({name for paper in PAPERS for role in ("authors", "contributors") for name in paper.get(role, [])})
    for name in author_names:
        write(VAULT / "Authors" / f"{slug(name)}.md", render_author(name))

    for period in PERIODS:
        write(VAULT / "Periods" / f"{period['id']}.md", render_period(period))
    for culture in CULTURES:
        write(VAULT / "Cultures" / f"{culture['id']}.md", render_culture(culture))
    for place in PLACES:
        write(VAULT / "Places" / f"{place['id']}.md", render_place(place))
    for org in ORGANIZATIONS:
        write(VAULT / "Organizations" / f"{org['id']}.md", render_organization(org))

    library_rows = [
        f"| {paper['year']} | {paper_link(paper['id'])} | {', '.join(paper['languages'])} | {paper['work_type']} | {paper['access_status']} |"
        for paper in sorted(PAPERS, key=lambda item: (-item["year"], item["title"]))
    ]
    library = "# Acre Research Library\n\nThis bibliography is an exhaustive first-pass discovery set, not a claim that every item has been fully read. Access status separates restricted local PDFs, open links, publisher records, unpublished reports, and bibliographic leads. Restricted PDFs are preserved outside the navigable vault because source articles can contain exact archaeological coordinates.\n\n| Year | Work | Language | Type | Access |\n| ---: | --- | --- | --- | --- |\n" + "\n".join(library_rows) + "\n"
    write(VAULT / "Library.md", library)

    home = f"""# Acre Archaeology Knowledge Graph

This vault applies the same six-record ontology as the El Salvador graph: Places, Periods, Cultures, Papers, Authors, and Organizations. It currently focuses on Acre geoglyphs, related roads and forest history, and later mound villages.

- [[Library|Research library]]: {len(PAPERS)} papers, books, theses, chapters, and reports
- [[Places/acre-geoglyph-landscape|Acre Geoglyph Landscape]]: regional parent record
- [[Cultures/aquiry-interpretive-model|Aquiry Interpretive Model]]: caution on the recent label
- [[Places/southeastern-acre-mound-villages|Southeastern Acre Mound Villages]]: later settlement tradition
- [[Views/Papers.base|Paper view]] and [[Views/Places.base|Place view]]

Exact archaeological coordinates are omitted or generalized. Generated Paper notes distinguish bibliography discovery from source acquisition and source review.
"""
    write(VAULT / "Home.md", home)

    manifest = {
        "scope": "Acre archaeology",
        "ontology": list(COLLECTIONS),
        "counts": {
            "papers": len(PAPERS),
            "authors": len(author_names),
            "places": len(PLACES),
            "periods": len(PERIODS),
            "cultures": len(CULTURES),
            "organizations": len(ORGANIZATIONS),
        },
        "paper_ids": paper_ids,
    }
    write(ROOT / "_data" / "acre-graph-manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(manifest["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
