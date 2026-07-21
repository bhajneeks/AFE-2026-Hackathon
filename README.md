# Orbit 🛰️ — AFE 2026 Hackathon

**Find your people. Start with coffee.**

Orbit is a connection platform for AFE interns who want community but don't know
who's nearby, who's open to talking, or how to break the ice. It maps interns
across Amazon's North American hubs, lets them filter for the right people,
auto-pairs them for low-pressure intros, and gives them **real-time** in-app
messaging and group chats to actually connect.

## Architecture

A static frontend that talks directly to **Supabase** (Postgres + Realtime) —
no custom server. Deployed on **Vercel**.

```
public/
  index.html   markup + tab shell (loads Leaflet + Supabase from CDN, then app.js)
  styles.css   all styling
  app.js       all logic + Supabase client + realtime subscriptions
supabase-schema.sql        tables, RLS, realtime, seed groups
supabase-seed-users.sql    40 demo interns spread across the hubs
vercel.json                deploy config (outputDirectory: public)
```

- **Languages:** HTML, CSS, JavaScript (no build step) + SQL for the schema/seed.
- **Realtime:** Supabase Realtime subscriptions on the `messages` and `users`
  tables — new messages and profile changes appear live across all clients.
- **Maps:** Leaflet (CDN).

## Setup

1. **Create a Supabase project** (supabase.com), then in the SQL Editor run:
   1. `supabase-schema.sql` — creates tables, RLS, realtime, and seed groups.
   2. `supabase-seed-users.sql` — loads 40 demo interns (idempotent; safe to re-run).
2. **Point the app at your project** — in `public/app.js`, set `SUPABASE_URL` and
   `SUPABASE_KEY` (the project's anon key) near the top.
3. **Run locally:**
   ```
   npm run dev      # npx serve public  →  http://localhost:3000
   ```
   Or deploy to Vercel (the repo is preconfigured).

## Features

- **Login + opt-in profile** — Google sign-in; name, photo, city, **building**,
  school, team/org, track (SDE — Software Development Engineer / HDE — Hardware
  Development Engineer), interests, availability, LinkedIn. Persisted in Supabase.
- **Building** — free-text with per-hub autocomplete suggestions; people can be
  filtered and grouped by building, and "same building" boosts matches.
- **AFE Map** — interns shown as **face pins** at their city center, colored by
  track (SDE / HDE / alumni). Click a pin to message or connect.
- **Connection filters** — nearby, same city, same school, same timezone,
  SDE/HDE, alumni mentors, shared interests, "also new to this," plus search.
- **Pair Up** — each round (weekly or biweekly) Orbit pairs you with one fellow
  AFE, matched on interests, location, and track, with the reasons why.
- **Real-time messaging** — 1:1 DMs and brown-bag group chats delivered live via
  Supabase Realtime, with a Messages inbox and unread badges.
- **Brown bags / group chats** — join seeded groups (Seattle lunch, HDE Q&A,
  first-demo prep, first-standup) or create your own.
- **Connect on LinkedIn** — opens a person's LinkedIn profile with a ready-to-paste
  connect note.
- **Privacy & consent layer** — nothing is shown unless you opt in; exact location
  is never used, only the city center.

## Locations

The map covers publicly listed North American Amazon corporate locations —
**HQ1** (Seattle) and **HQ2** (Arlington / National Landing) plus the Tech Hubs
(Bellevue, Portland, Vancouver, San Francisco, Sunnyvale, Santa Monica, Irvine,
San Diego, Tempe, Boulder, Denver, Dallas, Austin, Minneapolis, Chicago,
Nashville, Detroit, Pittsburgh, Atlanta, Toronto, Herndon, New York, Boston),
plus a Remote / Virtual option.

## Notes

- The 40 seed profiles are **fake** — sample LinkedIn handles and `@example.com`
  addresses. No real people, no Amazon-internal data (hub locations are public info).
- RLS is intentionally permissive for the hackathon (anon key, no auth complexity).
  Tighten the policies before any real-world use.
