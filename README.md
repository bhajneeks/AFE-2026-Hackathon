# Orbit 🛰️ — AFE 2026 Hackathon

**Find your people. Start with coffee.**

Orbit is a connection platform for AFE interns who want community but don't know
who's nearby, who's open to talking, or how to break the ice. It maps interns,
lets them filter for the right people, auto-pairs them for low-pressure intros,
and gives them real in-app messaging and group chats to actually connect.

## Run it

It's a single, self-contained file — no build step, no server, no dependencies
to install.

```
open index.html      # macOS
# or just double-click index.html in any modern browser (Chrome/Edge/Safari)
```

The only external resource is Leaflet (maps), loaded from a CDN.

## Features

- **Email login + opt-in profile** — name, photo, city, school, team/org,
  SDE/HDE track, interests, availability, LinkedIn.
- **Profile pictures** — upload from your device (stays local via `FileReader`),
  or fall back to a colored initials avatar.
- **AFE Map** — interns shown as **face pins** at their city center, colored by
  track (SDE / HDE / alumni). Click a pin to message or connect.
- **Connection filters** — nearby, same city, same school, same timezone,
  SDE/HDE, alumni mentors, shared interests, "also new to this," plus search.
- **Pair Up** — each round (weekly or biweekly) Orbit pairs you with one fellow
  AFE, matched on interests, location, and track, with the reasons why.
- **In-app messaging** — real 1:1 DMs and working brown-bag group chats, with a
  Messages inbox and unread badges.
- **Brown bags / group chats** — join seeded groups (Seattle lunch, HDE Q&A,
  first-demo prep, first-standup) or create your own.
- **Connect on LinkedIn** — opens a person's LinkedIn profile with a ready-to-paste
  connect note.
- **Privacy & consent layer** — nothing is shown unless you opt in; exact location
  is never used, only your city center.

## Files

| File | What it is |
|------|------------|
| `index.html` | The entire app — UI, styles, logic, and seed data, self-contained. |
| `profiles_data.js` | Source seed data (40 fake AFE profiles). Also inlined into `index.html`; kept here as the data's canonical source. |

## Notes

- All 40 profiles are **fake** — sample LinkedIn handles and `@example.com`
  addresses. No real people, no internal data.
- Everything runs client-side and in-memory; there is no backend, so data resets
  on refresh (intentional for a hackathon demo).
