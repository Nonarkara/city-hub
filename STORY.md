# The Story

*Why this dashboard exists, why it isn't on UNL anymore, and why I think that matters.*

— Non Arkaraprasertkul, Bangkok, May 2026

---

## 1. Origin

I build dashboards for smart cities. Real ones — Bangkok, Phuket, Kuching, Singapore, Jakarta, KL. Not the brochure kind that show a green checkmark on every metric, but the kind a Governor can open at 06:00 and find out, in fifteen seconds, which district is on fire and which one is being shouted about on the news. I have shown them at conferences. People keep asking me how I do it. The honest answer is that I do it the way an architect designs a house: I start from the people who will live in it, work back to the materials, and refuse to add what doesn't earn its place.

Sometime in early 2026 I was looking for a vector basemap that would let me draw Bangkok the way Vignelli would have drawn Bangkok — geometric, hairlined, dark, amber-warm. Someone in my network recommended the UNL Platform. They said it was a "Location OS." That phrase appealed to me. I had been calling my own work a "City OS" for months. I assumed there would be common ground.

I created a developer account at `platform.unl.global`. I read their documentation. I built a working dashboard against their vector tiles in two days. By the end of the week the dashboard had eighteen live data layers from GISTDA, NASA FIRMS, Open-Meteo, the Thai Meteorological Department, Traffy Fondue, GDELT, the BMA open-data portal, WAQI, and Google Earth Engine. The UNL tiles were the canvas underneath all of that. Everything else was mine. I was, to use my own words, *exploring it to the point that I should get a Nobel Prize for it.*

---

## 2. What UNL actually is

This part matters because I didn't know it when I started. I should have. Here is the public record, in their own words and from public sources, so anyone else looking at the platform has the context I didn't:

- **Company:** UNL Global B.V. Incorporated in Amsterdam, the Netherlands. Founded 2018.
- **Founders:** Xander van der Heijden (Founder & CEO, now based in Singapore), Mihaela Georgieva (Co-founder & CCO), Pascal Verloop (Founder & COO).
- **Product:** A "Location OS" built around "UNL geoIDs" — proprietary identifiers said to address any point on Earth to 1×1 cm² precision. Sold as APIs, SDKs, and a web platform called UNL Studio for managing "Virtual Place Models" (VPMs).
- **Funding:** $2 million seed, March 2020. Co-led by **HERE Technologies** and Elev8.vc (Singapore). Other investors include SGInnovate, SOSV / MOX, and Venturerock.
- **Underlying tile + glyph stack:** HERE Maps. This is verifiable from the platform itself — the vector tile style references `assets.vector.hereapi.com` for glyphs, and HERE is one of the company's two largest investors. UNL is, in practical terms, a thin proprietary addressing layer plus a developer-experience wrapper around HERE.

That last point is not a criticism. Lots of valuable companies are thin layers on top of other companies' infrastructure. Stripe is a thin layer on top of card networks. What it does change is the answer to the question *who is the platform, really?* If I had known on day one that the basemap I was building against was HERE, I might have just gone to HERE directly.

Sources for the above:
- UNL on [Crunchbase](https://www.crunchbase.com/organization/unl)
- UNL's own [announcement of the 2020 seed round](https://unl.global/unl-news/unl-global-closes-2m-funding-to-build-the-internet-of-places/)
- [Silicon Canals coverage](https://siliconcanals.com/unl-dutch-smart-addressing-platform-funding/)
- [AsiaTechDaily coverage](https://asiatechdaily.com/smart-addressing-platform-unl-secures-2m-in-early-stage-funding/)
- [Xander van der Heijden's public LinkedIn](https://sg.linkedin.com/in/xandervdheijden)

---

## 3. What I expected, what I received

I expected what the word *platform* implies — a runway. I expected to be able to read the docs, build something, show it to my network, come back when I had paying clients, and start paying then. That is how every developer platform I have used in twenty-five years has worked. AWS lets you spin up a free EC2 instance for a year. Mapbox lets you serve 50,000 map loads a month before you owe them a cent. Anthropic gives you free API credits to evaluate Claude. The implicit contract is *try it, build something real, and we'll both benefit if it works.*

What I received was an unsolicited message from UNL's CTO — a different person from the CEO, whose name I'll leave out of this document — telling me to stop exploring the platform because I was at risk of triggering billing, and asking me to schedule a video call in which she would explain to me, before I touched anything else, what I was and was not allowed to do on the platform.

I had no card on file. I had signed no contract. I had been invited to use the developer portal.

I'm not going to reproduce her exact words here because I think the message itself is what matters, not the cadence. The pattern was: *exploration is not a permitted state; sales conversation is the permitted state; please convert from one to the other.*

---

## 4. Why I left

A platform that is uncomfortable with an experienced engineer exploring it is not a platform. It is a sales funnel with documentation attached.

That is a defensible business model in some industries — enterprise software with six-figure ACVs, defense, regulated finance — where the customer is so big and the deal so slow that gatekeeping pays for itself. It is not a defensible business model for a developer platform whose pricing page advertises a free tier. If you advertise a free tier, you are asking developers to evaluate you on the work. If you then interrupt the evaluation to ask the developer to sit in a webinar instead, you are violating the contract you offered.

There is a second reason, which I'll state plainly. I am not a programmer. I am an anthropologist by training, an architect by trade, and a smart-city consultant by current practice. I work with Claude as my pair-programmer. The dashboards I ship are *the product of an experienced person who understands the city, working with a model that understands the syntax*. That collaboration is fast. It is much faster than a 2018 Amsterdam startup whose go-to-market is conference calls. When the CTO told me to wait until she could explain to me what I could and could not do, she was, without realising it, asking the present to slow down for the past.

That is the meaning of disruption. Not "we have a slightly better product." But: *the production function has changed underneath you, and the way you sell no longer matches what your customers can do for themselves.*

---

## 5. What I built instead, in days

This repository is what I built instead. It runs at [city-hub.pages.dev](https://city-hub.pages.dev) and on a custom subdomain to be announced. It does everything the UNL-tiled version did, plus:

- **Better basemap.** Mapbox GL JS — the same stack I use across my [geopolitics](https://github.com/Nonarkara/geopolitics-dashboard), [Phuket](https://github.com/Nonarkara), and [SLIC Index](https://github.com/Nonarkara/SLIC-Index) dashboards. Battle-tested. Globally consistent.
- **Same data, undiminished.** Every operational data source — GISTDA PM2.5, NASA FIRMS fires, Open-Meteo air-quality forecast, TMD official weather, Traffy Fondue civic reports, GDELT news sentiment, WAQI stations, BMA open-data, Google Earth Engine AlphaEarth embeddings, Longdo POIs — was already independent of UNL and is unchanged.
- **The governor's view.** A mobile-perfect bottom-sheet brief that opens with one tap. PM2.5 provincial rank. TMD 5-day forecast. AI-narrated situational summary in Thai and English. Anomaly detection across sources. Civic-issue heatmap and the discrepancy between what the air quality says and what the news says.
- **No lock-in.** The stack is React, TypeScript, MapLibre-compatible Mapbox GL JS, Cloudflare Pages, and a Cloudflare Worker proxy for CORS-blocked APIs. Every piece is replaceable. Every piece is documented in [docs/UNL-DEPENDENCY-INVENTORY.md](docs/UNL-DEPENDENCY-INVENTORY.md), which I wrote *before* migrating so I would know exactly what I was leaving and what I was keeping.

The migration itself took one evening with Claude. From the moment I decided to leave to the moment the new repository was deployed and live: about six hours of focused work, ending with this document.

---

## 6. What I still don't know

I want to be honest about the limits of what I am claiming here. I do not have receipts I can publish — the CTO's messages are in my inbox but I have not asked her for permission to publish them, and on balance the platform's behaviour is the point, not the specific words she used. If she would like to respond, my email is on `nonarkara.org`.

I also do not know:

- **Whether other developers have had the same experience with UNL.** If you have, I would like to hear about it. Open a GitHub Issue on this repository or write to me directly.
- **What UNL's actual revenue mix looks like.** A platform whose investors are HERE Technologies plus a clutch of seed funds, six years past seed, is presumably under pressure to show enterprise revenue. The CTO's behaviour is consistent with that pressure. But I cannot prove it from public sources.
- **Whether the "geoID" precision claim — 1×1 cm² — is real in production**, or whether it is a marketing precision that assumes ground-truth GPS the customer has to provide. I never got far enough to evaluate it, because I was redirected to a sales call.
- **Whether HERE Technologies sees UNL as a strategic acquisition target, a distribution partner, or a portfolio bet they'll let lapse.** This matters because if you build on UNL, you are effectively building on a HERE wrapper that may or may not exist in five years.

I will update this document if any of those questions get answered.

---

## 7. The lesson, for anyone considering a platform like UNL

Three checks, before you write a single line of code against a developer platform you don't already know:

1. **Find out who owns the underlying infrastructure.** If the platform is a wrapper around someone else's tiles / models / data, you usually want to go to the source. Wrappers add a layer of business risk without removing a layer of technical risk.
2. **Test the support channel before you test the API.** Ask a real question. Read the answer. If it's a sales pitch in disguise, the platform's economics aren't where it claims they are.
3. **Watch what happens when you do real work on the free tier.** A developer platform's relationship to its free tier is its relationship to you. If the free tier is treated as a leak the company is trying to plug, you are not the customer — you are the lead. Behave accordingly.

I learned the third one the slow way. I am writing this so the next person can learn it faster.

---

## 8. Credits + license

**Built with** Claude (Anthropic) — for the code; my own twenty-five years of building cities — for everything else.

**Powered by** GISTDA · NASA FIRMS · NASA GIBS · Open-Meteo · Thai Meteorological Department · Traffy Fondue · GDELT · WAQI · Pollution Control Department (Thailand) · BMA Open Data · data.go.th · Google Earth Engine · Longdo Map · Mapbox · Cloudflare Pages · Cloudflare Workers.

**For** DEPA Thailand and every city operator who has ever wished the dashboard would just tell them what to do next.

ทุกอย่างเกิดขึ้นเพราะมีเหตุ — *everything happens for a reason.*

MIT License. Use it, fork it, ship your own.
