# Tour du Loiret · Édition 2026

Site promotionnel one-page pour le Tour du Loiret — épreuve cycliste de trois jours
entre amis, au départ de Louzouer (Loiret), traitée avec le sérieux d'un grand tour.

Carte plein écran fixe (MapLibre GL), récit au défilement (Scrollama) : les trois
boucles se tracent progressivement à l'écran avec compteurs km / D+ synchronisés,
étapes ponctuées de points d'intérêt, profils d'altitude D3, inscription à 0 €
(+ une bouteille pour la cave du directeur de course).

## Stack

- Vite + TypeScript vanilla (pas de framework)
- MapLibre GL JS + style OpenFreeMap « liberty » (sans clé ; repli raster CARTO,
  puis fond neutre si le réseau est coupé — les tracés restent visibles)
- Scrollama pour les étapes de défilement
- Turf (`length`, `line-slice-along`, `bbox`) pour le tracé progressif
- D3 (`d3-shape`, `d3-scale`, `d3-array`) pour les profils d'altitude

## Commandes

```bash
npm install
npm run dev       # serveur de développement
npm run build     # tsc --noEmit + vite build → dist/ (prêt pour Vercel)
npm run routes    # régénère les données de parcours (voir ci-dessous)
```

## Données de parcours

**Mode utilisé pour cette version : `brouter` (données réelles).**

`npm run routes` exécute `scripts/fetch-routes.mjs` :

1. Géocode la base (« 591 Les Brins, Louzouer » → 48.0356, 2.8497) et les
   points d'intérêt via Nominatim (1 req/s, User-Agent dédié) ;
2. Interroge l'API publique BRouter (profil `trekking` : petites routes,
   chemins de halage, jamais d'autoroute ni de nationale) pour chaque boucle ;
3. Calcule distance, D+ cumulé (lissage par moyenne mobile 5 points) et un
   profil d'altitude ré-échantillonné à 200 points ;
4. Écrit `src/data/stage{N}.geojson`, `stage{N}.stats.json`, `pois.json`,
   `meta.json` (fichiers versionnés : le site ne dépend jamais du réseau au build).

Si BRouter/Nominatim sont injoignables, le script bascule en mode `fallback`
(splines lissées entre les villes-étapes, stats estimées) et le note dans
`meta.json`.

### Écarts assumés par rapport au cahier des charges initial

Le cahier imposait 78–105 km par étape ; trois ajustements de tracé ont été
nécessaires (vérifiés en itérant sur BRouter) :

- **Étape 1** — demi-tour aux Sept Écluses de Rogny au lieu du Pont-Canal de
  Briare : le pont-canal est à ~45 km à vol d'oiseau de la base, toute boucle
  qui le touche dépasse 118 km. Retour par la rive est (Dammarie-sur-Loing)
  pour éviter l'aller-retour sur le même halage. Le POI « Pont-Canal » est
  remplacé par le chemin de halage du canal de Briare (1642, doyen des canaux
  de France). → 89,6 km, 427 m D+.
- **Étape 2** — retour nord par Ladon au lieu du crochet Amilly / Conflans /
  Montcresson / Saint-Firmin (la chaîne complète faisait 125,7 km).
  Beauchamps-sur-Huillard est conservé. → 102,3 km, 385 m D+.
- **Étape 3** — Grandchamp retiré : la commune réelle (Yonne) est à 11 km au
  sud de Charny et gonflait la boucle à 108,5 km. Montée vers Courtenay par
  Prunoy, comme prévu. → 87,7 km, 540 m D+.

Total : ~280 km, ~1 350 m D+. L'étape 2 reste la plus longue (étape reine),
l'étape 3 la plus courte et la plus vallonnée.

## Déploiement (Vercel)

Site 100 % statique, aucun backend, aucune variable d'environnement.
`npm run build` produit `dist/` ; framework preset « Vite » sur Vercel.

Le bouton de confirmation d'inscription ouvre un `mailto:` vers l'adresse du
directeur de course — à ajuster dans `src/main.ts` (`MAIL_TO`).

## Accessibilité

`lang="fr"`, repères sémantiques, texte réel sélectionnable, focus visible,
`prefers-reduced-motion` respecté (caméra sans transitions, tracés affichés
en entier, compteurs aux valeurs finales), utilisable à 375 px.
