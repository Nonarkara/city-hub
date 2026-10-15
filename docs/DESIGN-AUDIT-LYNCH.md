# City Hub: design audit and city image

## Findings

The comparison surface uses tiny monospace labels (6–9px), tracked capitals, repeated boxed metrics, stacked bars, and equal emphasis on unrelated controls. The explorer adds a hardcoded mint accent and forest ground outside the Wada token system. The current Wada engine also reassigns the wayfinding colour by city, so action semantics drift. These are concrete hierarchy and consistency failures, not evidence about who authored the interface.

## Direction

Human task: a resident or urban designer compares how two places can be understood and navigated, without needing GIS vocabulary.

Design read: an urban field atlas, with the maps as the work and the interface as quiet viewing hardware. Reference: Kevin Lynch's comparative city diagrams and Palette's full-viewport colour-field conservation rule. Variance 4, motion 2, density 5.

Considered: a five-card score dashboard, or a shared map lens that changes both cities together. Chosen: shared lens, because paths and edges are spatial relationships and cannot be explained by a score card. Existing satellite, metrics, relationships, explorer, scenario exports and single-city tools remain available.

Chord: neutral ink and white carry controls; amber owns selection and focus; the Wada counter colour may provide a bounded atmospheric field. Map classifications use consistent line/point geometry with labels, never a rainbow of decorative status badges. No invented Wada plate attribution.

## Lynch and evidence

Lynch's 1960 research concerned residents' mental images, based on fieldwork in Boston, Jersey City and Los Angeles. The five elements are paths, edges, districts, nodes and landmarks. OSM can supply candidates for these categories; it cannot establish what residents perceive, an imageability score, or economic causality.

Implementation: approximate 4 × 4 km city-centre study windows, same ground extent in every pane. Paths = named main/pedestrian streets; edges = waterways, rail corridors and coastlines; districts = named neighbourhood/suburb points, explicitly not perceived polygons; nodes = stations, markets and squares; landmarks = named historic/tourism features. Counts are mapped OSM objects, not unique roads or quality scores. Coverage varies. Truncation, source time, no matches and service failures must remain explicit.

Primary sources: https://betterworld.mit.edu/images-of-the-city/ ; https://mitpress.mit.edu/9780262620017/the-image-of-the-city/ ; https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL

Resident interviews, sketch maps and on-site validation remain unverified. This release is a spatial comparison instrument for those investigations.

## Verification

42 data/model tests pass, including recovery from HTTP-200 Overpass partial errors (now rejected before caching). Eight desktop/mobile journeys passed before the final copy and spacing adjustments; the four category/failure journeys pass again afterward with a 60-second diagnostic test budget. One earlier desktop run exceeded its default 30-second total budget after returning to satellite; that failure is not erased by the rerun. Category journeys use fixtures, not real city evidence. Real endpoint checks on 15 October returned capacity, rate-limit and server errors; the browser correctly displayed unavailable with Retry for Bangkok and Kranj. Real city coverage is therefore not verified. No fixture data is shipped as a fallback.
