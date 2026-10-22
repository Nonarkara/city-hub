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
```

`msh-sweep.mjs` answers "is the City image surface clean at all three widths".
`msh-surfaces.mjs` answers the same for the satellite comparison and the notes
rail. Both check: horizontal overflow, elements past the right edge, visible
regions with no content, combined chrome cost, major-region overlap, text
clipped by its own box, and sub-24px tap targets on a phone.

**A numeric sweep is necessary and not sufficient.** The envelope clipping was
invisible to every geometry check — the boxes were correctly sized and nothing
overlapped. It was found by reading a screenshot. Capture and *look* at all
three viewports; measure what the eye catches.

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

---

## The standing order

**When you find SH, massacre.**

Remove the invented need for space. Restore the useful picture. Make the screen
help the human read, choose, and act.