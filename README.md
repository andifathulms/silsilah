# Silsilah — Collaborative Family Tree

Silsilah (Indonesian for *lineage*) is a multi-user platform for building and
sharing family trees. Create a tree, add people and relationships
(parent-child, spouse), invite relatives as Editors or Viewers, and explore the
result as an interactive diagram.

See [PRD.md](PRD.md) for product scope and [CLAUDE.md](CLAUDE.md) for the
engineering guide.

## Stack

- **Backend**: Django + Django REST Framework + PostgreSQL
- **Frontend**: Next.js (App Router) + TypeScript
- **Tree rendering**: [`family-chart`](https://www.npmjs.com/package/family-chart)
- **Media**: S3-compatible storage (MinIO in dev)

## Quick start

```bash
# 1. Bring up Postgres (+ MinIO) via Docker
docker compose up -d db

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_demo      # generates a multi-generation test family
python manage.py runserver

# 3. Frontend (separate shell)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Backend runs on http://localhost:8000, frontend on http://localhost:3000.

## Features

- Multi-user trees with Owner / Editor / Viewer roles per tree
- Generic `Relationship` edges (parent-child, spouse) — supports remarriage,
  adoption, unknown parents, half-siblings
- Cycle prevention enforced on write; siblings/grandparents derived on read
- Per-person change log (who changed what, when)
- Privacy: living people's birth date / photo / notes / media hidden from
  Viewers and public visitors
- **Photos** attached to a Person, optionally tied to a life event (caption +
  date) — see `MediaItem`
- **Share links**: owner-generated, read-only, tokenized public links, either
  whole-tree or scoped to a single person's **branch** (descendants + spouses,
  optionally ancestors). Public visitors get Viewer-level privacy.
  Frontend route: `/share/<token>`; API: `GET /api/share/<token>/`

## Project layout

```
backend/
  silsilah/     # Django project (settings, urls)
  accounts/     # auth
  trees/        # Tree, TreeMembership, permissions
  people/       # Person, Relationship, PersonChangeLog + derived endpoints
frontend/
  app/          # App Router pages
  components/    # tree-view, person-form, relationship-form
  lib/          # API client + family-chart adapter
```
