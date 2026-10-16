# IoC 2.0 — Image of the City, research and design

**Source:** Kevin Lynch, *The Image of the City*, MIT Press / Joint Center for Urban Studies, 1960.
Read in full for this document. Page references are to that edition.

**Status:** research and framing. Not an implementation plan, and not a claim that
the current build does any of this.

---

## 0. What this document is for

City Hub already has two halves that have never met:

- **A city as systems.** `src/lib/city-model.ts` models eight systems — housing,
  water, drainage, transit, air, heat, health, waste — each with capacity, demand,
  utilisation, pressure and a verdict.
- **A city as image.** `src/data/city-image.ts` reads the five Lynch elements out
  of OpenStreetMap and draws them over the satellite basemap.

Today these are unrelated panels. **IoC 1.0** is a *catalogue*: it counts named
features and says where they came from. It is honest about that, and it should be —
`docs/DESIGN-AUDIT-LYNCH.md` is right that these are candidate evidence, not mental
maps.

**IoC 2.0** is the step after the catalogue. Lynch's framework was never about
catalogue. It is about **identity and structure** — how an observer binds elements
into a coherent whole. So IoC 2.0 is:

> Give every city element a stable address, compute the structural properties Lynch
> says make an element bind, and let every system measurement resolve to an
> address in the image.

The payoff is a sentence a planner can act on, instead of two dashboards:

> Drainage is over capacity around **the Kranj–Škofja Loka path**, at the
> **Golovec seam** where the Sava crosses it.

---

## 1. What Lynch actually did

Worth stating precisely, because the secondary literature gets it wrong.

**The three cities are Boston, Jersey City and Los Angeles.** Not Mexico City —
that is a persistent error in citations. The book's own dust jacket, the preface,
and Chapter II all name Boston, Jersey City and Los Angeles. Mexico City does not
appear as a study city.

**The method (p.14–15).** Two independent techniques per city:

1. *Field reconnaissance* — a trained observer walking the study area, mapping the
   presence of elements, their visibility, their image strength or weakness, and
   their connections and disconnections. Subjective judgements made in the field.
2. *Resident interviews* — long interviews eliciting the resident's own image, with
   descriptions, locations, sketches, and **imaginary trips**.

Study areas were roughly 2.5 × 1.5 miles. Thirty people were interviewed in Boston,
fifteen each in Jersey City and Los Angeles. Boston additionally got photographic
recognition tests, walked field trips, and directions asked of passers-by.

Lynch is explicit about the limits (p.15): the samples were small and skewed toward
professional and managerial classes, so this is not a true public image. But the
independent field analyses *predicted* the interview-derived group image rather
well — which is his evidence that **physical form itself shapes the image**.

**What he held constant.** An environmental image has three components: **identity**,
**structure**, and **meaning** (p.9–10). Lynch deliberately abstracts the first two
and leaves meaning out, on the grounds that meaning is too culturally variable to
model and "we may even be wise to concentrate on the physical clarity of the image
and to allow meaning to develop without our direct guidance."

That decision is the most important thing in the book for us, and it is the reason
IoC 2.0 is safe to build. We are not trying to measure what a city *feels* like. We
are measuring whether its form is well organised.

**The two core criteria.**

- **Legibility** (p.2–3): "the ease with which its parts can be recognized and can
  be organized into a coherent pattern."
- **Imageability** (p.9): "that quality in a physical object which gives it a high
  probability of evoking a strong image in any given observer… that shape, colour or
  arrangement which facilitates the making of vividly identified, powerfully
  structured, highly useful mental images of the environment."

Note the direction of travel: imageability is a property of the **object**, not of
the observer's feeling. That is what makes it computable.

**A good image** must be sufficient, readable, safe (a surplus of clues, so failure
is not catastrophic), **open-ended** (blank spaces the observer can fill), and
communicable (p.10). Lynch insists the observer stay active: "An environment which
is ordered in precise and final detail may inhibit new patterns of activity… what we
seek is not a final but an open-ended order."

---

## 2. The five elements — definitions and what is actually computable

Lynch's own framing matters here. At the end of Chapter IV (p.108) he walks the
categories back:

> "The five elements… must be considered simply as **convenient empirical
> categories**, within and around which it has been possible to group a mass of
> information."

He is telling us these are scaffolding, not ontology. IoC 2.0 should treat them as
an address space, and be willing to add a sixth when the data demands it.

Current mapping in `src/data/city-image.ts` (OSM proxies):

| Element | App proxy today | Source |
|---|---|---|
| paths | named primary/secondary/tertiary/pedestrian ways | p.54–61 |
| edges | waterways, railway, coastline | p.62 |
| districts | named place=suburb/neighbourhood/quarter | p.66–71 |
| nodes | stations, marketplaces, squares | p.72–76 |
| landmarks | historic, tourism=attraction/museum/viewpoint | p.78–82 |

### 2.1 Paths — and the one measurement that matters most

Lynch works through a sequence of measurable attributes (p.54–61): a path may be
**identifiable** (continuous), **directional** (a gradient makes one end unlike the
other), **scaled** (position along the line is felt), **aligned** (its direction is
referable to a larger system), and **connected** into a structure.

All five are computable from OSM. The one that is most valuable, and that the
current build has no notion of, is **detachment**.

Lynch's finding: paths that are physically prominent but *cut off* from the city do
not enter the image at all.

- The **Central Artery** in Boston — "more detached from its surroundings… Many
  subjects had great difficulty aligning the Artery to surrounding elements."
- The **Los Angeles freeways** — "were not felt to be 'in' the rest of the city, and
  coming off an exit ramp was typically a moment of severe disorientation."
- The **buried subway** — "a disconnected nether world."

This is a genuinely operational insight for us. It is also the exact failure mode of
a modern infrastructure city, which is what City Hub models.

> **Proposal — Path detachment index.** For each path, compare its orientation and
> its crossing connectivity to the surrounding network. A path that is geometrically
> dominant but topologically disconnected is a *detached path*: high capacity,
> low image value. This is measurable, and it is where our transit system has
> something to say.

The complementary finding: **junctions matter more than size.** Lynch records that
crossings of more than four points "almost always gave trouble," and a taxi
dispatcher named the five-pointed Church Green crossing as one of two things that
troubled him in a city he knew exceptionally well.

### 2.2 Edges — barrier or seam

This is the sharpest conceptual contribution in the book, and it is the most
directly implementable thing in it.

Lynch distinguishes three things that look identical on a map (p.63–64):

- **Barrier.** The Central Artery "seems to divide absolutely, to isolate." It is
  "inaccessible to pedestrians, at some points impassable."
- **Seam.** Beacon Street "acts not as a barrier but as a seam along which the two
  major areas are clearly joined together." Both sides stay in visual relation.
- **Fragmentary edge.** The Central Artery is also "continuous in the abstract, but
  only visualized at discrete points… like a snake lying over the city image."

He also names **overhead edges** (the elevated railways), which are lateral
references from above rather than on the ground.

And the consequence, which is the part that should worry a planner: **edges
fragment cities.** The railroad cuts in Boston "seemed to dismember the city, and to
isolate the 'forgotten triangle' between the Back Bay and the South End."

> **Proposal — Seam vs barrier test.** For each edge, measure crossing connectivity
> along its length. Dense crossing → seam: the edge joins, and should be treated as
> a corridor to strengthen. Sparse crossing → barrier: the edge divides, and any
> system that depends on crossing it is at risk. Same OSM line, opposite planning
> conclusion. Right now the app draws both identically.

This is the single highest-value thing in IoC 2.0, and it is cheap.

### 2.3 Districts — three boundary characters, and the district that isn't there

Lynch's districts (p.66–71) have a **thematic unit** of three or four recurring
characters, and — critically — **boundaries come in three strengths**:

> hard/definite (the Back Bay at the Charles River), soft/uncertain (downtown
> shopping vs office district), **or absent entirely** (the South End, "for many of
> our subjects").

His Figure 25 draws both the maximum extent any respondent assigned and the "hard
core of common agreement" — a **core with a gradient around it**.

Then the finding that should govern how we render districts:

> "One of the most interesting districts is one that isn't there: the triangular
> region between the Back Bay and the South End. This was a blank area on the map
> **for every person interviewed, even the one who was born and raised there**."
> (p.20)

The cause was infrastructural: rail tracks blocked it, and the main streets of both
neighbours appeared parallel, so the matrix that would have made it a district
squeezed out.

Also relevant: a strong **node can create a district by radiation** — but these are
"primarily reference areas, with little perceptual content."

> **Proposal — core/gradient rendering.** Draw the hard core and the gradient as
> different things. And flag **unnamed enclosures**: areas that are closed off by
> barrier-edges, contain named places, but have no district identity. Boston's
> forgotten triangle is a real, findable pattern, and it is exactly what a
> drainage or transport failure produces in the cities we model.

### 2.4 Nodes — and the finding that will surprise us

Two kinds (p.72): **junction nodes** (breaks in transportation) and **thematic
concentrations**.

The perceptual result that matters:

> "elements located at junctions may automatically be assumed to derive special
> prominence from their location." People heighten attention at decision points.

But then the two examples that together dismantle the obvious assumption:

- **Scollay Square** — functionally critical, the switch point around Beacon Hill.
  Shapeless. "It could not be remembered in any concrete way." Seven of thirty
  respondents remembered it had a subway station; **nothing else could be agreed
  on.** It collected epithets — "run-down," "disreputable."
- **Copley Square** — *less* functionally important, an awkward angled crossing, but
  "very sharply imaged," because it had unique contrasting buildings and clear
  connections.

> **Functional importance and image strength are different quantities.**

That is a real insight for a planning tool, and it is computable: network degree
and betweenness give you functional importance; the presence of singular,
distinguishing, legible content gives you image strength. **A node can be the most
important junction in the city and still be invisible in it.** If our transit system
reports success at a node nobody can name, that is a finding, not a win.

Lynch also warns: "The image cannot carry too many nodal centres." Density of nodes
is not automatically good.

### 2.5 Landmarks — and the "bottomless" problem

Singularity is the key physical characteristic (p.78–79), and **figure–background
contrast is the principal factor**. A landmark may be tiny — "a doorknob as well as
a dome." Placement at a junction strengthens it; so does accumulated association.

The finding worth building a whole diagnostic around (p.81):

> "Most of Boston's distant landmarks… were **'bottomless'**; they had a peculiar
> floating quality. The John Hancock Building, the Custom House, and the Court
> House are all dominant on the general skyline, but the location and identity of
> their base is by no means as significant as that of their top."

And the general rule from *The Shifting Image* (p.86):

> "if a tall building is unmistakable in the city-wide panorama yet unrecognizable
> from its base, then a chance has been lost to pin together the images at two
> different levels."

The State House is the rare exception — recognisable at many levels at once, with
symbolic and visual importance coinciding.

> **Proposal — level-coherence check.** For each landmark, compare its salience at
> district level against its salience at street level. High above, unknown below =
> bottomless. This is the mechanism by which a city loses the ability to connect
> its own skyline to its own streets, and it is measurable.

Note also Lynch's counterintuitive case (p.80–81): **Symphony Hall, Los Angeles**
was a strong landmark despite being "the very antithesis of visual imageability" —
rented quarters, a sign saying "Baptist Temple." Its strength came from the
*tension* between cultural status and physical invisibility. Worth knowing, worth not
over-modelling.

---

## 3. Structural quality — the part IoC 1.0 is missing entirely

### 3.1 Four stages of structure (p.86–90)

Lynch grades the internal structure of an image along a continuum:

| Stage | Description | Movement possible? |
|---|---|---|
| **free** | parts unrelated, vast gaps | only with systematic coverage |
| **positional** | parts roughly related by direction/distance, still disconnected | by searching, weaving, risking overshoot |
| **flexible** | parts connected loosely, "as if by limp or elastic ties"; sequence known, mental map distorted | comfortably along known paths |
| **rigid** | parts firmly interconnected in all dimensions | can interconnect new points at will |

This is a **city-level index**, and it is computable from the element graph: build
the graph of elements, measure how completely each element binds to the others, and
report the stage. Boston, by Lynch's account, sat mid-range with a flexible but
visibly fragmented structure. Los Angeles had excellent network structure and almost
no district identity — the two are independent, and the tool should say so rather
than produce one number.

### 3.2 Hierarchical vs continuous organisation

- **Hierarchical** — wholes and parts descending from general to particular; a
  static map. "City Hospital → South End → central Boston → North End → church."
- **Continuous** — parts joined by sequence over time; "as though seen by a motion
  picture camera." Lynch calls it unrolling interconnections.

The two suit different tasks and different observers. Note that Los Angeles subjects
mostly built **continuous** images (following the gridiron), while Boston subjects
built **hierarchical** ones (via districts). The UI should let a reader pick the
organisation they actually use, because the same city produces both.

### 3.3 Pairs, complexes, and gaps

Elements either **reinforce** each other or **conflict and destroy** (p.83–84). A
landmark placed off-centre misleads; the same landmark placed correctly fixes and
strengthens a core.

Observers also bind elements into **complexes** — wholes whose parts are relatively
fixed in relation to each other — with **gaps of identity** between them, across
which the observer "must run blind." Scollay Square and Dock Square are *one block
apart* and psychologically distant.

Lynch believes the image behaves like a **continuous field**: "the disturbance of
one element in some way affecting all others," and notes that a single distortion —
the twisting of the Boston Common's shape — seemed to be reflected throughout the
image of Boston. That is an argument for never evaluating a system in isolation.

### 3.4 The ten form qualities (p.105–108)

Lynch closes Chapter IV with the qualities a designer can actually operate on:
singularity / figure–ground clarity; form simplicity; continuity; dominance; clarity
of joint; directional differentiation; visual scope; motion awareness; time series;
and names and meanings.

Two of these map onto infrastructure directly:

- **Clarity of joint** — "These joints are the strategic moments of structure and
  should be highly perceptible." A junction where water, power and transit meet but
  cannot be seen meeting is a failure of form, not just of coordination.
- **Dominance** — "dominance of one part over others by means of size, intensity, or
  interest, resulting in the reading of the whole as a principal feature with an
  associated cluster."

---

## 4. IoC 2.0 — binding systems to the image

This is the section the brief actually asks for.

### 4.1 The premise

Lynch's later *A Theory of Good City Form* (1981) proposes five dimensions of
performance — **Vitality, Sense, Fit, Access, Control** — plus Efficiency and
Justice as meta-criteria. **Access** is defined as the ability to reach "other
persons, activities, resources, services, information or places," explicitly
including **food, water, energy and information**.

That is our eight systems. Lynch's framework and `city-model.ts` are already
describing the same city from two ends.

### 4.2 Element addressability

Every element needs a stable, citable address: `id`, `kind`, `name`, `geometry`,
`provenance`, `retrievedAt`. The current parser already carries
`sourceTime` and `truncated`; it needs to carry an identity.

An address is what lets a system say "at this element" rather than "somewhere near
these coordinates." It also makes the honest failure state possible: *the drainage
failure is at the Sava, a barrier edge* is a true statement even when the OSM
sample is partial — provided we say which part we retrieved.

### 4.3 System → element projection

| System | Dominant element | What IoC 2.0 should let you ask |
|---|---|---|
| transit | paths, nodes | Which paths are detached? Which nodes are functional but unnamed? |
| water | edges (seam) | Which canals are seams the city uses, and which are barriers it works around? |
| drainage | edges, paths, districts | Where do barrier edges trap runoff? Where is the unnamed enclosure? |
| air | districts, edges | Which districts have no edge to vent into? |
| heat | districts, paths | Where does open-path corridor offset dense-district mass? |
| housing | districts | Which districts have identity, and which are homogeneous-but-invisible? |
| waste | nodes, paths | Which collection paths are routes nobody can name? |
| health | nodes | Is care reachable at nodes the image can actually find? |

### 4.4 The readout that makes it worth building

Every system verdict gains a spatial clause:

> **Drainage — over capacity.**
> Confined to the **Golovec edge (barrier, 0.4 crossings/km)** and the paths that
> terminate against it. The adjacent district has **no named identity** in the
> current sample — 7 named places, 0 district nodes, enclosed by rail.
> *Overpass returned a truncated sample; the district reading is indicative.*

That is three layers of real information: the pressure, the form that explains it,
and the honest limit of the evidence.

### 4.5 Visual tools

Current state is two brown lines and a flat basemap. The gap is not decoration, it
is that **the same OSM line means opposite things depending on structure**:

- **Paths** — render by detachment. Detached paths in a warning treatment, bound
  paths as continuous. Immediately shows the transit problem.
- **Edges** — seam and barrier must look different, because they are different. This
  is the highest-value single visual change available.
- **Districts** — core versus gradient, plus a distinct treatment for the unnamed
  enclosure.
- **Nodes** — size by functional importance, *outline* by image strength. A node
  that is big but unoutlined is Scollay Square, and that should look alarming.
- **Landmarks** — flag the bottomless: prominent above, unlabelled below.
- **Levels** — a scale toggle that makes level-coherence visible, following Lynch's
  own point that the levels must interlock.
- **Sequence** — Lynch's trigger cues at turning decisions; the closest thing he
  offers to a route, and the natural unit for a transit or evacuation readout.

The existing casing treatment (white under brown, for legibility over imagery) stays.
It was added because a 3px line vanishes into satellite, and that reasoning holds.

---

## 5. What IoC 2.0 must not claim

Lynch is careful, and we should be more careful.

1. **We are measuring form, not perception.** We can compute properties that Lynch
   showed correlate with imageability. We cannot observe anyone's mental map. Every
   output is a *prediction about form*, and the UI should say so.
2. **OSM is not a mental map.** It is a catalogue with different biases — thorough on
   named roads, silent on the unnamed ones, and indifferent to the "confusion" that
   the woman in the North End used as her clue. `docs/DESIGN-AUDIT-LYNCH.md` gets
   this right and should keep saying it.
3. **Meaning is out of scope, by Lynch's own choice** (p.9–10). We are not
   measuring attachment, identity politics, or belonging. Where the app already
   separates these layers, keep them separated.
4. **The original evidence base is thin and skewed** — 60 interviews total, biased
   to professional and managerial classes, in three American cities in 1959. Lynch
   says so himself. It is a theory of what to look for, not a benchmark to score
   against.
5. **Known critiques.** Gottdiener and Lagopoulos (1986) argue Lynch's method is
   perceptual rather than conceptual, reduces the environment to perceptual
   knowledge, and privileges movement over other urban uses. Golledge and Stimson
   (1997) and O'Neill (1991) fault him for ignoring the *relational* characteristics
   between elements. That last one matters most here: it is largely why IoC 2.0 is
   built on structure and pairs rather than on element counts.
6. **Imageability ≠ intelligibility.** Space Syntax gives measurable integration and
   connectivity; Dalton and Bafna put the relationship precisely — *all imageable
   cities must be intelligible, but all intelligible cities need not be imageable.*
   Los Angeles is the proof: an excellent grid, almost no image. A tool that reports
   only connectivity will flatter Los Angeles forever.

### Where the modern work helps

- **Space Syntax** (Hillier and colleagues) supplies the measurement vocabulary —
  integration, connectivity, intelligibility, control — and O'Neill (1991) adds
  inter-connection density. Lynch's own *Good City Form* (1981) moved toward
  spatial configuration for exactly this reason.
- **Ewing and colleagues** (2006; Ewing and Handy 2009, *Measuring the
  Unmeasurable*) operationalised perceptual qualities including imageability,
  enclosure, human scale, transparency, complexity, linkage, legibility and
  coherence.
- **Empirical links now exist.** "Imagine a Walkable City" modelled urban
  imageability with a single entropy metric, paired it with 233,000 wearables over
  three years across 19 cities, and found the legibility hypothesis survives
  controls for greenery, wealth, walkability, landmarks and weather: more imageable
  cities produced more physical activity. Sketch-map studies — Tel Aviv, r = 0.695
  between a street's imageability and its network eccentricity — give a concrete
  link between how often a street appears in residents' maps and its topological
  position. Those are the closest things to validation this framework has, and they
  justify measuring structure rather than trusting a visual impression.

---

## 6. The smallest honest slice

If this is worth building, it is worth building in an order that can fail loudly.

1. **Edge classification** — seam vs barrier, from crossing connectivity. One number
   per edge, one visual distinction, immediate civic meaning. Boston's Central
   Artery is the test case; if the method cannot separate the Artery from the
   Charles River it is not measuring what Lynch meant.
2. **Path detachment** — same idea for transit, and the systems model already has
   the capacity numbers to hang it on.
3. **Node image-strength vs functional importance** — the Scollay Square finding, and
   the first thing that will visibly disagree with a transit dashboard.
4. **System→element projection** — only worth building once 1–3 give the systems
   somewhere real to point.
5. **Level coherence / bottomless landmarks** — the most interesting, the most
   fragile, and the one most likely to need real images rather than OSM.

Steps 1–3 are all measurable from the data the app already fetches.

---

## 7. Sources

**Primary**

- Lynch, K. *The Image of the City*. MIT Press / Joint Center for Urban Studies,
  1960. **Read in full.** Every quotation above is from this edition, and page
  numbers are to it.

  Pages read directly and quoted or cited in this document: 1–20 (Ch. I, the method,
  Boston); 33–50 (paths pp.54–61, edges p.62, districts pp.66–71, nodes pp.72–76,
  landmarks pp.78–82, element interrelations p.83, the shifting image p.85, image
  quality pp.86–90); 51–61 (Ch. IV, city form, the ten form qualities pp.105–108,
  the sense of the whole).

  Section openings are from the table of contents and are **not** independently
  verified here: the Paths chapter opens at p.49, Edges p.62, Districts p.66, Nodes
  p.72, Landmarks p.78, Element Interrelations p.83, Image Quality p.87. Lynch's
  one-line definitions of each element are quoted above from the pages actually
  read, not from those opening pages.
- Lynch, K. *A Theory of Good City Form*. MIT Press, 1981. Five dimensions of
  performance — Vitality, Sense, Fit, Access, Control — and Efficiency and Justice
  as meta-criteria.

**Verification of the study cities**

- MIT Libraries, *Year 100 – 1960: The Image of the City by Kevin Lynch* —
  <https://libraries.mit.edu/150books/2011/04/16/1960/> — confirms Boston, Jersey
  City and Los Angeles.
- MIT Archives, *Drawings and photographs used in The Image of the City* —
  <https://archivesspace.mit.edu/repositories/2/archival_objects/187540> — field
  research in the same three cities.

**Modern measurement and critique**

- Hillier, B. et al. — space syntax; natural movement; integration and
  connectivity.
- Dalton, A. & Bafna, S. — relation between Lynch's elements and space-syntax
  descriptors; *all imageable cities must be intelligible, but not vice versa* —
  <https://www.spacesyntax.net/symposia-archive/SSS4/fullpapers/59Dalton-Bafnapaper.pdf>
- O'Neill, B. (1991) — inter-connection density; wayfinding performance.
- Ewing, R. et al. (2006); Ewing, R. & Handy, S. (2009), *Measuring the
  Unmeasurable* — operationalised perceptual qualities.
- Gottdiener, D. & Lagopoulos, A. (1986) — the three key critiques of Lynch's
  methodology.
- Golledge, R. & Stimson, B. (1997); cited in Long, Baran & Moore for the critique
  that Lynch ignores relational characteristics between elements.
- Tel Aviv sketch-map study — imageability of a street as frequency of appearance in
  resident sketch maps; correlation with network eccentricity, r = 0.695.
- *Imagine a Walkable City: Physical activity and urban imageability across 19 major
  cities* — entropy-based imageability metric, 233K wearables, three years.
- *Urban Visual Intelligence: Studying Cities with AI and Street-level Imagery* —
  <https://arxiv.org/pdf/2301.00580> — CV measurement of enclosure, façade
  complexity, urban furniture.