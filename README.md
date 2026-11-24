# Loadline freight route planner

A static GitHub Pages app for planning successive depot round trips for one driver. Open the site, download the CSV template or try the example manifest, choose a region, use the default depot of Kilcullen, Co. Kildare, or enter another depot and set the maximum payload in metric tonnes (28 by default).

CSV files require postcode, weight_t and order_date (YYYY-MM-DD). The optional order_id defaults to a row identifier. Weights accept up to three decimal places. Each order travels on one trip. Invalid rows and overweight orders appear in the review list and CSV export.

Ireland supports Eircode routing keys and full Eircodes. The UK supports postcode areas, districts and full postcodes. Select one region per manifest. Distances use area or district centres for every order. Order details stay in browser memory. The FOSSGIS OSRM service receives area-centre coordinates to calculate directional road distances.

Each trip starts with the oldest feasible order. Additional orders compete on road kilometres added by insertion into the trip plus a penalty of 1, 8 or 40 kilometres per day newer than the first order. Selection continues while both payload and distance fit. The maximum round trip defaults to 500 km and includes travel back to the depot. Per-leg, return and trip distances appear in the plan and export. The budget applies independently to each trip. Driver hours, breaks and HGV-specific restrictions require separate checks. Distances use a car profile between approximate area centres.

 The default is the [GeoNames Kilcullen town point](https://www.geonames.org/search.html?country=IE&q=Kilcullen). Each delivery shows its direct road distance from the depot and the road distance from the preceding stop.

Local preview: run `python3 -m http.server 8000 --directory docs` in this repository and visit localhost on port 8000. GitHub Pages serves the docs folder on main.

Location lookup is derived from the [GeoNames GB and IE postal code downloads](https://download.geonames.org/export/zip/), averaging coordinates by district and UK area. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
