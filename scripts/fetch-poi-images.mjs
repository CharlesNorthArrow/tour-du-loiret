/**
 * Récupère une photo par point d'intérêt depuis Wikipédia (fr) — image
 * principale de l'article via l'API REST « summary ». Écrit :
 *   public/poi/{id}.jpg          (~800 px de large)
 *   src/data/poi-images.json     ({ id: "poi/{id}.jpg" | null })
 *
 * Les photos proviennent de Wikimédia Commons (crédit global dans le footer
 * et le README).
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'poi');
const UA = 'tour-du-loiret-build/1.0 (event microsite; contact: charles@north-arrow.org)';

// Titres d'articles à essayer dans l'ordre pour chaque POI.
const POI_TITLES = {
  'donjon-chateau-renard': ['Château-Renard'],
  'amphitheatre-montbouy': ['Amphithéâtre de Montbouy', 'Montbouy'],
  'canal-briare': ['Canal de Briare'],
  'sept-ecluses-rogny': ['Sept écluses de Rogny', 'Rogny-les-Sept-Écluses'],
  'chatillon-coligny': ['Châtillon-Coligny'],
  'abbaye-ferrieres': ['Abbaye Saint-Pierre-et-Saint-Paul de Ferrières-en-Gâtinais', 'Ferrières-en-Gâtinais'],
  'foret-montargis': ['Forêt de Montargis', 'Paucourt'],
  'venise-gatinais': ['Montargis'],
  'canal-orleans': ["Canal d'Orléans"],
  'chateau-bellegarde': ['Château de Bellegarde (Loiret)', 'Bellegarde (Loiret)'],
  'vallee-ouanne': ['Ouanne (rivière)', 'Triguères'],
  'charny-oree': ['Charny-Orée-de-Puisaye', 'Charny (Yonne)'],
  'cote-prunoy': ['Prunoy'],
  'halles-courtenay': ['Courtenay (Loiret)'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getSummary(title) {
  const url = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  return res.json();
}

/** Candidats par ordre de préférence — le redimensionneur de Commons renvoie
    un 400 si on demande une vignette plus large que l'original. */
function pickImageUrls(summary) {
  if (!summary) return [];
  const orig = summary.originalimage;
  const thumb = summary.thumbnail;
  const urls = [];
  if (thumb?.source && orig?.width && orig.width > 940) {
    urls.push(thumb.source.replace(/\/(\d+)px-/, '/900px-'));
  }
  if (orig?.source) urls.push(orig.source);
  if (thumb?.source) urls.push(thumb.source);
  return urls;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4000) throw new Error('image trop petite, probablement une erreur');
  await writeFile(dest, buf);
  return buf.length;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest = {};
  for (const [id, titles] of Object.entries(POI_TITLES)) {
    manifest[id] = null;
    for (const title of titles) {
      const summary = await getSummary(title);
      const urls = pickImageUrls(summary);
      for (const url of urls) {
        try {
          const file = `${id}.jpg`; // l'extension importe peu : les navigateurs sniffent le type
          const size = await download(url, path.join(OUT_DIR, file));
          manifest[id] = `poi/${file}`;
          console.log(`${id}: « ${title} » → ${file} (${Math.round(size / 1024)} ko)`);
          break;
        } catch (e) {
          console.warn(`${id}: « ${title} » ${url.slice(-60)} — ${e.message}`);
        }
        await sleep(300);
      }
      if (manifest[id]) break;
      await sleep(300);
    }
    if (!manifest[id]) console.warn(`${id}: AUCUNE image trouvée`);
    await sleep(300);
  }
  await writeFile(path.join(ROOT, 'src', 'data', 'poi-images.json'), JSON.stringify(manifest, null, 2));
  console.log('\nmanifest écrit → src/data/poi-images.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
