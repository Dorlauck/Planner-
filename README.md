# 🌅 Sunrise — Planner

Un clone fonctionnel et open-source inspiré de [Sunrise Planner](https://sunriseplanner.com/) :
fixe des **objectifs**, construis des **habitudes**, planifie ta **journée** et tiens un
**journal**, le tout dans une interface chaleureuse « lever de soleil ».

> ⚠️ Projet d'apprentissage, indépendant et non affilié à Sunrise Planner.
> Le design s'en inspire mais n'en copie aucun asset.

## Stack

- **React + Vite** (frontend)
- **Tailwind CSS** (design system « sunrise »)
- **Supabase** (authentification + base de données PostgreSQL avec RLS)
- **date-fns** (dates, locale FR)

## Fonctionnalités

| Page | Description |
|------|-------------|
| ☀️ **Ma journée** | Sélecteur de semaine, plan du jour (tâches à cocher), habitudes du jour |
| 🎯 **Objectifs** | Création d'objectifs avec couleur, échéance, description, complétion |
| 🔁 **Habitudes** | Habitudes avec emoji/couleur/jours actifs + grille de suivi hebdomadaire |
| 📖 **Journal** | Entrée quotidienne avec humeur et sauvegarde automatique |

Toutes les données sont privées : chaque ligne est protégée par une politique
Row Level Security liée à `auth.uid()`.

## Démarrage local

```bash
npm install
cp .env.example .env   # puis renseigne l'URL et la clé publique Supabase
npm run dev
```

Ouvre http://localhost:5173, crée un compte et c'est parti.

### Variables d'environnement

```
VITE_SUPABASE_URL=...        # URL du projet Supabase
VITE_SUPABASE_ANON_KEY=...   # clé "publishable" / anon (publique, protégée par RLS)
```

## Schéma de la base

`goals`, `habits`, `habit_logs`, `tasks`, `journal_entries` — voir la migration
`init_planner_schema` appliquée sur le projet Supabase.
