# Orbit — AFE 2026 Hackathon

**Find your people. Start with coffee.**

Orbit is a connection platform for AFE interns who want community but don't know
who's nearby, who's open to talking, or how to break the ice. It maps interns
across Amazon's North American hubs, lets them filter for the right people,
auto-pairs them for low-pressure intros, and gives them real-time in-app
messaging and group chats to actually connect.

**Live:** [orbitafe.vercel.app](https://orbitafe.vercel.app)

## Architecture

A static frontend that talks directly to **Supabase** (Postgres + Realtime) —
no custom server. Deployed on **Vercel**.

```
public/
  index.html       markup + tab shell (loads Leaflet, Globe.gl, Supabase from CDN)
  styles.css       full styling (Amazon-inspired design system + animations)
  app.js           all logic + Supabase client + realtime subscriptions
  linkedin.js      LinkedIn normalization + connect flow
  peccy.png        Peccy mascot (full size)
  peccy-cursor.png Peccy cursor (32px)
supabase-schema.sql        tables, RLS, realtime, seed groups
supabase-seed-users.sql    40 demo interns spread across the hubs
vercel.json                deploy config (outputDirectory: public)
```

- **Languages:** HTML, CSS, JavaScript (no build step) + SQL for the schema/seed.
- **Realtime:** Supabase Realtime subscriptions on `messages` and `users`
  tables — new messages and profile changes appear live across all clients.
- **Maps:** Leaflet (2D) + Globe.gl (3D globe mode) + leaflet-heat (heatmap).
- **Design:** Amazon-inspired palette (orange #ff9900, black, blue #08aae3, cream),
  DM Serif Display headings, DM Sans body, Peccy custom cursor.

## Features

- **Google OAuth login** — sign in with Google via Supabase Auth. Session
  persists across page reloads (no re-login needed).
- **AFE Map** — interns shown as face pins at their city center, colored by
  track (SDE / HDE / alumni). Heatmap overlay for density. 3D Globe mode.
  City search to jump around. Locate me (GPS or profile city fallback).
  Min zoom prevents over-zooming.
- **People cards** — filterable by city, building, school, timezone, track,
  interests, availability. Cards show AFE class year badge, compatibility tags.
- **Pair Up** — dating-app style matching algorithm. Weighted scoring based on
  shared interests (3x), same building (5x), same school (4x), same AFE class
  (3x), same city, same timezone, track diversity bonus. Skip button remembers
  who you've passed on. Compatibility percentage displayed.
- **Real-time messaging** — 1:1 DMs and group chats delivered live via
  Supabase Realtime. Messages persist across page refreshes. Unread tracking
  via localStorage (no false badges on reload). Live notification toasts.
- **Groups** — join public brown-bag groups or create private ones (only
  members can see/join). Leave button in chat. Group emoji from DB.
- **Profile** — name, track, AFE class (2019-2026), city, building, school,
  team/org, email, LinkedIn, availability, interests. Photo upload. Profile
  card preview shows what others see.
- **Privacy & consent** — nothing shown unless opted in. Exact location never
  used, only city center. Toggle visibility per field.
- **Logout & delete account** — sign out or permanently remove your data.
- **Dark / light theme** — follows OS preference, remembers manual choice.

## Design System

- **Palette:** Orange #ff9900 (primary), Black #111820 (ink), Blue #08aae3
  (cool accent), Cream #fff3dc (background), White (panels)
- **Typography:** DM Serif Display (headings), DM Sans (body)
- **Shapes:** Decorative orange + blue background blobs
- **Cursor:** Custom Peccy mascot (32px PNG)
- **Animations:** Spring-eased card hovers, staggered card entrances, modal
  slide-up, topbar gradient glow, toast bounce, view fade-in, filter group
  expand/collapse transitions
- **Cards:** Gradient top-bar on hover, layered shadows, match card with
  gradient border pseudo-element

## Setup

1. **Create a Supabase project** (supabase.com), then in the SQL Editor run:
   1. `supabase-schema.sql` — creates tables, RLS, realtime, and seed groups.
   2. `supabase-seed-users.sql` — loads 40 demo interns (idempotent).
   3. Add columns if missing:
      ```sql
      ALTER TABLE users ADD COLUMN IF NOT EXISTS building TEXT DEFAULT '';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS afe_class TEXT DEFAULT '';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS private BOOLEAN DEFAULT false;
      ```
2. **Point the app at your project** — in `public/app.js`, set `SUPABASE_URL`
   and `SUPABASE_KEY` (the project's anon key) near the top.
3. **Configure Google OAuth** — in Supabase Auth settings, add your domain to
   Site URL and Redirect URLs.
4. **Run locally:**
   ```
   npm run dev      # npx serve public  ->  http://localhost:3000
   ```
   Or deploy to Vercel (the repo is preconfigured).

## Locations

The map covers publicly listed North American Amazon corporate locations —
**HQ1** (Seattle) and **HQ2** (Arlington / National Landing) plus the Tech Hubs
(Bellevue, Portland, Vancouver, San Francisco, Sunnyvale, Santa Monica, Irvine,
San Diego, Tempe, Boulder, Denver, Dallas, Austin, Minneapolis, Chicago,
Nashville, Detroit, Pittsburgh, Atlanta, Toronto, Herndon, New York, Boston),
plus a Remote / Virtual option.

## Notes

- The 40 seed profiles are **fake** — sample LinkedIn handles and `@example.com`
  addresses. No real people, no Amazon-internal data (hub locations are public).
- RLS is intentionally permissive for the hackathon (anon key). Tighten before
  any real-world use.
- Peccy cursor image is the Amazon mascot used for the hackathon demo only.
