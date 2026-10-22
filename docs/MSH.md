# MSH — Massacre Spatial Hallucination

> **When you find SH, massacre.**
>
> Owner's design law. Read before designing, building, or reviewing any interface.
> Applies to every agent, every viewport, and every visual surface.

This is the canonical text. If a design decision in this repository cannot
answer the three questions in §1, it is SH, and §5 is the repair.

---

## 1. The definition

**Spatial hallucination (SH) is when an interface invents a reason for things to occupy space, instead of arranging them around how people read, choose, and act.**

The layout looks composed at first glance but cannot explain its own geometry.
A container has room, so a control expands. A row has height, so every sibling
stretches. A header has little to say, so padding makes it look important.
The user pays for those decisions with scrolling, lost context, and effort.

MSH means finding and removing that invented spatial demand. Treat SH as a
root design failure, not cosmetic polish. A working system can still have bad
design when its geometry makes a small task expensive.

**The test for every region:**

> Why is this here? Why this size? Why this far from that?

"The grid put it there," "the container had room," and "it looks balanced"
without a reading or task purpose are failed answers.

### The owner's own framing

SH is like bureaucracy. A good one works like a bento box: neat, varied,
portable, effective, economically resourced. A bad one is bloated,
disorganized, unbalanced, hard to read, longer than it should be, ugly — and it
got that way by accretion, never by a decision. Each new department, meeting,
and working group was justified locally. Nobody decided to make it bloated.
SH is the same failure with pixels: rules bend over generations, space accretes,
and the result is hallucinated.

You can spot it the way you spot bad bureaucracy — by looking at how frequent
the unintentional design is.

---

## 2. How the failure spreads

1. An element expands without a task reason.
2. Its row, header, or panel grows to accommodate it.
3. Useful content falls below the first screen.
4. Related information and actions lose their shared context.
5. The user scrolls to reconstruct a picture the layout should have provided.
6. Repeated equal-sized blocks flatten hierarchy and make the journey monotonous.

Fix the first unnecessary expansion. Do not decorate the consequences.

---

## 3. Recognize SH on sight

| Symptom | What failed | Repair |
| --- | --- | --- |
| Gigantic top bar | Identity and navigation consume space needed by the task | Fit the bar to its useful contents; combine redundant rows |
| Unjustified gaps | Space stretches to satisfy a container | Use deliberate group spacing; remove unused tracks |
| Orphan photo or block | An element sits beside an unexplained void | Recompose its relationship to the content |
| Scattered actions | Related controls occupy separate rows or distant edges | Place them together at the decision point |
| Equal-weight everything | Repetition replaces hierarchy | Establish a first, second, and third reading priority |
| Accidental wrapping | Navigation breaks wherever width happens to run out | Choose deliberate groups and a responsive transition |
| Expensive small decision | A short task requires a long scroll | Bring the evidence and action into one useful view |
| Inflated controls | Short labels inherit container-sized boxes | Size to label, padding, and usable interaction target |
| Stretched cards | Short content inherits the tallest sibling's height | Let content size itself unless comparison requires alignment |
| Empty hero or spacer | A section exists to manufacture importance | Remove the section or give real content its place |
| Overlapping chrome | Fixed or sticky regions obscure the work | Account for their occupied area and reduce their footprint |
| **Duplicated fact** | The same city-level number is rendered N times because a city-level panel was placed per pane | Lift it to the surface that owns it; render it once |
| **Unreachable content** | A child of a column flex box has `overflow: auto` but no `flex: 1; min-height: 0`, so it sizes to its content and never scrolls — while an ancestor's `overflow: hidden` cuts the overflow away | Give the scroll region a flex contract; assert the control is reachable, not merely present |
| **Unadmitted overflow** | A list scrolls, but with no scrollbar, fade, or marker — so the cut edge reads as the end of the data | Style the scrollbar and fade the cut edge; never let a clipped list look complete |
| **Navigation deleted as responsive chrome** | A media query hides a control because its *label* was redundant, but the function exists nowhere else | Ask what else on screen offers it; if nothing, it is navigation and it stays |

These are symptoms to investigate in the rendered interface. A CSS property
alone does not prove SH.

---

## 4. The laws

### Space must have a job

Every region must support reading, grouping, comparison, orientation, interaction,
or deliberate emphasis. Name the job. If the region has none, remove the wasted
geometry. Never invent filler to justify an empty area.

### Chrome earns its pixels

Headers, navigation, toolbars, footers, and sticky bands fit their useful contents.
A brand name does not earn a giant top bar. Avoid stacking identity, page title,
status, and controls into separate bands when they form one coherent group.
Measure their combined footprint, including gaps and sticky offsets.

### Content determines size; the task determines the composition

Controls fit their labels, padding, and usable targets. Reading columns fit a
comfortable measure. Maps, charts, canvases, tables, and editors receive the space
needed to operate and understand them. Their value is not measured by text area.

Inspect fixed heights, minimum heights, full-width controls, fractional tracks,
equal-height cards, `space-between`, and stretch alignment. Each needs a reason
in the actual task. They are tools, not automatic violations.

### Compose the first screen before extending the page

For a compact dashboard, tool, or panel, first make the useful task composition
work at 390 × 844 and 1440 × 900. Check the intermediate 1024 px width too.
The first screen must explain where the user is, what matters, and what to do.

If the task can fit one screen, make it fit. If the content earns scrolling,
organize that scroll around meaningful reading or work. Preserve orientation
and keep related evidence close to its action.

Never force a fit by hiding overflow, clipping content, shrinking readable text,
removing earned features, or moving everything into nested scroll areas.

### Hierarchy must survive the viewport

One thing wins, then a second, then a third. Use differences in scale, weight,
placement, and grouping that remain obvious when squinting at a screenshot.
Within the house type system, use meaningful scale steps where appropriate;
do not make every element shout. The important picture must remain understandable
before scrolling fragments it.

### Relationships determine distance

Related controls stay together. Labels stay with their values. Explanations stay
with the decision they support. Use less space within a group than between groups.
Alignment serves these relationships; the grid does not dictate them.

### Responsive layout is a composition decision

Do not let desktop geometry simply fall into a long phone-sized stack.
Choose what stays together, what changes arrangement, and how navigation adapts.
Test long labels, real data, text enlargement, and expanded states. Fix accidental
wrapping without truncating the information needed to act.

### Whitespace is allowed; unexplained space is not

Whitespace can separate meaningful groups, support reading, or establish emphasis.
It becomes SH when it asks the reader to supply an intention the designer never had.
Density is not the goal. A readable, calm composition may need generous space.
Every such choice must still answer the three questions.

### **A zero is a measurement, this has an absence**

An absent value is not zero, and an absent region is not fillable space. This law
holds in both directions: never render `0` for "not published", and never let an
unmeasured region be treated as blank canvas to be filled. The repo's product
constraint is one shared accessor per guarded quantity — `populationDensityPerKm2`
owns the unknown-population guard, and every consumer reads through it.

---

## 5. Repair procedure for agents

1. **Read the current instructions.** Apply `anti-slop-design`, project design laws,
   and anti-regression rules. Inspect the existing product before editing.
2. **State the user's task in one sentence.** Identify the information and action
   needed to complete it, then choose the dominant element.
3. **Inspect the rendered geometry.** Start with the top bar and the first point
   where useful content leaves the viewport. Trace the expansion that caused it.
4. **Name each failure precisely.** Record the element, viewport, wasted space,
   and the reading or interaction cost. Do not call a surface "slop" as a diagnosis.
5. **Repair the cause.** Remove redundant wrappers and spacers, reduce unjustified
   padding, regroup related controls, correct track sizing, and recompose priorities.
6. **Preserve the product.** Keep live maps, charts, canvases, tickers, HUDs, earned
   content, keyboard access, readable type, and usable interaction targets.
   MSH authorizes removing waste; it does not override anti-regression rules.
7. **Render again.** Exercise real content, open menus, expanded panels, error states,
   and keyboard focus. Check that the repair did not move the problem elsewhere.
8. **Record evidence.** Provide before/after screenshots and measured changes.
   Apply the project's release and independent-review requirements for visual work.

Do not solve SH by adding another spacer, decorative panel, badge, slogan,
stock image, or row of identical cards.

---

## 6. Evidence required before declaring a pass

Capture the real interface at 390, 1024, and 1440 px wide. Use 390 × 844 and
1440 × 900 for the first-screen checks; record the height used at 1024 px.

For each tested viewport, record:

- **Chrome cost:** top/bottom chrome height and percentage of viewport height;
  include the combined height of stacked fixed or sticky regions.
- **Task visibility:** whether the primary information and action are visible
  together; if scrolling is required, explain what content earns it.
- **Geometry failures:** unexplained gaps, orphan elements, inflated boxes,
  accidental wraps, overlap, clipping, and unnecessary horizontal scrolling.
- **Hierarchy:** the intended first, second, and third reading priorities and
  whether the screenshot makes them apparent.
- **Preservation:** important content, features, readable text, focus visibility,
  and usable targets still work after the change.

A large footprint is a prompt to investigate, not a universal numeric failure.
Explain geometry in relation to the task. Source scans and successful builds
cannot prove a visual pass. If rendering was unavailable, report **unverified**.

---

## 7. The agent's completion report

Keep the report short and concrete:

- **Found:** element, viewport, and the task cost caused by its geometry.
- **Changed:** the unnecessary spatial demand removed or relationship repaired.
- **Verified:** screenshot references, measured before/after geometry, exercised
  interactions, and any required independent review.
- **Remaining:** unresolved SH or unverified states. Never claim a clean pass
  while these remain.

---

## 8. Instrument

The law is measured, not eyeballed. The audit harness lives **outside** the repo
so it never becomes production code:

```
/tmp/unl-probes/msh-audit.mjs     # TARGET=<url> node msh-audit.mjs
```

It stubs the Overpass read so a full profile renders deterministically, clicks
into City image, then reports: panel box, per-row height and wrap count, verdict
column width, overlap list against map chrome, `.split-grid` geometry, panel
count, and viewport. Cite those numbers in the report, not adjectives.

```
/tmp/unl-probes/msh-surfaces.mjs   # satellite compare + notes rail, same 3 viewports
/tmp/unl-probes/msh-rest.mjs       # single-city, research panel, workbench
/tmp/unl-probes/msh-overlays.mjs    # Look menu, More menu, plan surface
/tmp/unl-probes/scroll-audit.mjs   # unreachable content: hidden by an ancestor it cannot scroll out of
```

`msh-sweep.mjs` answers "is the City image surface clean at all three widths".
`msh-surfaces.mjs` answers the same for the satellite comparison and the notes
rail. `msh-rest.mjs` covers the single-city view, the research panel, and the
city explorer. `msh-overlays.mjs` covers the topbar menus and the plan surface.
`scroll-audit.mjs` walks every element looking for content cut off by an
`overflow: hidden` ancestor it has no scroll escape from.

All of them check: horizontal overflow, elements past the right edge, visible
regions with no content, combined chrome cost, major-region overlap, text
clipped by its own box, sub-24px tap targets on a phone, and regions whose area
is far larger than their content.

**A numeric sweep is necessary and not sufficient.** The envelope clipping was
invisible to every geometry check — the boxes were correctly sized and nothing
overlapped. It was found by reading a screenshot. Capture and *look* at all
three viewports; measure what the eye catches.

**Wait for the map.** Screenshotting a MapLibre pane during tile load captures
black rectangles that look exactly like a layout failure. Wait on
`networkidle` plus a settle before judging; a black pane is not a void until it
is still black after the tiles return.

**Kill your own dev servers before the e2e suite.** A spec that passes in
isolation and times out in the full run is measuring the machine. A stray
`vite --port 4199` left over from an audit was enough to push one 60s spec over
budget; with it stopped the same suite went 23/23 in 1.4 minutes. Probe scripts
that need a server should start it, use it, and stop it — never leave one running
across a test run.

**Three harness traps that each produced a false "the control is broken".**
These cost three wrong diagnoses in one audit. All three are silent — the probe
returns a number, and the number is about the probe, not the product.

1. **Visibility must walk the whole ancestor chain.** Testing `display` on the
   element alone reports responsive duplicates inside a `display: none` wrapper
   as visible. A first pass found four "0 × 0 focusable" topbar controls at
   390 px — all correctly hidden, `focus()` correctly a no-op, click correctly
   timing out. Phantom findings.
2. **One page per menu.** These menus set `body { overflow: hidden }` and leave
   a backdrop up. Closing one in place makes the next click hit the backdrop and
   time out, which reads as "this button is dead". Each opens perfectly well on
   its own page. Also: **Escape does not close them** — the backdrop click does.
3. **`networkidle` never settles on a page with live feeds.** The app polls
   Open-Meteo, so `waitUntil: 'networkidle'` times out on a 90 s budget while the
   page is perfectly healthy. Use `domcontentloaded` plus an explicit settle.
4. **Playwright cannot close over module scope.** A helper defined outside
   `page.evaluate` throws `ReferenceError: X is not defined` inside the page.
   Define it inside the function passed to `evaluate`.
5. **Test the right magnification.** Setting `documentElement.style.fontSize`
   tests nothing on a stylesheet written in `px` — nothing enlarges and the
   surface looks clean. CDP's `setPageScaleFactor` is worse: it scales
   rendering without reflowing, which is pinch-zoom, not browser zoom. Browser
   zoom reflows, so simulate it with a **halved CSS viewport** (200% on
   1440 × 900 → 720 × 450). And filter `.visually-hidden` out of any
   clipped-text check: the screen-reader class is *supposed* to be 1 × 1.

A probe that reports a failure must be able to answer "or is this me?" before the
finding goes in the report.

### Repository-specific findings

Recurring shapes found by this instrument in City Hub, so they are recognised
on sight rather than re-derived:

- **A city-level fact rendered per pane.** The form readout is a property of a
  city, not of a pane. It belongs at the `SplitCompare` surface between
  `.city-image-nav` and `.twin-map-workspace`, rendered exactly once per
  comparison. (`src/components/SplitCompare.tsx`)
- **A fixed-width panel inside a narrower pane.** `width: 340px` inside a 325px
  pane crushes the verdict column to 89px and forces 3–4 line wraps. Let the
  panel be `width: 100%` in flow and let the grid inside it size itself.
- **A `<table>` used as a narrow column.** Five rows of mixed content in one
  column is where invented height comes from. `.form-strip` / `.form-cell` with
  `grid-template-columns: repeat(auto-fit, minmax(190px, 1fr))` reads across
  instead of down. (`src/components/CityFormPanel.tsx`)
- **Repetition between a surface strip and a per-pane caption.** If a surface
  already owns a count, the pane that the surface describes must not restate it.
  Suppress only on the *primary* pane — a secondary pane has no strip describing
  it, so removing its count too would orphan that city's evidence. When the strip
  takes over the count, it must first take over the full split, not just the
  headline band, or information is lost rather than de-duplicated.
- **A sentence rendered as a full-height column.** `.city-image-reading` was a
  flex child of `.twin-map-workspace`, which is row-direction — so a 39px reading
  line stretched to 489 × 667px and stole a third of the map width. Measured
  `307,291 px²` of invented space. A reading line is a **band**: `flex: 0 0 auto`,
  `flex-direction: row`, full width, above the thing it describes. Check the
  parent's `flex-direction` before assuming a child will lay out as written.
- **Two adjacent bands carrying one message.** The form strip's provenance line
  ("OpenStreetMap candidates, not residents' mental maps") and the reading
  band's "OSM proxies; coverage varies" are the same caveat 40px apart. Merge;
  do not let both stand.
- **The honesty line clipped to hide the honesty.** `.split-pane-stat-envelope`
  carried `nowrap` + ellipsis and rendered 6px type, so at 1024 and 390
  "REFERENCE · MIXED YEARS" became "REFERENCE · MIXED YEA…" — the caveat is
  precisely what got cut. When the purpose of a line is to be *read*, ellipsis
  is the one forbidden treatment. Shorten the string or wrap it; never clip it.
- **Translucent scrim over imagery as a substitute for type size.** 8px type on a
  `rgba(4,6,11,0.6)` gradient is legible only where the satellite happens to be
  dark. Raise the type and the scrim together, or neither.
- **A later rule silently reverting an earlier repair.** The clip lived in a
  second rule further down `city-atlas.css`, overriding the fix in `index.css`.
  When a repair does not take, grep for the class in **every** stylesheet before
  concluding the fix failed.
- **A scroll region that never scrolls.** `.twin-content` had `overflow-y: auto`
  but no flex contract, so inside the column-flex `.twin-workbench` it sized to
  its content: `scrollHeight === clientHeight`, no scrollbar, and the panel's
  `overflow: hidden` cut the last action **49.7px** below the fold on a
  390 × 844 phone. Present in the DOM, focusable, and unreachable by any
  gesture. `overflow: auto` is a *request* to scroll; without `flex: 1;
  min-height: 0` on the child it is a promise nobody keeps. Test **reachability**
  (`focus()` then check it scrolled into view) — never presence, which was true
  the whole time the button was stranded.
- **A scroll region that scrolls but will not admit it.** The Look menu is 869px
  of 38 lenses in a 560px box. `overflow-y: auto` with nothing else: **311px**
  hidden below an unstyled cut that read as the end of the list, including whole
  sensor groups. Scrollability was never the defect — *admitting* it was. A
  styled scrollbar plus a `background-attachment: local` fade (which appears only
  when there is more in that direction, so it cannot lie) is the repair.
  **Found again, same shape, on `.plan-card`** — 3,400–3,900px of eight systems
  and their interventions in a 660–774px box, **78% below the fold**, ending on
  a hard cut mid-sentence. *The fix is not a one-off; it is the default for any
  scroll container in this product.* When one surface gets it, sweep for the
  others: `grep -n "overflow-y: auto" src/*.css` and check each for an
  affordance.
- **Responsive hiding that removes navigation, not chrome.** The phone topbar hid
  every child but the wordmark and Compare, justified by "each pane already owns
  its city and lens". True for those two, false for the More menu: Plan, This
  view, the next 48 hours, Ask, Patterns, Sources, Search and About exist
  nowhere else, so the rule deleted them from the product on a phone. When
  collapsing a bar, ask of each item *what else on this screen offers it* — if
  the answer is nothing, it is navigation and it stays.

---

## 9. Coverage ledger

What has actually been measured, so a later agent does not re-audit it or
mistake it for clean. Every row was captured at **390 × 844, 1024 × 768 and
1440 × 900**, read as a screenshot *and* measured.

| Surface | State | Found and fixed |
|---|---|---|
| City image — form strip, lenses, reading line | swept | per-pane duplication; reading line as a 489 × 667 column; clipped metric envelope |
| Satellite compare + notes rail | swept | clean |
| Single-city view | swept | clean |
| Research panel | swept | clean |
| City explorer (workbench) | swept | last action 49.7px below an unreachable fold |
| Look menu | swept | 311px hidden with no affordance |
| More menu | swept | deleted from phones entirely; 7 features unreachable |
| Plan / model card | swept | **2,655–3,148px (≈78%) below an unmarked cut** |
| Search / onboarding modal | swept | clean, including a long city label |
| 200% zoom (simulated at 720 × 450) | swept | no overflow; chrome cost rises to 26% **because the viewport is short, not because the bands grew** — investigated and explained, per §6 |
| Text enlargement via root font-size | **invalid test** | the stylesheet is `px`, so nothing enlarged; re-run as halved viewport |
| Compare panel at 540 px (≈267%) | swept | no overflow; chrome 39.3%, same explanation |

**Still unverified — do not claim these are clean:**

- The plan surface *in its scrolled state*: the affordance and the end-of-list
  were measured, but the full 3,400px of content was not read by eye.
- `.city-image-reading` and `.form-panel` under text enlargement, which needs a
  browser that reflows at real zoom rather than a simulated viewport.
- Anything behind authentication or the Cloudflare Worker path.

A law in prose dies on the next edit. Each row above is held by a spec in
`tests-e2e/`; if a row has no spec, it is a claim, not a guarantee.

---

## The standing order

**When you find SH, massacre.**

Remove the invented need for space. Restore the useful picture. Make the screen
help the human read, choose, and act.