import './styles/main.css';
import scrollama from 'scrollama';
import { RaceMap, buildBundle, dplusAt } from './map';
import type { Poi, StageBundle } from './map';
import { renderProfile } from './profile';
import { SPONSORS } from './sponsors';

import stage1raw from './data/stage1.geojson?raw';
import stage2raw from './data/stage2.geojson?raw';
import stage3raw from './data/stage3.geojson?raw';
import stage1stats from './data/stage1.stats.json';
import stage2stats from './data/stage2.stats.json';
import stage3stats from './data/stage3.stats.json';
import poisData from './data/pois.json';
import meta from './data/meta.json';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAIL_TO = 'charles@north-arrow.org';

// ── Données d'étapes ─────────────────────────────────────────────────────

interface StageCopy {
  n: number;
  name: string;
  dayLong: string;
  dayShort: string;
  color: string;
  croissants: number;
  lede: string;
  short: string;
}

const STAGE_COPY: StageCopy[] = [
  {
    n: 1, name: 'Les Sept Écluses', dayLong: 'Vendredi 28 août', dayShort: 'ven. 28 août',
    color: '#e8ff3c', croissants: 2,
    lede: "La classique des canaux. Par le donjon de Château-Renard et la vallée du Loing jusqu'au chemin de halage de la Scandibérique, pour un demi-tour solennel au pied de l'escalier d'eau de Rogny. Le peloton est prié d'admirer.",
    short: 'Canaux, écluses et boulangeries stratégiques.',
  },
  {
    n: 2, name: 'La Royale du Gâtinais', dayLong: 'Samedi 29 août', dayShort: 'sam. 29 août',
    color: '#ff7a45', croissants: 3,
    lede: "L'étape reine. Abbaye carolingienne, forêt domaniale, la Venise du Gâtinais, puis le canal d'Orléans jusqu'aux douves du château de Bellegarde. Retour par la plaine, vent de face garanti par l'organisation.",
    short: "Cent kilomètres. Le mot « royale » n'est pas négociable.",
  },
  {
    n: 3, name: "La Bosse de l'Ouanne", dayLong: 'Dimanche 30 août', dayShort: 'dim. 30 août',
    color: '#6fd1ff', croissants: 3,
    lede: "Le final. Court mais accidenté : la vallée de l'Ouanne enchaîne les bosses jusqu'à la frontière de l'Yonne. Le règlement parle de moyenne montagne. Le règlement a été rédigé par nous.",
    short: "Des bosses, traitées avec la gravité d'un col hors catégorie.",
  },
];

const BUNDLES: StageBundle[] = [
  buildBundle(1, STAGE_COPY[0].name, STAGE_COPY[0].color, JSON.parse(stage1raw), stage1stats),
  buildBundle(2, STAGE_COPY[1].name, STAGE_COPY[1].color, JSON.parse(stage2raw), stage2stats),
  buildBundle(3, STAGE_COPY[2].name, STAGE_COPY[2].color, JSON.parse(stage3raw), stage3stats),
];

const POIS = poisData as Poi[];
const BASE: [number, number] = [meta.base.lon, meta.base.lat];

const fmtKm = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtInt = (v: number) => Math.round(v).toLocaleString('fr-FR');
const pad2 = (n: number) => String(n).padStart(2, '0');

// Point kilométrique de chaque POI : plus proche sommet de la trace.
function poiKm(bundle: StageBundle, poi: Poi): number {
  const coords = bundle.line.geometry.coordinates;
  const cosLat = Math.cos((poi.lat * Math.PI) / 180);
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const dx = (coords[i][0] - poi.lon) * cosLat;
    const dy = coords[i][1] - poi.lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; bestI = i; }
  }
  return (bestI / (coords.length - 1)) * bundle.lengthKm;
}

const chipClass = (cat: string) =>
  'chip chip--' + cat.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

function croissantsHtml(rating: number): string {
  let out = '';
  for (let i = 0; i < 3; i++) out += `<span${i < rating ? '' : ' aria-hidden="true"'}>🥐</span>`;
  return `<span class="croissants" role="img" aria-label="Difficulté : ${rating} croissants sur 3">${out}</span>`;
}

// ── Construction du DOM des étapes ───────────────────────────────────────

function buildStageSections() {
  const host = document.getElementById('stages')!;
  for (const copy of STAGE_COPY) {
    const b = BUNDLES.find((x) => x.n === copy.n)!;
    const pois = POIS.filter((p) => p.stage === copy.n)
      .map((p) => ({ ...p, km: poiKm(b, p) }))
      .sort((a, z) => a.km - z.km);

    const section = document.createElement('section');
    section.className = 'stage';
    section.id = `etape-${copy.n}`;
    section.dataset.stage = String(copy.n);
    section.style.setProperty('--stage-color', copy.color);
    section.setAttribute('aria-label', `Étape ${copy.n} — ${copy.name}`);

    const poiSteps = pois.map((p) => `
      <div class="step step--poi" data-action="poi" data-stage="${copy.n}" data-poi="${p.id}" data-lon="${p.lon}" data-lat="${p.lat}" data-km="${p.km.toFixed(2)}">
        <article class="card card--poi">
          <span class="${chipClass(p.cat)}">${p.cat}</span>
          <h3>${p.name}</h3>
          <p>${p.copy}</p>
          <span class="poi-km num">PK ${fmtKm(p.km)}</span>
        </article>
      </div>`).join('');

    section.innerHTML = `
      <div class="stage-hud" aria-hidden="true">
        <p class="eyebrow">Étape ${pad2(copy.n)}</p>
        <div class="hud-row"><span class="num" data-hud-km>0,0</span><span class="hud-unit">km</span></div>
        <div class="hud-row"><span class="num" data-hud-dplus>0</span><span class="hud-unit">m D+</span></div>
      </div>
      <div class="scroll-col">
        <div class="step step--title" data-action="stage-title" data-stage="${copy.n}">
          <article class="card card--stage-title">
            <p class="eyebrow">Étape ${pad2(copy.n)} — ${copy.dayLong}</p>
            <h2>${copy.name}</h2>
            <p class="lede">${copy.lede}</p>
            <div class="stage-title__stats">
              <span><b class="num">${fmtKm(b.stats.distanceKm)}</b> km</span>
              <span><b class="num">${fmtInt(b.stats.ascentM)}</b> m D+</span>
              <span>départ <b class="num">8h30</b></span>
            </div>
          </article>
        </div>
        ${poiSteps}
        <div class="step step--summary" data-action="summary" data-stage="${copy.n}">
          <article class="card card--summary">
            <p class="eyebrow">Étape ${pad2(copy.n)} — Arrivée jugée aux Brins</p>
            <h3>${copy.name}</h3>
            <div class="summary-stats">
              <div><span class="num">${fmtKm(b.stats.distanceKm)}</span><small>km</small></div>
              <div><span class="num">${fmtInt(b.stats.ascentM)}</span><small>m D+</small></div>
            </div>
            <div class="profile-box" data-profile="${copy.n}">
              <p class="eyebrow">Profil de l'étape</p>
            </div>
            <div class="difficulty">${croissantsHtml(copy.croissants)} Difficulté homologuée par la Commission</div>
          </article>
        </div>
      </div>`;
    host.appendChild(section);

    renderProfile(section.querySelector('[data-profile]') as HTMLElement, b.stats, copy.color, copy.n);
  }
}

function buildStageCards() {
  const host = document.getElementById('stagecards')!;
  host.innerHTML = STAGE_COPY.map((copy) => {
    const b = BUNDLES.find((x) => x.n === copy.n)!;
    return `
      <a class="stagecard" href="#etape-${copy.n}" style="--stage-color:${copy.color}">
        <p class="eyebrow">Étape ${pad2(copy.n)} — ${copy.dayShort}</p>
        <h3>${copy.name}</h3>
        <p class="stagecard__stats">${fmtKm(b.stats.distanceKm)} km · ${fmtInt(b.stats.ascentM)} m D+</p>
        <p>${copy.short}</p>
      </a>`;
  }).join('');
}

function buildSponsors() {
  const host = document.getElementById('sponsors')!;
  host.innerHTML = SPONSORS.map((s) => `
    <li class="sponsor">
      <figure>
        ${s.svg}
        <figcaption>« ${s.title} »</figcaption>
      </figure>
    </li>`).join('');
}

// ── Compteurs de la vue d'ensemble ───────────────────────────────────────

let countupsDone = false;
function runCountups() {
  if (countupsDone) return;
  countupsDone = true;
  const totalKm = BUNDLES.reduce((a, b) => a + b.stats.distanceKm, 0);
  const totalDplus = BUNDLES.reduce((a, b) => a + b.stats.ascentM, 0);
  const els = document.querySelectorAll<HTMLElement>('#statstrip [data-count]');
  const targets = [Math.round(totalKm), Math.round(totalDplus), 3];
  els.forEach((el, i) => {
    const target = targets[i] ?? 0;
    const suffix = el.dataset.suffix ?? '';
    if (REDUCED) { el.textContent = fmtInt(target) + suffix; return; }
    const t0 = performance.now();
    const dur = 1500;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtInt(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// ── Confettis (maison, sans dépendance) ──────────────────────────────────

const confettiCanvas = document.getElementById('confetti') as HTMLCanvasElement;
const confettiCtx = confettiCanvas.getContext('2d')!;
interface Particle { x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; color: string; life: number; }
let particles: Particle[] = [];
let confettiRunning = false;

function sizeConfetti() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  confettiCanvas.width = window.innerWidth * dpr;
  confettiCanvas.height = window.innerHeight * dpr;
  confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function confettiBurst(x: number, y: number) {
  if (REDUCED) return;
  const colors = ['#e8ff3c', '#ff7a45', '#6fd1ff', '#f2efe6'];
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    particles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      w: 5 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      color: colors[i % colors.length],
      life: 1,
    });
  }
  if (!confettiRunning) {
    confettiRunning = true;
    requestAnimationFrame(confettiTick);
  }
}

function confettiTick() {
  confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.vy += 0.22;
    p.vx *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 0.011;
    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot);
    confettiCtx.globalAlpha = Math.max(0, p.life);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    confettiCtx.restore();
  }
  if (particles.length > 0) requestAnimationFrame(confettiTick);
  else {
    confettiRunning = false;
    confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

// ── Inscription ──────────────────────────────────────────────────────────

let chosenTier: string | null = null;

function setupInscription() {
  const confirmPanel = document.getElementById('confirm')!;
  const confirmTier = document.getElementById('confirm-tier')!;
  const confirmNo = document.getElementById('confirm-no')!;
  const confirmMail = document.getElementById('confirm-mail') as HTMLAnchorElement;
  document.querySelectorAll<HTMLButtonElement>('#tiers .btn').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      chosenTier = btn.dataset.tier ?? null;
      if (!chosenTier) return;
      const r = btn.getBoundingClientRect();
      confettiBurst(r.left + r.width / 2, r.top + r.height / 2);
      confirmTier.textContent = `Formule ${chosenTier}`;
      confirmNo.textContent = pad2(i + 1).padStart(3, '0');
      confirmMail.href = `mailto:${MAIL_TO}?subject=${encodeURIComponent(`Engagement Tour du Loiret 2026 — Formule ${chosenTier}`)}`;
      confirmPanel.hidden = false;
      confirmPanel.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    });
  });
}

// ── Chorégraphie de défilement ───────────────────────────────────────────

interface StageRefs {
  n: number;
  section: HTMLElement;
  hud: HTMLElement;
  hudKm: HTMLElement;
  hudDplus: HTMLElement;
  titleStep: HTMLElement;
  summaryStep: HTMLElement;
  /** scroll position → km checkpoints : le point du tracé arrive sur chaque
      POI au moment précis où sa carte se présente. */
  checkpoints: { pos: number; km: number }[];
}

let raceMap: RaceMap | null = null;
const pendingActions: (() => void)[] = [];
let activeStage: StageRefs | null = null;
let displayedFrac = 0;
let targetFrac = 0;
const stageRefs: StageRefs[] = [];

function withMap(fn: (m: RaceMap) => void) {
  if (raceMap) fn(raceMap);
  else pendingActions.push(() => fn(raceMap!));
}

function measureStages() {
  const top = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;
  for (const r of stageRefs) {
    const b = BUNDLES.find((x) => x.n === r.n)!;
    const pts: { pos: number; km: number }[] = [
      { pos: top(r.titleStep) + r.titleStep.offsetHeight * 0.5, km: 0 },
    ];
    r.section.querySelectorAll<HTMLElement>('.step--poi').forEach((step) => {
      pts.push({ pos: top(step) + step.offsetHeight * 0.5, km: Number(step.dataset.km) });
    });
    pts.push({ pos: top(r.summaryStep) + r.summaryStep.offsetHeight * 0.35, km: b.lengthKm });
    // Monotonie de sécurité (PK triés en amont, mais on verrouille).
    for (let i = 1; i < pts.length; i++) pts[i].km = Math.max(pts[i].km, pts[i - 1].km);
    r.checkpoints = pts;
  }
}

function kmAtAnchor(r: StageRefs, anchor: number): number {
  const pts = r.checkpoints;
  if (pts.length === 0) return 0;
  if (anchor <= pts[0].pos) return 0;
  if (anchor >= pts[pts.length - 1].pos) return pts[pts.length - 1].km;
  for (let i = 1; i < pts.length; i++) {
    if (anchor <= pts[i].pos) {
      const span = pts[i].pos - pts[i - 1].pos || 1;
      const t = (anchor - pts[i - 1].pos) / span;
      return pts[i - 1].km + t * (pts[i].km - pts[i - 1].km);
    }
  }
  return pts[pts.length - 1].km;
}

function collectStageRefs() {
  document.querySelectorAll<HTMLElement>('.stage').forEach((section) => {
    stageRefs.push({
      n: Number(section.dataset.stage),
      section,
      hud: section.querySelector('.stage-hud')!,
      hudKm: section.querySelector('[data-hud-km]')!,
      hudDplus: section.querySelector('[data-hud-dplus]')!,
      titleStep: section.querySelector('.step--title')!,
      summaryStep: section.querySelector('.step--summary')!,
      checkpoints: [],
    });
  });
  measureStages();
}

function updateHud(r: StageRefs, km: number) {
  const b = BUNDLES.find((x) => x.n === r.n)!;
  r.hudKm.textContent = fmtKm(km);
  r.hudDplus.textContent = fmtInt(dplusAt(b, km));
}

function drawLoop() {
  const st = activeStage;
  if (st && raceMap) {
    const b = BUNDLES.find((x) => x.n === st.n)!;
    const anchor = window.scrollY + window.innerHeight * 0.55;
    targetFrac = Math.max(0, Math.min(1, kmAtAnchor(st, anchor) / b.lengthKm));
    displayedFrac += (targetFrac - displayedFrac) * 0.14;
    if (Math.abs(targetFrac - displayedFrac) < 0.0004) displayedFrac = targetFrac;
    raceMap.setProgress(st.n, displayedFrac);
    updateHud(st, displayedFrac * b.lengthKm);
  }
  requestAnimationFrame(drawLoop);
}

function enterStage(r: StageRefs) {
  if (activeStage !== r) {
    activeStage = r;
    displayedFrac = 0;
    for (const other of stageRefs) other.hud.classList.toggle('on', other === r);
    withMap((m) => {
      m.hideAllPois();
      m.emphasis(r.n);
      if (REDUCED) {
        m.setProgress(r.n, 1);
        const b = BUNDLES.find((x) => x.n === r.n)!;
        updateHud(r, b.lengthKm);
      }
    });
  }
}

function leaveStages() {
  activeStage = null;
  for (const r of stageRefs) r.hud.classList.remove('on');
}

let lastAction: string | null = null;

function applyHero() {
  lastAction = 'hero';
  leaveStages();
  withMap((m) => { m.hideAllPois(); m.emphasis('hidden'); m.heroCamera(); });
}

function handleStepEnter(el: HTMLElement, direction: 'up' | 'down') {
  el.classList.add('is-active', 'was-seen');
  const action = el.dataset.action;
  lastAction = action ?? null;
  const stageN = Number(el.dataset.stage || 0);
  const r = stageRefs.find((x) => x.n === stageN);

  switch (action) {
    case 'hero':
      applyHero();
      break;
    case 'overview':
      leaveStages();
      runCountups();
      withMap((m) => { m.hideAllPois(); m.emphasis('all'); m.overviewCamera(); });
      break;
    case 'stage-title':
      if (r) {
        enterStage(r);
        withMap((m) => m.stageCamera(r.n));
      }
      break;
    case 'poi': {
      if (r) enterStage(r);
      const id = el.dataset.poi!;
      const lngLat: [number, number] = [Number(el.dataset.lon), Number(el.dataset.lat)];
      withMap((m) => { m.poiCamera(lngLat); m.showPoi(id); });
      break;
    }
    case 'summary':
      if (r) {
        enterStage(r);
        withMap((m) => m.stageCamera(r.n));
        el.querySelector('.profile-box')?.classList.add('on');
        if (direction === 'down') {
          // Verrouille les compteurs sur les valeurs finales à l'arrivée.
          targetFrac = 1;
        }
      }
      break;
    case 'calm':
      leaveStages();
      withMap((m) => { m.hideAllPois(); m.emphasis('all'); m.calmCamera(); });
      break;
  }
}

function handleStepExit(el: HTMLElement, direction: 'up' | 'down') {
  el.classList.remove('is-active');
  if (el.dataset.action === 'poi' && direction === 'up') {
    withMap((m) => m.hidePoi(el.dataset.poi!));
  }
}

// ── Démarrage ────────────────────────────────────────────────────────────

async function init() {
  buildStageSections();
  buildStageCards();
  buildSponsors();
  setupInscription();
  sizeConfetti();
  collectStageRefs();

  const scroller = scrollama();
  scroller
    .setup({ step: '.step', offset: 0.55 })
    .onStepEnter(({ element, direction }) => handleStepEnter(element as HTMLElement, direction))
    .onStepExit(({ element, direction }) => handleStepExit(element as HTMLElement, direction));

  window.addEventListener('resize', () => {
    sizeConfetti();
    measureStages();
    scroller.resize();
  });
  // Filet de sécurité : un retour brutal tout en haut (ancre, restauration de
  // défilement) peut échapper à l'observation des étapes — on repasse en héros.
  window.addEventListener('scroll', () => {
    if (window.scrollY < window.innerHeight * 0.2 && lastAction !== 'hero') applyHero();
  }, { passive: true });
  document.fonts?.ready.then(() => {
    measureStages();
    scroller.resize();
  });

  if (!REDUCED) requestAnimationFrame(drawLoop);

  raceMap = await RaceMap.create(
    document.getElementById('map')!,
    BUNDLES,
    BASE,
    POIS,
    REDUCED,
  );
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__tdl = raceMap;

  if (pendingActions.length > 0) {
    for (const fn of pendingActions) fn();
    pendingActions.length = 0;
  } else {
    raceMap.emphasis('hidden');
    raceMap.heroCamera();
  }
}

init();
