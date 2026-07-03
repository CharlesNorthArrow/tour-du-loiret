/**
 * Tour du Loiret — route data pipeline.
 *
 * For each stage: geocode fuzzy waypoints (Nominatim), fetch the loop from the
 * public BRouter API (profile `trekking`), then compute distance, smoothed
 * cumulative ascent and a ~200-point elevation profile.
 *
 * Outputs:
 *   src/data/stage{N}.geojson
 *   src/data/stage{N}.stats.json
 *   src/data/pois.json
 *   src/data/meta.json        ({ base, mode })
 *
 * If BRouter/Nominatim are unreachable, falls back to hand-authored smooth
 * splines through the waypoints (mode: "fallback" in meta.json).
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const UA = 'tour-du-loiret-build/1.0 (event microsite data script)';

const BASE_APPROX = { name: 'Les Brins, Louzouer', lat: 48.055, lon: 2.905 };

// ---------------------------------------------------------------------------
// Stage definitions (waypoints ordered; lat/lon are good approximations,
// `geocode` marks the ones worth refining via Nominatim).
// ---------------------------------------------------------------------------

// Chains adjusted after probing BRouter (spec §4 allows minimal adjustments to
// land in the 78–105 km window):
//  - Étape 1: turnaround at Rogny instead of Briare — any loop touching the
//    Pont-Canal is ≥118 km from Les Brins. Return via Dammarie-sur-Loing
//    (east bank) so the loop doesn't retrace the towpath.
//  - Étape 2: northern return via Ladon instead of the Amilly/Conflans/
//    Montcresson dip (kept the full chain at 125.7 km).
//  - Étape 3: Grandchamp dropped (the actual commune sits 11 km south of
//    Charny and inflated the loop to 108.5 km).
const STAGES = [
  {
    n: 1,
    name: 'Les Sept Écluses',
    targetKm: 90,
    targetDplus: 500,
    waypoints: [
      { name: 'Louzouer / Les Brins', lat: 48.055, lon: 2.905, base: true },
      { name: 'Château-Renard', lat: 47.933, lon: 2.928 },
      { name: 'Montbouy', lat: 47.868, lon: 2.827 },
      { name: 'Rogny-les-Sept-Écluses', lat: 47.744, lon: 2.884 },
      { name: 'Dammarie-sur-Loing', lat: 47.789, lon: 2.898 },
      { name: 'Châtillon-Coligny', lat: 47.823, lon: 2.845 },
      { name: 'Sainte-Geneviève-des-Bois, Loiret', lat: 47.868, lon: 2.869 },
      { name: 'Louzouer / Les Brins', lat: 48.055, lon: 2.905, base: true },
    ],
  },
  {
    n: 2,
    name: 'La Royale du Gâtinais',
    targetKm: 100,
    targetDplus: 500,
    waypoints: [
      { name: 'Louzouer / Les Brins', lat: 48.055, lon: 2.905, base: true },
      { name: 'Ferrières-en-Gâtinais', lat: 48.088, lon: 2.789 },
      { name: 'Paucourt', lat: 48.037, lon: 2.782 },
      { name: 'Montargis centre', lat: 47.997, lon: 2.732 },
      { name: 'Chailly-en-Gâtinais', lat: 47.95, lon: 2.6, geocode: true },
      { name: 'Bellegarde, Loiret', lat: 47.987, lon: 2.443, geocode: true },
      { name: 'Beauchamps-sur-Huillard', lat: 47.965, lon: 2.55, geocode: true },
      { name: 'Ladon', lat: 47.9903, lon: 2.5375, geocode: true },
      { name: 'Louzouer / Les Brins', lat: 48.055, lon: 2.905, base: true },
    ],
  },
  {
    n: 3,
    name: "La Bosse de l'Ouanne",
    targetKm: 85,
    targetDplus: 650,
    waypoints: [
      { name: 'Louzouer / Les Brins', lat: 48.055, lon: 2.905, base: true },
      { name: 'Saint-Germain-des-Prés, Loiret', lat: 47.955, lon: 2.848 },
      { name: 'Château-Renard', lat: 47.933, lon: 2.928 },
      { name: 'Triguères', lat: 47.938, lon: 2.986 },
      { name: 'Douchy, Loiret', lat: 47.947, lon: 3.062 },
      { name: 'Charny-Orée-de-Puisaye', lat: 47.887, lon: 3.093, geocode: true },
      { name: 'Prunoy', lat: 47.94, lon: 3.09, geocode: true },
      { name: 'Courtenay, Loiret', lat: 48.039, lon: 3.058 },
      { name: 'Chuelles', lat: 48.001, lon: 2.978 },
      { name: 'Louzouer / Les Brins', lat: 48.055, lon: 2.905, base: true },
    ],
  },
];

const POIS = [
  { stage: 1, id: 'donjon-chateau-renard', name: 'Donjon de Château-Renard', cat: 'Patrimoine', lat: 47.933, lon: 2.928, q: 'Château-Renard, Loiret', copy: 'Contrôle signature au pied du donjon. Les commissaires seront intraitables.' },
  { stage: 1, id: 'amphitheatre-montbouy', name: 'Amphithéâtre gallo-romain de Montbouy', cat: 'Patrimoine', lat: 47.868, lon: 2.827, q: 'Montbouy', copy: "2 000 ans de spectateurs. Aucun n'a vu passer un peloton aussi rapide." },
  { stage: 1, id: 'canal-briare', name: 'Canal de Briare — chemin de halage', cat: 'Patrimoine', lat: 47.845, lon: 2.838, q: null, copy: 'Ouvert en 1642, doyen des canaux de France. Le peloton est prié de rouler plus vite que l’eau.' },
  { stage: 1, id: 'sept-ecluses-rogny', name: 'Les Sept Écluses de Rogny', cat: 'Point de vue', lat: 47.744, lon: 2.884, q: 'Rogny-les-Sept-Écluses', copy: "Escalier d'eau du XVIIᵉ siècle. Demi-tour officiel au bassin, ravitaillement café autorisé. Classé. Comme vous, bientôt." },
  { stage: 1, id: 'chatillon-coligny', name: 'Châtillon-Coligny', cat: 'Ravitaillement', lat: 47.823, lon: 2.845, q: 'Châtillon-Coligny', copy: 'Village étape. Boulangerie stratégique.' },
  { stage: 2, id: 'abbaye-ferrieres', name: 'Abbaye de Ferrières-en-Gâtinais', cat: 'Patrimoine', lat: 48.088, lon: 2.789, q: 'Abbaye, Ferrières-en-Gâtinais', copy: 'Fondée au VIIᵉ siècle. Bénédiction du peloton non garantie.' },
  { stage: 2, id: 'foret-montargis', name: 'Forêt de Montargis', cat: 'Difficulté', lat: 48.037, lon: 2.782, q: 'Paucourt', copy: "4 000 hectares d'ombre. Secteur pavé de feuilles." },
  { stage: 2, id: 'venise-gatinais', name: 'Montargis, la Venise du Gâtinais', cat: 'Patrimoine', lat: 47.997, lon: 2.732, q: 'Montargis', copy: '131 ponts et passerelles. Interdiction formelle de tomber dans le canal.' },
  { stage: 2, id: 'canal-orleans', name: "Canal d'Orléans", cat: 'Difficulté', lat: 47.95, lon: 2.6, q: 'Chailly-en-Gâtinais', copy: 'Chemin de halage. Vent de face contractuel.' },
  { stage: 2, id: 'chateau-bellegarde', name: 'Château de Bellegarde', cat: 'Point de vue', lat: 47.987, lon: 2.443, q: 'Château de Bellegarde, Loiret', copy: 'Demi-tour officiel devant les douves. Photo protocolaire.' },
  { stage: 3, id: 'vallee-ouanne', name: "Vallée de l'Ouanne", cat: 'Difficulté', lat: 47.94, lon: 2.99, q: 'Triguères', copy: 'Succession de bosses. Le règlement parle de « moyenne montagne ».' },
  { stage: 3, id: 'charny-oree', name: 'Charny-Orée-de-Puisaye', cat: 'Ravitaillement', lat: 47.887, lon: 3.093, q: 'Charny-Orée-de-Puisaye', copy: "Point le plus oriental de l'épreuve. Frontière de l'Yonne. Passeport non requis." },
  { stage: 3, id: 'cote-prunoy', name: 'Côte de Prunoy', cat: 'Difficulté', lat: 47.95, lon: 3.07, q: 'Prunoy', copy: 'Difficulté classée hors catégorie (par nous).' },
  { stage: 3, id: 'halles-courtenay', name: 'Halles de Courtenay', cat: 'Ravitaillement', lat: 48.039, lon: 3.058, q: 'Courtenay, Loiret', copy: "Dernier ravitaillement avant l'arrivée. Sprint intermédiaire au panneau d'entrée." },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchJson(url, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

let nominatimDown = false;
async function geocode(query, approx) {
  if (nominatimDown) return null;
  try {
    await sleep(1100); // Nominatim usage policy: max 1 req/s
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&q=${encodeURIComponent(query)}`;
    const results = await fetchJson(url, 15000);
    if (!results.length) return null;
    const hit = { lat: +results[0].lat, lon: +results[0].lon };
    // Reject wild mismatches (wrong homonym commune elsewhere in France)
    if (approx && haversineKm([hit.lon, hit.lat], [approx.lon, approx.lat]) > 15) {
      console.warn(`  geocode "${query}" landed ${Math.round(haversineKm([hit.lon, hit.lat], [approx.lon, approx.lat]))} km from approx — keeping approx coords`);
      return null;
    }
    return hit;
  } catch (e) {
    console.warn(`  Nominatim unreachable (${e.message}) — using approximate coordinates from here on`);
    nominatimDown = true;
    return null;
  }
}

// Elevation smoothing: 5-point moving average, then cumulative positive gain.
function smoothEle(eles, win = 5) {
  const half = Math.floor(win / 2);
  return eles.map((_, i) => {
    let s = 0, c = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < eles.length) { s += eles[j]; c++; }
    }
    return s / c;
  });
}

function computeStats(coords) {
  // coords: [lon, lat, ele]
  const kms = [0];
  for (let i = 1; i < coords.length; i++) {
    kms.push(kms[i - 1] + haversineKm(coords[i - 1], coords[i]));
  }
  const distanceKm = kms[kms.length - 1];
  const smooth = smoothEle(coords.map((c) => c[2] ?? 100));
  let ascentM = 0;
  for (let i = 1; i < smooth.length; i++) {
    const d = smooth[i] - smooth[i - 1];
    if (d > 0) ascentM += d;
  }
  // Downsample to ~200 evenly spaced points by distance.
  const N = 200;
  const profile = [];
  let idx = 0;
  for (let p = 0; p < N; p++) {
    const targetKm = (distanceKm * p) / (N - 1);
    while (idx < kms.length - 2 && kms[idx + 1] < targetKm) idx++;
    const span = kms[idx + 1] - kms[idx] || 1e-9;
    const t = Math.min(1, Math.max(0, (targetKm - kms[idx]) / span));
    const ele = smooth[idx] + t * (smooth[idx + 1] - smooth[idx]);
    profile.push({ km: +targetKm.toFixed(2), ele: +ele.toFixed(1) });
  }
  return { distanceKm: +distanceKm.toFixed(1), ascentM: Math.round(ascentM), profile };
}

async function fetchBrouter(waypoints) {
  const lonlats = waypoints.map((w) => `${w.lon.toFixed(5)},${w.lat.toFixed(5)}`).join('|');
  const url = `https://brouter.de/brouter?lonlats=${lonlats}&profile=trekking&alternativeidx=0&format=geojson`;
  const gj = await fetchJson(url, 120000);
  const feature = gj.features?.[0];
  if (!feature?.geometry?.coordinates?.length) throw new Error('BRouter returned no geometry');
  return feature;
}

// ---------------------------------------------------------------------------
// Fallback: smooth Catmull-Rom spline through waypoints with gentle wander,
// so the fallback lines still read as roads rather than ruler segments.
// ---------------------------------------------------------------------------

function fallbackRoute(stage) {
  const pts = stage.waypoints.map((w) => [w.lon, w.lat]);
  // Insert a deterministic gentle offset point between each waypoint pair.
  const enriched = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1e-9;
    // Perpendicular wobble, alternating side, ~8% of segment length.
    const side = i % 2 === 0 ? 1 : -1;
    enriched.push([mx + (-dy / len) * len * 0.08 * side, my + (dx / len) * len * 0.08 * side]);
    enriched.push([x2, y2]);
  }
  // Catmull-Rom through enriched points.
  const out = [];
  const P = enriched;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const steps = 14;
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(P[P.length - 1]);
  // Synthetic but plausible rolling elevation (Gâtinais sits ~90–200 m).
  let km = 0;
  const coords = out.map((c, i) => {
    if (i > 0) km += haversineKm(out[i - 1], c);
    const ele = 130 + 35 * Math.sin(km / 6) + 20 * Math.sin(km / 2.1 + stage.n) + 10 * Math.sin(km / 0.9 + i);
    return [c[0], c[1], +ele.toFixed(1)];
  });
  // Scale synthetic stats toward the stage targets.
  const stats = computeStats(coords);
  stats.distanceKm = stage.targetKm;
  stats.ascentM = stage.targetDplus;
  const scale = stage.targetKm / (stats.profile[stats.profile.length - 1].km || 1);
  stats.profile = stats.profile.map((p) => ({ km: +(p.km * scale).toFixed(2), ele: p.ele }));
  return { feature: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }, stats };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // 1. Refine the base camp coordinates.
  let base = { lat: BASE_APPROX.lat, lon: BASE_APPROX.lon };
  console.log('Geocoding base camp "Les Brins, Louzouer"…');
  const baseHit = await geocode('Les Brins, Louzouer', BASE_APPROX);
  if (baseHit) {
    base = baseHit;
    console.log(`  → ${base.lat.toFixed(5)}, ${base.lon.toFixed(5)}`);
  } else {
    console.log('  → keeping approximate 48.055, 2.905');
  }

  // 2. Refine flagged waypoints.
  for (const stage of STAGES) {
    for (const w of stage.waypoints) {
      if (w.base) { w.lat = base.lat; w.lon = base.lon; continue; }
      if (!w.geocode) continue;
      const hit = await geocode(w.name, w);
      if (hit) {
        console.log(`  ${w.name}: ${w.lat},${w.lon} → ${hit.lat.toFixed(4)},${hit.lon.toFixed(4)}`);
        w.lat = hit.lat; w.lon = hit.lon;
      }
    }
  }

  // 3. Refine POI coordinates.
  for (const poi of POIS) {
    if (!poi.q) continue;
    const hit = await geocode(poi.q, poi);
    if (hit) { poi.lat = +hit.lat.toFixed(5); poi.lon = +hit.lon.toFixed(5); }
  }

  // 4. Fetch each stage from BRouter (fallback to synthetic splines).
  let mode = 'brouter';
  for (const stage of STAGES) {
    console.log(`\nÉtape ${stage.n} — ${stage.name}`);
    let feature, stats;
    try {
      feature = await fetchBrouter(stage.waypoints);
      stats = computeStats(feature.geometry.coordinates);
      const brDist = feature.properties?.['track-length'] ? +feature.properties['track-length'] / 1000 : null;
      const brAscend = feature.properties?.['filtered ascend'] ? +feature.properties['filtered ascend'] : null;
      console.log(`  BRouter: ${stats.distanceKm} km (brouter says ${brDist?.toFixed(1) ?? '?'} km), D+ ${stats.ascentM} m (brouter filtered ${brAscend ?? '?'} m)`);
      if (stats.distanceKm < 78 || stats.distanceKm > 105) {
        console.warn(`  ⚠ distance ${stats.distanceKm} km outside 78–105 km — waypoints need adjusting`);
      }
    } catch (e) {
      console.warn(`  BRouter failed (${e.message}) — generating fallback route`);
      mode = 'fallback';
      ({ feature, stats } = fallbackRoute(stage));
    }
    const out = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { stage: stage.n, name: stage.name },
        geometry: feature.geometry,
      }],
    };
    await writeFile(path.join(OUT_DIR, `stage${stage.n}.geojson`), JSON.stringify(out));
    await writeFile(path.join(OUT_DIR, `stage${stage.n}.stats.json`), JSON.stringify(stats));
    console.log(`  wrote stage${stage.n}.geojson (${out.features[0].geometry.coordinates.length} pts) + stats`);
  }

  // 5. POIs + meta.
  await writeFile(path.join(OUT_DIR, 'pois.json'), JSON.stringify(POIS.map(({ q, ...p }) => p), null, 2));
  await writeFile(path.join(OUT_DIR, 'meta.json'), JSON.stringify({ base, mode }, null, 2));
  console.log(`\nDone. Data mode: ${mode}. Base: ${base.lat}, ${base.lon}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
