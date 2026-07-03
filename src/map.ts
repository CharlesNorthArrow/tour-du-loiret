import maplibregl from 'maplibre-gl';
import type { LngLatBoundsLike, PaddingOptions, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import bbox from '@turf/bbox';
import length from '@turf/length';
import lineSliceAlong from '@turf/line-slice-along';
import type { Feature, LineString } from 'geojson';

export interface StageStats {
  distanceKm: number;
  ascentM: number;
  profile: { km: number; ele: number }[];
}

export interface Poi {
  stage: number;
  id: string;
  name: string;
  cat: string;
  lat: number;
  lon: number;
  copy: string;
}

export interface StageBundle {
  n: number;
  name: string;
  color: string;
  line: Feature<LineString>;
  stats: StageStats;
  bbox: [number, number, number, number];
  lengthKm: number;
  /** cumulative D+ sampled along the profile, rescaled to end at ascentM */
  cum: { km: number; d: number }[];
}

const LIBERTY_URL = 'https://tiles.openfreemap.org/styles/liberty';

const RASTER_FALLBACK: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['a', 'b', 'c'].map((s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`),
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0f2138' } },
    { id: 'carto', type: 'raster', source: 'carto' },
  ],
};

const PLAIN_FALLBACK: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#152c47' } }],
};

async function resolveStyle(): Promise<StyleSpecification> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(LIBERTY_URL, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`style HTTP ${res.status}`);
    return (await res.json()) as StyleSpecification;
  } catch {
    console.warn('[carte] style liberty inaccessible — bascule sur le fond raster de secours');
    return RASTER_FALLBACK;
  } finally {
    clearTimeout(t);
  }
}

export function buildBundle(n: number, name: string, color: string, geojson: GeoJSON.FeatureCollection, stats: StageStats): StageBundle {
  const line = geojson.features[0] as Feature<LineString>;
  const lengthKm = length(line, { units: 'kilometers' });
  // Cumulative climb along the (already smoothed) profile, rescaled so the
  // odometer lands exactly on the published D+ at the finish line.
  const cum: { km: number; d: number }[] = [];
  let d = 0;
  for (let i = 0; i < stats.profile.length; i++) {
    if (i > 0) d += Math.max(0, stats.profile[i].ele - stats.profile[i - 1].ele);
    cum.push({ km: stats.profile[i].km, d });
  }
  const total = cum[cum.length - 1].d || 1;
  for (const c of cum) c.d = (c.d / total) * stats.ascentM;
  return { n, name, color, line, stats, bbox: bbox(line) as [number, number, number, number], lengthKm, cum };
}

export function dplusAt(bundle: StageBundle, km: number): number {
  const cum = bundle.cum;
  if (km <= 0) return 0;
  if (km >= cum[cum.length - 1].km) return bundle.stats.ascentM;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid].km <= km) lo = mid; else hi = mid;
  }
  const span = cum[hi].km - cum[lo].km || 1e-9;
  return cum[lo].d + ((km - cum[lo].km) / span) * (cum[hi].d - cum[lo].d);
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export class RaceMap {
  readonly map: maplibregl.Map;
  private stages: StageBundle[];
  private base: [number, number];
  private reduced: boolean;
  private poiMarkers = new Map<string, maplibregl.Marker>();
  private startMarkerEl: HTMLElement | null = null;
  private driftTimer: number | undefined;
  private lastSlice = new Map<number, number>();

  constructor(container: HTMLElement, style: StyleSpecification, stages: StageBundle[], base: [number, number], pois: Poi[], reduced: boolean) {
    this.stages = stages;
    this.base = base;
    this.reduced = reduced;
    this.map = new maplibregl.Map({
      container,
      style,
      center: base,
      zoom: 9,
      interactive: false,
      attributionControl: { compact: true },
      fadeDuration: reduced ? 0 : 300,
    });
    this.map.on('error', (e) => console.warn('[carte]', e.error?.message ?? e));
    this.map.on('style.load', () => this.addLayers());
    this.addStartMarker();
    this.addPoiMarkers(pois);
  }

  static async create(container: HTMLElement, stages: StageBundle[], base: [number, number], pois: Poi[], reduced: boolean): Promise<RaceMap> {
    const style = await resolveStyle();
    const rm = new RaceMap(container, style, stages, base, pois, reduced);
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__tdl = rm;
    // Ne pas attendre le chargement complet des tuiles (l'événement `load`
    // peut mettre >20 s à froid) : les couches routes sont posées dès
    // `style.load`, la carte de fond continue de se remplir derrière.
    await new Promise<void>((resolve) => {
      if (rm.map.getLayer('rider')) return resolve();
      const done = () => { clearTimeout(timer); resolve(); };
      // Le constructeur a enregistré addLayers() sur style.load avant nous :
      // quand ce listener-ci s'exécute, les couches existent déjà.
      rm.map.once('style.load', done);
      const timer = setTimeout(() => {
        rm.map.off('style.load', done);
        console.warn('[carte] style injoignable — routes sur fond neutre');
        try { rm.map.setStyle(PLAIN_FALLBACK); } catch { /* ignore */ }
        rm.map.once('style.load', () => resolve());
        setTimeout(resolve, 2000);
      }, 12000);
    });
    return rm;
  }

  private addLayers() {
    const m = this.map;
    // Dusk veil between the basemap and the routes: dims the (light) liberty
    // style without muting the stage colors drawn above it.
    if (!m.getLayer('dusk-dim')) {
      m.addLayer({
        id: 'dusk-dim',
        type: 'background',
        paint: { 'background-color': '#0f2138', 'background-opacity': 0.55 },
      });
    }
    for (const s of this.stages) {
      const full: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [s.line] };
      if (!m.getSource(`s${s.n}-full`)) m.addSource(`s${s.n}-full`, { type: 'geojson', data: full });
      if (!m.getSource(`s${s.n}-progress`)) m.addSource(`s${s.n}-progress`, { type: 'geojson', data: EMPTY });

      m.addLayer({
        id: `s${s.n}-ghost`, type: 'line', source: `s${s.n}-full`,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': s.color, 'line-width': 3, 'line-opacity': 0 },
      });
      m.addLayer({
        id: `s${s.n}-glow`, type: 'line', source: `s${s.n}-progress`,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': s.color, 'line-width': 13, 'line-blur': 8, 'line-opacity': 0 },
      });
      m.addLayer({
        id: `s${s.n}-line`, type: 'line', source: `s${s.n}-progress`,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': s.color, 'line-width': 4.5, 'line-opacity': 0 },
      });
      for (const id of [`s${s.n}-ghost`, `s${s.n}-glow`, `s${s.n}-line`]) {
        m.setPaintProperty(id, 'line-opacity-transition', { duration: this.reduced ? 0 : 550 });
      }
    }
    if (!m.getSource('rider')) m.addSource('rider', { type: 'geojson', data: EMPTY });
    m.addLayer({
      id: 'rider', type: 'circle', source: 'rider',
      paint: {
        'circle-radius': 7,
        'circle-color': '#f1e7d0',
        'circle-stroke-width': 3,
        'circle-stroke-color': ['coalesce', ['get', 'color'], '#e4a93d'] as unknown as string,
      },
    });
  }

  private addStartMarker() {
    const el = document.createElement('div');
    el.className = 'marker-depart';
    el.title = 'Grand Départ & Arrivée — Les Brins, Louzouer';
    el.innerHTML = `
      <svg viewBox="0 0 46 46" width="46" height="46" role="img" aria-label="Départ et arrivée">
        <circle cx="23" cy="23" r="21" fill="#0f2138" stroke="#f1e7d0" stroke-width="2"/>
        <g fill="#f1e7d0">
          <rect x="14" y="14" width="4.5" height="4.5"/><rect x="23" y="14" width="4.5" height="4.5"/>
          <rect x="18.5" y="18.5" width="4.5" height="4.5"/><rect x="27.5" y="18.5" width="4.5" height="4.5"/>
          <rect x="14" y="23" width="4.5" height="4.5"/><rect x="23" y="23" width="4.5" height="4.5"/>
        </g>
        <path d="M23 6 L26.5 14.5 L23 12.5 L19.5 14.5 Z" fill="#e4a93d"/>
      </svg>`;
    new maplibregl.Marker({ element: el }).setLngLat(this.base).addTo(this.map);
    el.style.transition = 'opacity 0.6s ease';
    this.startMarkerEl = el;
  }

  private addPoiMarkers(pois: Poi[]) {
    const colors: Record<number, string> = {};
    for (const s of this.stages) colors[s.n] = s.color;
    for (const p of pois) {
      const el = document.createElement('div');
      el.className = 'marker-poi';
      el.style.setProperty('--poi-color', colors[p.stage] ?? '#e4a93d');
      const mk = new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(this.map);
      this.poiMarkers.set(p.id, mk);
    }
  }

  showPoi(id: string) { this.poiMarkers.get(id)?.getElement().classList.add('on'); }
  hidePoi(id: string) { this.poiMarkers.get(id)?.getElement().classList.remove('on'); }
  hideAllPois() { for (const mk of this.poiMarkers.values()) mk.getElement().classList.remove('on'); }

  // ── Camera ──────────────────────────────────────────────────────────

  private pad(kind: 'column' | 'panel' | 'even'): PaddingOptions {
    const w = window.innerWidth, h = window.innerHeight;
    if (w <= 960) {
      // Cards read as a bottom sheet on mobile — keep the route above them.
      return { top: 90, left: 28, right: 28, bottom: kind === 'even' ? 90 : Math.round(h * 0.44) };
    }
    if (kind === 'column') return { top: 100, bottom: 70, left: 80, right: 100 + 460 };
    if (kind === 'panel') return { top: 96, bottom: Math.min(Math.round(h * 0.48), 380), left: 90, right: 90 };
    return { top: 110, bottom: 110, left: 110, right: 110 };
  }

  private get dur() { return this.reduced ? 0 : 1; }

  allBounds(): LngLatBoundsLike {
    let [w, s, e, n] = this.stages[0].bbox;
    for (const st of this.stages) {
      w = Math.min(w, st.bbox[0]); s = Math.min(s, st.bbox[1]);
      e = Math.max(e, st.bbox[2]); n = Math.max(n, st.bbox[3]);
    }
    return [[w, s], [e, n]];
  }

  /** fitBounds sans padding persistant : la caméra est calculée puis animée
      « nue », sinon le padding s'accumule d'un mouvement à l'autre. */
  private flyToBounds(bounds: LngLatBoundsLike, kind: 'column' | 'panel' | 'even', duration: number) {
    this.map.stop();
    const cam = this.map.cameraForBounds(bounds, { padding: this.pad(kind), bearing: 0 });
    if (!cam) return;
    this.map.easeTo({
      center: cam.center,
      zoom: cam.zoom,
      bearing: 0,
      duration: duration * this.dur,
      essential: true,
    });
  }

  heroCamera() {
    this.flyToBounds(this.allBounds(), 'even', 1600);
    if (!this.reduced) this.startDrift();
  }

  private startDrift() {
    this.stopDrift();
    let sign = 1;
    const drift = () => {
      this.map.easeTo({
        center: this.base,
        bearing: 4 * sign,
        zoom: this.map.getZoom() + 0.06 * sign,
        duration: 24000,
        easing: (t) => t,
        essential: false,
      });
      sign = -sign;
    };
    this.driftTimer = window.setTimeout(() => {
      drift();
      this.driftTimer = window.setInterval(drift, 24000) as unknown as number;
    }, 1700);
  }

  stopDrift() {
    if (this.driftTimer !== undefined) {
      clearTimeout(this.driftTimer);
      clearInterval(this.driftTimer);
      this.driftTimer = undefined;
    }
  }

  overviewCamera() {
    this.stopDrift();
    this.flyToBounds(this.allBounds(), 'panel', 2000);
  }

  calmCamera() {
    this.stopDrift();
    this.flyToBounds(this.allBounds(), 'even', 2200);
  }

  stageCamera(n: number) {
    this.stopDrift();
    const s = this.stages.find((x) => x.n === n)!;
    this.flyToBounds([[s.bbox[0], s.bbox[1]], [s.bbox[2], s.bbox[3]]], 'column', 1900);
  }

  poiCamera(lngLat: [number, number]) {
    this.stopDrift();
    this.map.stop();
    // Décalage transitoire (px) : le POI se cale à gauche de la colonne de
    // cartes (ou au-dessus de la « bottom sheet » mobile).
    const offset: [number, number] = window.innerWidth <= 960
      ? [0, -Math.round(window.innerHeight * 0.16)]
      : [-235, 0];
    this.map.easeTo({
      center: lngLat,
      zoom: Math.max(this.map.getZoom(), 11.6),
      offset,
      duration: 1700 * this.dur,
      essential: true,
    });
  }

  // ── Route emphasis & progressive draw ───────────────────────────────

  private setOpacity(layer: string, v: number) {
    if (this.map.getLayer(layer)) this.map.setPaintProperty(layer, 'line-opacity', v);
  }

  /** mode 'hidden' (hero) | 'all' (overview & calm) | stage number */
  emphasis(mode: 'hidden' | 'all' | number) {
    if (this.startMarkerEl) this.startMarkerEl.style.opacity = mode === 'hidden' ? '0' : '1';
    for (const s of this.stages) {
      const active = mode === s.n;
      const ghost = mode === 'hidden' ? 0 : mode === 'all' ? 0.95 : active ? 0.38 : 0.14;
      this.setOpacity(`s${s.n}-ghost`, ghost);
      this.setOpacity(`s${s.n}-line`, active ? 1 : 0);
      this.setOpacity(`s${s.n}-glow`, active ? 0.3 : 0);
    }
    if (this.map.getLayer('rider')) {
      this.map.setPaintProperty('rider', 'circle-opacity', typeof mode === 'number' ? 1 : 0);
      this.map.setPaintProperty('rider', 'circle-stroke-opacity', typeof mode === 'number' ? 1 : 0);
    }
  }

  /** Draw stage n up to `frac` of its length; returns the leading point. */
  setProgress(n: number, frac: number): { km: number } {
    const s = this.stages.find((x) => x.n === n)!;
    const km = Math.max(0, Math.min(1, frac)) * s.lengthKm;
    // Skip sub-30 m updates — invisible, and it keeps scroll cheap.
    if (Math.abs((this.lastSlice.get(n) ?? -1) - km) < 0.03) return { km };
    this.lastSlice.set(n, km);
    const src = this.map.getSource(`s${n}-progress`) as maplibregl.GeoJSONSource | undefined;
    const riderSrc = this.map.getSource('rider') as maplibregl.GeoJSONSource | undefined;
    if (!src || !riderSrc) return { km };
    if (km < 0.05) {
      src.setData(EMPTY);
      riderSrc.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { color: s.color }, geometry: { type: 'Point', coordinates: s.line.geometry.coordinates[0] } }],
      });
      return { km };
    }
    const sliced = km >= s.lengthKm - 0.05 ? s.line : lineSliceAlong(s.line, 0, km, { units: 'kilometers' });
    src.setData({ type: 'FeatureCollection', features: [sliced] });
    const coords = sliced.geometry.coordinates;
    riderSrc.setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { color: s.color }, geometry: { type: 'Point', coordinates: coords[coords.length - 1] } }],
    });
    return { km };
  }

  resize() { this.map.resize(); }
}
