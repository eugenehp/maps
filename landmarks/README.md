# Landmark models

Hand-built 3D models (glTF binary) that the map draws in place of the extruded parts of a
landmark. The model is part of the building it stands in: it takes that building's colour in
every mode, its card, its shadow and its place on the timeline.

| City | Model | Made by |
|---|---|---|
| boston | MIT Great Dome (Building 10): drum and cornice, five stepped rings, spherical-cap dome, lantern | `tools/mit_great_dome.py` (CC0; heights and radii from the OpenStreetMap survey of the dome, ODbL) |

## Adding one

1. Put `<id>.glb` and `<id>.json` in `landmarks/<city>/`. The model is in metres: x east, y up,
   z south, with its origin on the ground at `lonlat`. Only triangle geometry is used; materials
   are replaced by the map's.
2. The JSON:

   ```json
   {
     "id": "mit-great-dome", "name": "MIT Great Dome (Building 10)", "model": "mit-great-dome.glb",
     "lonlat": [-71.092059, 42.359755], "rotation": 0,
     "replace": { "radius": 21, "minHeight": 25 },
     "licence": "CC0 1.0", "publishable": true
   }
   ```

   - `rotation`: degrees clockwise seen from above.
   - `replace`: the OpenStreetMap building parts the model stands in for: centre within `radius` m
     of `lonlat`, bottom at least `minHeight` m up. The building's other parts stay.
3. Run `pipeline <city> tiles` and `compress`. `tiles` copies the model to `web/data/<city>/models/`
   and lists it in `index.json` `models` (`id`, `file`, `gid`, `x`, `z`, `base`, `rotation`, `licence`).
