# 🗺️ Planner — Carte de projet

Un outil d'organisation de projet pensé pour **y voir clair avant de planifier**.
On dépose toutes les tâches d'un projet, on les relie par **dépendances** sur un
graphe visuel, on garde des **notes par tâche** — et on date plus tard, une fois
la vue d'ensemble en place.

## Idée directrice

Plutôt qu'un planning daté dès le départ, on construit d'abord la **carte du
projet** :

- **Graphe de tâches** — chaque tâche est un nœud déplaçable, les flèches
  expriment « celle-ci avant celle-là ».
- **Prêt / Bloqué / En cours / Fait** — l'app calcule en continu ce que tu peux
  **attaquer maintenant** (toutes les dépendances finies) vs ce qui est encore
  bloqué. Les nœuds se colorent en conséquence.
- **Notes par tâche** — un panneau latéral pour les détails, idées, liens.
- **Multi-projets** — chaque projet a sa propre carte.
- **Ajout en continu** — on peut déposer une nouvelle tâche à tout moment.

> Les dates / la répartition dans le temps viendront dans une étape ultérieure,
> une fois la structure du projet claire.

## Stack

- **React + Vite** (frontend)
- **React Flow** (`@xyflow/react`) — le graphe de dépendances
- **Tailwind CSS** (design system « sunrise »)
- **Supabase** (auth + PostgreSQL avec RLS)

## Démarrage local

```bash
npm install
cp .env.example .env   # renseigne l'URL et la clé publique Supabase
npm run dev
```

Ouvre http://localhost:5173, crée un compte, crée un projet, et commence à
déposer tes tâches.

### Variables d'environnement

```
VITE_SUPABASE_URL=...        # URL du projet Supabase
VITE_SUPABASE_ANON_KEY=...   # clé "publishable" / anon (publique, protégée par RLS)
```

## Schéma de la base

- `projects` — un conteneur par projet (nom, couleur).
- `tasks` — titre, `notes`, `status` (`todo` / `doing` / `done`), `project_id`,
  position sur le graphe (`pos_x`, `pos_y`).
- `task_dependencies` — arêtes du graphe : `task_id` dépend de `depends_on_id`.
- `task_attachments` — pièces jointes par tâche (réservé pour plus tard).

Chaque ligne est protégée par une politique Row Level Security liée à
`auth.uid()`.

## Comment ça marche

- **Ajouter une tâche** : bouton « + Tâche ».
- **Créer une dépendance** : tire un trait depuis le bord droit d'une tâche
  (prérequis) vers une autre (qui en dépend).
- **Éditer** : clique une tâche pour ouvrir le panneau (statut, notes,
  dépendances, suppression).
- **Réorganiser** : déplace les nœuds, leur position est sauvegardée.
