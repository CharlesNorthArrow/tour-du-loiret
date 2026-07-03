# TOUR DU LOIRET — Build Specification (one-shot)

You are building a single-page promotional website for **Tour du Loiret**, a fictional-but-real 3-day cycling event for a small group of friends. The site must look and feel like an official race site (think a grand tour's stage microsite crossed with a proud commune bulletin) while the copy quietly reveals it's a joke between friends. Build it end to end in one run, following this spec exactly. Where the spec leaves a detail open, make a confident, tasteful decision consistent with the design direction — do not ask questions.

---

## 1. The event (ground truth)

- **Name:** Tour du Loiret · Édition 2026
- **Tagline:** «L'épreuve reine du Gâtinais»
- **Dates:** 28, 29, 30 août 2026 (vendredi–dimanche)
- **Base camp / Grand Départ & Arrivée every day:** 591 Les Brins, 45210 Louzouer, Loiret, France (approx. 48.055° N, 2.905° E — geocode "Les Brins, Louzouer" via Nominatim in the data script to refine; if geocoding fails, use 48.055, 2.905)
- **Format:** ride in the morning (départ 8h30, retour ~13h), afternoons are officially designated «Repos du Coureur» (pool, sieste, pétanque, apéro)
- **3 stages, 80–100 km each**, all loops from the house, all different, **no highways, no routes nationales**, favoring D-roads, canal towpaths (voies vertes), and famous cycling routes — notably the **Scandibérique (EuroVélo 3)** and the **Canal de Briare / Canal d'Orléans** towpaths.
- **Language of all site copy: French.** Official-event register, deadpan. The humor comes from playing it completely straight.

---

## 2. Tech stack

- **Vite + vanilla TypeScript** (no React — keep it lean; this is a scroll-driven page, not an app)
- **MapLibre GL JS** for the map, using the free **OpenFreeMap "liberty" style** (`https://tiles.openfreemap.org/styles/liberty`) — no API key required. If unreachable at runtime, fall back to `positron`-style raster from a keyless provider or a plain dark background with the routes still visible.
- **Scrollama** (or a small IntersectionObserver implementation) for scroll steps
- **Turf.js** (only `@turf/length`, `@turf/line-slice-along`, `@turf/bbox`) for progressive route drawing
- **D3** (`d3-shape`, `d3-scale`, `d3-array` only) for elevation profiles
- No CSS framework. Hand-written CSS with custom properties. No Tailwind.
- Static site, no backend. `npm run build` must produce a deployable `dist/` (Vercel-ready).

---

## 3. Route data pipeline

Create `scripts/fetch-routes.mjs`, run once via `npm run routes` (and run it yourself during the build).

For each stage, call the public **BRouter API** with the waypoint chain below, profile `trekking`:

```
https://brouter.de/brouter?lonlats=LON1,LAT1|LON2,LAT2|...&profile=trekking&alternativeidx=0&format=geojson
```

The response GeoJSON coordinates include altitude. From it compute and save per stage:
- `src/data/stage{N}.geojson` — the route line
- `src/data/stage{N}.stats.json` — `{ distanceKm, ascentM, profile: [{km, ele}] }` where `profile` is downsampled to ~200 points, and `ascentM` is cumulative positive elevation gain (smooth with a 5-point moving average before summing, otherwise towpath noise inflates it)
- `src/data/pois.json` — the POI table from §5 (verify/refine each POI's coordinates via Nominatim; the values below are good approximations)

**Fallback (mandatory):** if BRouter or Nominatim are unreachable during your run, generate plausible hand-authored GeoJSON instead — smooth polylines through the waypoints with gentle curvature following the general road network shape (never straight point-to-point segments), and estimate stats using the targets in §4. Check the fallback files into the repo either way so the site never breaks. Note in the README which mode was used.

---

## 4. The three stages (I've designed these — follow them)

All loops start and end at Les Brins, Louzouer. Waypoints are ordered; approximate coordinates given as (lat, lon).

### Étape 1 — «Les Sept Écluses» — vendredi 28 août — target ~95 km, ~550 m D+
The southern classic: down the Loing valley to the Canal de Briare, the staircase locks of Rogny, and the Pont-Canal de Briare — the most famous canal aqueduct in France.

Waypoints:
1. Louzouer / Les Brins (48.055, 2.905)
2. Château-Renard (47.933, 2.928) — via D37/D137 small roads
3. Montbouy (47.868, 2.827) — join the Canal de Briare towpath (Scandibérique / EV3)
4. Rogny-les-Sept-Écluses (47.744, 2.884)
5. Briare, Pont-Canal (47.635, 2.742) — turnaround & café stop
6. Ouzouer-sur-Trézée (47.673, 2.808)
7. Châtillon-Coligny (47.823, 2.845)
8. Sainte-Geneviève-des-Bois (47.868, 2.869)
9. back to Louzouer

### Étape 2 — «La Royale du Gâtinais» — samedi 29 août — target ~100 km, ~500 m D+ (étape reine)
The queen stage, west: the abbey of Ferrières, the Forêt de Montargis, the "Venise du Gâtinais," then the Canal d'Orléans towpath to Bellegarde and its château, returning through open Gâtinais farmland.

Waypoints:
1. Louzouer / Les Brins
2. Ferrières-en-Gâtinais (48.088, 2.789) — Carolingian abbey
3. Paucourt (48.037, 2.782) — through the Forêt de Montargis
4. Montargis centre (47.997, 2.732) — canals & footbridges
5. Canal d'Orléans towpath west to Chailly-en-Gâtinais (~47.95, 2.60)
6. Bellegarde (47.987, 2.443) — château & roseraies; turnaround
7. Beauchamps-sur-Huillard → back east along/near the canal
8. Amilly (47.973, 2.771) → Conflans-sur-Loing (47.938, 2.796)
9. Montcresson (47.905, 2.808) → Saint-Firmin-des-Bois (47.955, 2.900)
10. back to Louzouer

### Étape 3 — «La Bosse de l'Ouanne» — dimanche 30 août — target ~80 km, ~650 m D+
The eastern finale: shorter but the hilliest, rolling along the Ouanne valley to the edge of the Puisaye, finishing through Courtenay. The "climbs" are Loiret-sized, which the copy should treat with Alpe-d'Huez gravity.

Waypoints:
1. Louzouer / Les Brins
2. Saint-Germain-des-Prés (47.955, 2.848)
3. Château-Renard (47.933, 2.928) — medieval keep above the Ouanne
4. Triguères (47.938, 2.986)
5. Douchy (47.947, 3.062)
6. Charny-Orée-de-Puisaye (47.887, 3.093) — southern turnaround, Yonne border
7. north via Grandchamp/Prunoy back roads
8. Courtenay (48.039, 3.058) — market town
9. Chuelles (48.001, 2.978)
10. back to Louzouer

If a fetched route lands outside 78–105 km, adjust the waypoint chain minimally (add/remove an intermediate village) and re-fetch until in range.

---

## 5. Points of interest (POI cards along each route)

Show 4–5 per stage. Each POI: name, one-line deadpan-official description, and a category chip (`Patrimoine`, `Ravitaillement`, `Difficulté`, `Point de vue`).

| Stage | POI | Coord (approx) | Suggested copy (adapt freely, keep the register) |
|---|---|---|---|
| 1 | Donjon de Château-Renard | 47.933, 2.928 | «Contrôle signature au pied du donjon. Les commissaires seront intraitables.» |
| 1 | Amphithéâtre gallo-romain de Montbouy | 47.868, 2.827 | «2 000 ans de spectateurs. Aucun n'a vu passer un peloton aussi rapide.» |
| 1 | Les Sept Écluses de Rogny | 47.744, 2.884 | «Escalier d'eau du XVIIᵉ siècle. Classé. Comme vous, bientôt.» |
| 1 | Pont-Canal de Briare | 47.635, 2.742 | «662 mètres au-dessus de la Loire. Ravitaillement café autorisé.» |
| 1 | Châtillon-Coligny | 47.823, 2.845 | «Village étape. Boulangerie stratégique.» |
| 2 | Abbaye de Ferrières-en-Gâtinais | 48.088, 2.789 | «Fondée au VIIᵉ siècle. Bénédiction du peloton non garantie.» |
| 2 | Forêt de Montargis | 48.037, 2.782 | «4 000 hectares d'ombre. Secteur pavé de feuilles.» |
| 2 | Montargis, la Venise du Gâtinais | 47.997, 2.732 | «131 ponts et passerelles. Interdiction formelle de tomber dans le canal.» |
| 2 | Canal d'Orléans | 47.95, 2.60 | «Chemin de halage. Vent de face contractuel.» |
| 2 | Château de Bellegarde | 47.987, 2.443 | «Demi-tour officiel devant les douves. Photo protocolaire.» |
| 3 | Vallée de l'Ouanne | 47.94, 2.99 | «Succession de bosses. Le règlement parle de "moyenne montagne".» |
| 3 | Charny-Orée-de-Puisaye | 47.887, 3.093 | «Point le plus oriental de l'épreuve. Frontière de l'Yonne. Passeport non requis.» |
| 3 | Côte de Prunoy | ~47.95, 3.07 | «Difficulté classée hors catégorie (par nous).» |
| 3 | Halles de Courtenay | 48.039, 3.058 | «Dernier ravitaillement avant l'arrivée. Sprint intermédiaire au panneau d'entrée.» |

---

## 6. Page structure & scroll choreography

The map is a **fixed, full-viewport background** for the entire page. Content scrolls over it in a right-aligned (desktop) / bottom-sheet (mobile) column of cards. Scrollama steps drive the map camera and route drawing.

### Section 0 — Hero
- Full-screen. Map idles on a slow, subtle drift centered on Louzouer, zoomed to show the whole Gâtinais.
- Logo (see §8) top center, then huge display type: **TOUR DU LOIRET**, eyebrow «28 · 29 · 30 AOÛT 2026 — GRAND DÉPART : LOUZOUER», tagline «L'épreuve reine du Gâtinais».
- A thin official-looking strip: «Épreuve non homologuée · 3 étapes · 1 seul vainqueur : l'amitié (et Bastien, probablement)» — replace the name joke with «l'amitié» alone if it reads better; keep it dry.
- Scroll cue: «Faites défiler pour reconnaître le parcours».

### Section 1 — Vue d'ensemble («Le Parcours»)
- Camera flies to a bbox fitting all three loops. All three routes visible at once, each in its stage color, with the house marked by a custom start/finish marker (checkered-flag-meets-north-arrow).
- A stat strip animates in with count-up numbers: **~275 km · ~1 700 m D+ · 3 étapes · 0 route nationale**. (Use the real computed totals.)
- Three small stage cards (name, date, km, D+, one-line character). Clicking one smooth-scrolls to that stage's section.

### Sections 2–4 — One per stage (the core experience)
Each stage section is a sequence of 4–6 scroll steps:
1. **Stage title card** — camera flies to the stage bbox; the other two routes fade to 15% opacity; this stage's route shows as a faint "ghost" line.
2. **Progressive draw** — as the user scrolls through the stage's steps, the route draws itself from start to finish using `lineSliceAlong` proportional to scroll progress within the section. A rider dot leads the drawn line. Two **live counters** pinned in the stage card tick up in sync: `km` and `m D+` (interpolate D+ from the cumulative profile, not linearly). Use a monospace/tabular-lining face so digits don't jitter.
3. **POI beats** — each POI from §5 gets a step: the camera eases toward it, a marker pulses in, and its card slides up. The route continues drawing beneath.
4. **Stage summary step** — full route drawn; the **elevation profile** (D3 area chart, ~120 px tall) reveals with a left-to-right wipe; final stats lock in. A small «Profil de l'étape» label, plus the stage's difficulty rating rendered as 1–3 croissants instead of stars.

Respect `prefers-reduced-motion`: no camera easing (jump cuts), route appears fully drawn, counters render final values.

### Section 5 — Le Programme
Simple three-column (stacked on mobile) schedule, styled like an official race communiqué: 8h30 départ fictif… 8h47 départ réel après le deuxième café… 13h00 arrivée… 13h30 «Repos du Coureur (obligatoire)» — piscine, sieste, pétanque, apéro de récupération.

### Section 6 — Inscription (the joke)
Three pricing-style cards. **They are word-for-word the same offer, worded differently.** All: `0 €`, «+ une bouteille pour la cave du directeur de course».

1. **Formule Cyclotouriste** — «3 étapes, hébergement au village départ, ravitaillement complet, assistance morale.»
2. **Formule Grimpeur Confirmé** — «Les 3 mêmes étapes, le même hébergement, le même ravitaillement, la même assistance morale.»
3. **Formule Légende du Gâtinais** — «Strictement identique aux deux précédentes, mais vous pourrez le raconter différemment.»

Selecting one triggers a short confetti burst and a confirmation panel: «Inscription transmise à la Commission Sportive de Louzouer. Délai de traitement : immédiat. Vous êtes engagé·e.» Then a `mailto:` button «Confirmer auprès du Directeur de Course» with prefilled subject «Engagement Tour du Loiret 2026 — Formule [X]». No backend; persist the chosen tier in a JS variable only.

### Section 7 — Partenaires Officiels
A sponsor wall, greyscale wordmarks that take color on hover, each with a one-line partnership title. **All sponsors are invented** (do not use real Montargis businesses or brands). Render each as a small inline SVG wordmark with its own typographic personality:

- **Pralines Beaugendre** — «Fournisseur officiel de glucides depuis 1873»
- **Safran du Gâtinais Père Robillard** — «L'épice officielle du peloton»
- **Garage Marcel — Louzouer** — «Assistance neutre (tracteur)»
- **Optique de la Cloche** — «Partenaire officiel de la ligne d'arrivée : voyez-la avant les autres»
- **Bar-Tabac de l'Écluse** — «Village départ & zone technique»
- **Miel & Cie du Gâtinais** — «Nutrition sportive artisanale»
- **Piscine Municipale (bassin privé de 591 Les Brins)** — «Centre officiel de récupération»

### Footer
Official small print, dead serious: «Épreuve non homologuée FFC. Ouvert sur invitation uniquement. Le port du casque est obligatoire, le port du maillot à pois est mérité. Tout abandon devra être justifié devant la Commission. © Tour du Loiret 2026 — Louzouer, Loiret.»

---

## 7. Design direction

**Vibe:** sleek, modern, official. A grand-tour identity executed with village-fête sincerity. The map is the atmosphere; the UI floats over it with restraint.

- **Palette (dark, canal-at-dusk):**
  - `--ink: #101816` (near-black green, page/card base)
  - `--canal: #1E4D43` (deep canal green, surfaces)
  - `--chalk: #F2EFE6` (off-white, text)
  - `--dossard: #E8FF3C` (race-bib chartreuse — the accent; stage 1 route color variants below)
  - Stage route colors: Étape 1 `#E8FF3C`, Étape 2 `#FF7A45` (poppy orange), Étape 3 `#6FD1FF` (sky blue). Bold, distinguishable on the map at low zoom.
- **Typography:** display in **"Bricolage Grotesque"** (Google Fonts) set tight and heavy for the event title and stage names; body in **"Instrument Sans"**; stats/counters in **"Spline Sans Mono"** with tabular numerals. Load via Fontsource or Google Fonts `<link>`.
- **Signature element:** the progressive route draw with the synced km/D+ odometer — invest polish there (easing, the rider dot, the counter typography). Everything else stays quiet.
- **Cards:** translucent `--ink` at ~78% with `backdrop-filter: blur(12px)`, 1px `--chalk`/12% border, generous radius (~14px). Eyebrow labels in letterspaced small caps («ÉTAPE 02 — SAMEDI 29 AOÛT»).
- Dim the basemap slightly (a fixed overlay at ~25% `--ink`) so routes and type pop.
- Quality floor: fully responsive to 375 px, visible keyboard focus, reduced-motion support, `lang="fr"`, semantic landmarks, all text real HTML (selectable).

---

## 8. Logo

Generate an original SVG (inline + `public/logo.svg`):
- **Circular badge.** Outer ring carries «TOUR DU LOIRET» arced on top and «GRAND DÉPART LOUZOUER · MMXXVI» arced on the bottom, letterspaced.
- **Center:** a bicycle wheel whose spokes form a **compass rose**, with the north spoke elongated into a north arrow. Behind it, two crossed wheat stalks (the Gâtinais) and a subtle horizontal wavy line (the canal) crossing the lower third.
- Two colorways: chalk-on-transparent (for the dark site) and ink-on-chalk. Favicon derived from the wheel-compass alone.
- Keep it flat, 2-color max per colorway, confident line weights. No gradients.

---

## 9. Project structure & delivery

```
tour-du-loiret/
├── index.html
├── src/
│   ├── main.ts          # scrollama wiring, map controller, counters
│   ├── map.ts           # MapLibre setup, layers, camera choreography
│   ├── profile.ts       # D3 elevation profiles
│   ├── data/            # stage geojson + stats + pois.json
│   └── styles/main.css
├── scripts/fetch-routes.mjs
├── public/logo.svg, favicon
└── README.md            # how to refresh routes, deploy notes, data mode used
```

### Acceptance criteria (verify before finishing)
1. `npm run dev` and `npm run build` succeed; `dist/` is static-host ready.
2. Each stage's computed distance is 78–105 km; D+ is plausible (300–800 m); zero segments on autoroutes/nationales (trekking profile guarantees this — sanity-check visually).
3. Scrolling a stage section draws its route progressively with synced km/D+ counters; every POI step moves the camera and reveals its card.
4. All three registration cards are functionally and substantively identical; picking one produces the confirmation + mailto.
5. All copy is French, official register, no English strings in the UI.
6. Reduced motion honored; page usable at 375 px; map failure degrades gracefully (routes on plain background).
7. Logo renders in header, hero, and favicon.
8. Take screenshots (hero, one mid-stage step, inscription) if your environment supports it, and self-critique against §7 before finalizing.
