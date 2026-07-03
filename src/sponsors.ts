/**
 * Partenaires officiels — wordmarks SVG inventés de toutes pièces.
 * Chaque logo a sa propre personnalité typographique ; le CSS les affiche en
 * niveaux de gris et leur rend leurs couleurs au survol.
 */

export interface Sponsor {
  name: string;
  title: string;
  svg: string;
}

export const SPONSORS: Sponsor[] = [
  {
    name: 'Pralines Beaugendre',
    title: 'Fournisseur officiel de glucides depuis 1873',
    svg: `<svg viewBox="0 0 240 74" role="img" aria-label="Pralines Beaugendre">
      <ellipse cx="120" cy="37" rx="114" ry="32" fill="none" stroke="#c9a227" stroke-width="1.5"/>
      <text x="120" y="26" text-anchor="middle" font-family="Georgia, serif" font-size="11" letter-spacing="6" fill="#c9a227">PRALINES</text>
      <text x="120" y="52" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="24" fill="#e78ea9">Beaugendre</text>
      <text x="120" y="65" text-anchor="middle" font-family="Georgia, serif" font-size="8" letter-spacing="3" fill="#c9a227">— 1873 —</text>
    </svg>`,
  },
  {
    name: 'Safran du Gâtinais Père Robillard',
    title: "L'épice officielle du peloton",
    svg: `<svg viewBox="0 0 240 74" role="img" aria-label="Safran du Gâtinais Père Robillard">
      <g stroke="#9a5fb5" stroke-width="3" stroke-linecap="round" fill="none">
        <path d="M28 46 C24 34 26 24 32 16"/>
        <path d="M32 46 C32 32 32 24 32 16"/>
        <path d="M36 46 C40 34 38 24 32 16"/>
      </g>
      <g stroke="#e0862c" stroke-width="2" stroke-linecap="round">
        <path d="M30 22 l-4 -6"/><path d="M32 20 l0 -7"/><path d="M34 22 l4 -6"/>
      </g>
      <text x="52" y="32" font-family="Georgia, serif" font-size="16" letter-spacing="2" fill="#e0862c">SAFRAN DU GÂTINAIS</text>
      <text x="52" y="56" font-family="Georgia, serif" font-style="italic" font-size="15" fill="#f2efe6">Père Robillard, récoltant</text>
    </svg>`,
  },
  {
    name: 'Garage Marcel — Louzouer',
    title: 'Assistance neutre (tracteur)',
    svg: `<svg viewBox="0 0 240 74" role="img" aria-label="Garage Marcel, Louzouer">
      <rect x="12" y="8" width="216" height="58" rx="6" fill="#2b4a75"/>
      <rect x="16" y="12" width="208" height="50" rx="4" fill="none" stroke="#f2efe6" stroke-width="1.5"/>
      <text x="120" y="28" text-anchor="middle" font-family="'Arial Narrow', Arial, sans-serif" font-size="12" letter-spacing="8" fill="#f2efe6">GARAGE</text>
      <text x="120" y="50" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="21" letter-spacing="3" fill="#e8433c">MARCEL</text>
      <text x="120" y="60" text-anchor="middle" font-family="'Arial Narrow', Arial, sans-serif" font-size="7.5" letter-spacing="4" fill="#f2efe6">LOUZOUER · DÉPANNAGE TOUTES DISTANCES</text>
    </svg>`,
  },
  {
    name: 'Optique de la Cloche',
    title: "Partenaire officiel de la ligne d'arrivée : voyez-la avant les autres",
    svg: `<svg viewBox="0 0 240 74" role="img" aria-label="Optique de la Cloche">
      <g fill="none" stroke="#467c9d" stroke-width="3">
        <circle cx="26" cy="30" r="13"/>
        <circle cx="58" cy="30" r="13"/>
        <path d="M39 30 q3 -5 6 0"/>
        <path d="M13 30 l-6 -4 M71 30 l6 -4"/>
      </g>
      <text x="88" y="36" font-family="'Instrument Sans', sans-serif" font-weight="600" font-size="19" letter-spacing="4" fill="#a9dadc">OPTIQUE</text>
      <text x="88" y="56" font-family="Georgia, serif" font-style="italic" font-size="15" fill="#467c9d">de la Cloche</text>
    </svg>`,
  },
  {
    name: "Bar-Tabac de l'Écluse",
    title: 'Village départ & zone technique',
    svg: `<svg viewBox="0 0 240 74" role="img" aria-label="Bar-Tabac de l'Écluse">
      <path d="M30 14 L46 37 L30 60 L14 37 Z" fill="#e8433c"/>
      <path d="M30 22 L40 37 L30 52 L20 37 Z" fill="none" stroke="#f2efe6" stroke-width="1.5"/>
      <text x="58" y="34" font-family="'Arial Narrow', Arial, sans-serif" font-weight="bold" font-size="20" letter-spacing="2" fill="#f2efe6">BAR·TABAC</text>
      <text x="58" y="56" font-family="Georgia, serif" font-style="italic" font-size="16" fill="#e8b23c">de l'Écluse</text>
    </svg>`,
  },
  {
    name: 'Miel & Cie du Gâtinais',
    title: 'Nutrition sportive artisanale',
    svg: `<svg viewBox="0 0 240 74" role="img" aria-label="Miel et Compagnie du Gâtinais">
      <path d="M30 12 L45 21 L45 39 L30 48 L15 39 L15 21 Z" fill="#eab72c"/>
      <path d="M30 20 L38 25 L38 35 L30 40 L22 35 L22 25 Z" fill="none" stroke="#101816" stroke-width="1.6"/>
      <circle cx="30" cy="58" r="3" fill="#eab72c"/>
      <text x="56" y="36" font-family="'Bricolage Grotesque', sans-serif" font-weight="800" font-size="22" fill="#eab72c">MIEL &amp; Cie</text>
      <text x="56" y="56" font-family="'Instrument Sans', sans-serif" font-size="12" letter-spacing="3" fill="#f2efe6">DU GÂTINAIS</text>
    </svg>`,
  },
  {
    name: 'Piscine Municipale',
    title: 'Centre officiel de récupération',
    svg: `<svg viewBox="0 0 240 74" role="img" aria-label="Piscine Municipale, bassin privé du 591 Les Brins">
      <rect x="12" y="12" width="50" height="50" rx="10" fill="#4fb7d8"/>
      <g fill="none" stroke="#f2efe6" stroke-width="3" stroke-linecap="round">
        <path d="M20 28 q6 -5 12 0 t12 0 t10 0"/>
        <path d="M20 38 q6 -5 12 0 t12 0 t10 0"/>
        <path d="M20 48 q6 -5 12 0 t12 0 t10 0"/>
      </g>
      <text x="74" y="32" font-family="'Instrument Sans', sans-serif" font-weight="600" font-size="16" letter-spacing="1.5" fill="#4fb7d8">PISCINE MUNICIPALE</text>
      <text x="74" y="50" font-family="'Spline Sans Mono', monospace" font-size="9.5" letter-spacing="1" fill="#f2efe6">bassin privé — 591 Les Brins</text>
    </svg>`,
  },
];
