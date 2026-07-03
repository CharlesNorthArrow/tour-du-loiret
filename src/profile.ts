import { area, line as d3line, curveMonotoneX } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { min, max } from 'd3-array';
import type { StageStats } from './map';

const NS = 'http://www.w3.org/2000/svg';
const W = 400;
const H = 120;

/**
 * Renders the stage elevation profile into `box` (a .profile-box element).
 * The chart is revealed with a left-to-right wipe when the box gets the
 * class `on` (CSS drives the clip-path rect transition).
 */
export function renderProfile(box: HTMLElement, stats: StageStats, color: string, stageN: number) {
  const data = stats.profile;
  const x = scaleLinear().domain([0, data[data.length - 1].km]).range([0, W]);
  const eleMin = min(data, (d) => d.ele) ?? 0;
  const eleMax = max(data, (d) => d.ele) ?? 200;
  const padTop = (eleMax - eleMin) * 0.18 + 4;
  const y = scaleLinear().domain([eleMin - 4, eleMax + padTop]).range([H, 0]);

  const areaGen = area<{ km: number; ele: number }>()
    .x((d) => x(d.km))
    .y0(H)
    .y1((d) => y(d.ele))
    .curve(curveMonotoneX);
  const lineGen = d3line<{ km: number; ele: number }>()
    .x((d) => x(d.km))
    .y((d) => y(d.ele))
    .curve(curveMonotoneX);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label',
    `Profil de l'étape ${stageN} : altitude de ${Math.round(eleMin)} à ${Math.round(eleMax)} mètres sur ${Math.round(stats.distanceKm)} kilomètres`);

  const clipId = `profile-clip-${stageN}`;
  const defs = document.createElementNS(NS, 'defs');
  const clip = document.createElementNS(NS, 'clipPath');
  clip.setAttribute('id', clipId);
  clip.setAttribute('class', 'profile-clip');
  const rect = document.createElementNS(NS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', String(W));
  rect.setAttribute('height', String(H));
  clip.appendChild(rect);
  defs.appendChild(clip);
  svg.appendChild(defs);

  const g = document.createElementNS(NS, 'g');
  g.setAttribute('clip-path', `url(#${clipId})`);

  const areaPath = document.createElementNS(NS, 'path');
  areaPath.setAttribute('d', areaGen(data) ?? '');
  areaPath.setAttribute('fill', color);
  areaPath.setAttribute('fill-opacity', '0.16');

  const linePath = document.createElementNS(NS, 'path');
  linePath.setAttribute('d', lineGen(data) ?? '');
  linePath.setAttribute('fill', 'none');
  linePath.setAttribute('stroke', color);
  linePath.setAttribute('stroke-width', '2');
  linePath.setAttribute('vector-effect', 'non-scaling-stroke');

  const baseline = document.createElementNS(NS, 'line');
  baseline.setAttribute('x1', '0');
  baseline.setAttribute('x2', String(W));
  baseline.setAttribute('y1', String(H - 0.5));
  baseline.setAttribute('y2', String(H - 0.5));
  baseline.setAttribute('stroke', 'rgba(242,239,230,0.25)');
  baseline.setAttribute('vector-effect', 'non-scaling-stroke');

  g.appendChild(areaPath);
  g.appendChild(linePath);
  svg.appendChild(g);
  svg.appendChild(baseline);
  box.appendChild(svg);

  const labels = document.createElement('div');
  labels.className = 'profile-labels';
  labels.innerHTML = `
    <span>km 0 · ${Math.round(data[0].ele)} m</span>
    <span>alt. max ${Math.round(eleMax)} m</span>
    <span>km ${Math.round(stats.distanceKm)}</span>`;
  box.appendChild(labels);
}
