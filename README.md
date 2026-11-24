# Loadline freight route planner

A static GitHub Pages app for planning successive depot round trips for one driver. Open the site, download the CSV template or try the example manifest, choose a region, enter your depot and set the maximum payload in metric tonnes (28 by default).

CSV files require postcode, weight_t and order_date (YYYY-MM-DD). The optional order_id defaults to a row identifier. Weights accept up to three decimal places. Each order travels on one trip. Invalid rows and overweight orders appear in the review list and CSV export.

Ireland supports Eircode routing keys and full Eircodes. The UK supports postcode areas, districts and full postcodes. Select one region per manifest. Distances use area or district centres for every order. Data stays in browser memory.

Each trip starts with the oldest feasible order. Additional orders compete on distance from the last selected destination plus a penalty of 1, 8 or 40 kilometres per day newer than the first order. Selection continues while an order fits. Bounded 2-opt then improves the estimated depot round trip. This heuristic estimates straight-line travel. Road mileage, vehicle restrictions, time windows and guaranteed minimum fleet mileage are outside its model.

Local preview: run `python3 -m http.server 8000 --directory docs` in this repository and visit localhost on port 8000. GitHub Pages serves the docs folder on main.

Location lookup is derived from the [GeoNames GB and IE postal code downloads](https://download.geonames.org/export/zip/), averaging coordinates by district and UK area. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
