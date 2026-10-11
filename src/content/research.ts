/**
 * The v7 research note. Rendered in the Research panel.
 * Concrete first. The bar is the short form of this argument.
 */
export interface ResearchSection {
  id: string
  heading: string
  paragraphs: string[]
}

export const RESEARCH_SECTIONS: ResearchSection[] = [
  {
    id: 'question',
    heading: 'The question',
    paragraphs: [
      'City Hub reads a city against other cities. The satellite photo is the ground under that reading. It is not the finding.',
      'A split screen of two images answers “what does it look like?” A mayor, a researcher, or a resident usually needs three other questions: what is this city doing now, where do the official records and the sensors disagree, and is that unusual compared with somewhere else?',
    ],
  },
  {
    id: 'three',
    heading: 'Three readings',
    paragraphs: [
      'Now. Air, heat, weather, and the tone of recent news. These move. A photograph does not. They come from Open-Meteo and GDELT, the same way, for every city.',
      'Disagreement. When a registry and a satellite describe different cities, the gap is the subject. In Bangkok the civil registry for 2568 (2025) records more deaths than births in 36 of 50 districts. NASA VIIRS night lights over those same districts got brighter, from about +7% to +89% year to year. People can show up in the light and be missing from the register. That gap is the shadow population — ประชากรแฝง. The summary on the bar is the published finding. Some district figures inside the brief are estimates, and they are marked as such. Night lights are not a headcount. They are a reason to doubt a registry that says a district is emptying while the district gets brighter.',
      'Comparison. The same questions, the same open sources, on the cities you pin — up to eight. Comparison is the product. Putting two photographs side by side is one way to look, not the reason the tool exists.',
    ],
  },
  {
    id: 'bar',
    heading: 'What the bar is saying',
    paragraphs: [
      'The line under the title is the reading. For Bangkok it is the registry against the night lights. For Chiang Mai it is the valley and the smoke. For a city we have not yet studied that closely, the line says the questions are the same — it does not invent a finding.',
      '“This view” is the frame you are moving. Area, and a resident estimate from the city’s average density applied only where the frame overlaps the city box. It updates as you pan. It is not a census of who is standing there.',
      'Compare puts cities side by side. Look changes the ground: a photo, night lights, heat, vegetation, or haze, on any city. Research is this note. Everything else — the next 48 hours, what the open web is saying, patterns, smoke, the city brief — sits under More, in ordinary words.',
    ],
  },
  {
    id: 'v7',
    heading: 'What changed in this version',
    paragraphs: [
      'The previous bar was a row of codes — Split, Twin, Sit Room, Intel, Forecast — and a scrolling news crawl laid over a satellite image. That reads as a photo viewer with a ticker. It did not say what we had found.',
      'Version 7 names the actions for the question they answer, and puts the finding in the line under the title. Headlines are still collected. They live under This view, as a short dossier: what Wikipedia says, which outlets repeat, the tone, and theme counts. A crawl looks busy. It does not tell you the disagreement.',
    ],
  },
  {
    id: 'limits',
    heading: 'What we will not claim',
    paragraphs: [
      'We do not count people in the frame. We do not scrape social networks. The web read is English Wikipedia and GDELT. Theme labels are keyword hits on headlines, not a poll.',
      'We do not treat a brighter night image as proof of population growth. We treat it as a disagreement with a registry, and we say so. Sources for the Bangkok line: Department of Provincial Administration civil registration 2568, as compiled by DataProteins, and NASA VIIRS Black Marble.',
    ],
  },
]
