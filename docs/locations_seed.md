# ICEM Connect — Campus & Transit Locations Seed Dataset

**Version:** 1.0  
**Phase:** Phase 2 — Locations + Core Data Model  
**Institution:** Indira College of Engineering & Management (ICEM), Parandwadi, Pune  

---

## 1. Overview

This document defines the authoritative initial location dataset for ICEM Connect.
These locations represent the primary student transit corridor connecting the ICEM campus in Parandwadi to major transit hubs and residential areas across Pune and Pimpri-Chinchwad (PCMC).

The application must not hardcode these strings inside React components; they are seeded into the `locations` relational table and retrieved via `location.service.ts` and the `search_locations` database function.

---

## 2. Seed Location Catalog

| ID (Reference) | Name | Type | Latitude | Longitude | Description / Rationale |
|---|---|---|---|---|---|
| `loc_icem_campus` | ICEM Main Campus (Parandwadi) | `ICEM` | `18.723800` | `73.682300` | Main college building, academic blocks, MCA/Engineering departments |
| `loc_icem_gate` | ICEM College Main Gate & Bus Bay | `ICEM` | `18.724500` | `73.681100` | Designated primary student pickup/drop point and two-wheeler parking area |
| `loc_somatne_phata` | Somatne Phata (Expressway Junction) | `MAIN_ROAD` | `18.718200` | `73.689400` | Key intersection on Old Pune-Mumbai Highway; major transfer point |
| `loc_talegaon_station` | Talegaon Dabhade Railway Station | `BUS_STOP` | `18.730200` | `73.674900` | Central local railway transit for Pune-Lonavala suburban trains |
| `loc_talegaon_market` | Talegaon Station Road & Market | `LANDMARK` | `18.731500` | `73.678100` | High-density commercial student area with hostels and mess facilities |
| `loc_dehu_road` | Dehu Road Station Chowk | `BUS_STOP` | `18.715600` | `73.731200` | Major highway intersection and suburban train stop |
| `loc_kiwale_phata` | Kiwale Phata / Mukai Chowk (BRTS) | `MAIN_ROAD` | `18.665400` | `73.743200` | Northern terminus of PCMC Rainbow BRTS corridor |
| `loc_ravet_bridge` | Ravet Chowk / D.Y. Patil Road | `AREA` | `18.652100` | `73.754800` | Frequent transit hub for students travelling toward PCMC & Hinjewadi |
| `loc_akurdi_station` | Akurdi Railway Station Chowk | `BUS_STOP` | `18.647800` | `73.771100` | Major student commuter railway station with rapid transit connections |
| `loc_chinchwad_station` | Chinchwad Station (Old Highway) | `BUS_STOP` | `18.634100` | `73.791500` | Key railway and bus node for Chinchwad and Thergaon commuters |
| `loc_pimpri_chowk` | Pimpri Station & Market Chowk | `LANDMARK` | `18.625800` | `73.805200` | Central hub for Pimpri, Morwadi, and Metro Line 1 connectivity |
| `loc_nigdi_depot` | Nigdi Bus Depot / Bhakti Shakti | `BUS_STOP` | `18.662100` | `73.766700` | Main PMPML municipal bus terminus connecting all Pune suburbs |
| `loc_bhosari_stand` | Bhosari Bus Stand (Alandi Road) | `MAIN_ROAD` | `18.621400` | `73.844100` | Major junction for Eastern PCMC, Dighi, and Bhosari MIDC |
| `loc_wakad_bridge` | Wakad Flyover / Ginger Chowk | `MAIN_ROAD` | `18.599800` | `73.765400` | Western expressway bypass interchange |
| `loc_hinjewadi_phase1` | Hinjewadi Shivaji Chowk (Phase 1) | `AREA` | `18.591200` | `73.738900` | Rajiv Gandhi Infotech Park entry junction |

---

## 3. Location Types & Taxonomy

1. **`ICEM`**: Dedicated college campus premises, gates, and internal transit bays.
2. **`MAIN_ROAD`**: Major intersections, bypasses, and arterial road junctions.
3. **`BUS_STOP`**: Formal PMPML bus terminals, railway station stops, or BRTS stations.
4. **`LANDMARK`**: Recognizable civic points, markets, or prominent landmarks.
5. **`AREA`**: General neighborhood/locality reference.
6. **`CUSTOM`**: Host or passenger designated specific route meeting points.
