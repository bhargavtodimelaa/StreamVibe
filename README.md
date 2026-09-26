# StreamVibe — Video Streaming Platform

A front-end project (FEDF subject) built with **plain HTML, CSS and JavaScript** — no frameworks, no build step.

## Run it
Just open `index.html` in a browser (or serve the folder with `npx serve` / VS Code Live Server).

## Demo credentials & hints
| What | Hint |
|---|---|
| **Login / signup gate** | Every page asks for log in or sign up first (accounts stored in `localStorage`) |
| Viewer account | `demo@streamvibe.com` / `demo123` |
| Creator account | `creator@streamvibe.com` / `demo123` |
| **Admin account** | `admin@streamvibe.com` / `admin123` — Admin links/panel verify against stored users, or sign up with the *Administrator* role |
| **Subscriptions** | Admin → Users: *Deactivate* a user → they see the plan wall until they subscribe |
| **Parental PIN** | Demo PIN **1234** — shown on the lock screen and PIN prompt. Unlock lasts for that page view, so the PIN is asked again on every visit |
| **Restrictions** | Admin → *Parental PIN* sets a custom PIN; per-video toggle lives in the *Parental* column of the content table |

## Pages
| Page | Purpose |
|---|---|
| `index.html` | Home — hero carousel, search, category filters, trending, **personalised recommendations**, subscription plans |
| `watch.html` | Player — adaptive streaming, quality selector, resume, **parental PIN lock**, up-next countdown, related titles |
| `watchlist.html` | My List — watchlist, continue-watching history, **parental control settings (per-rating restrictions + PIN)** |
| `upload.html` | Content creator — upload form (validated), my uploads, creator stats |
| `admin.html` | Administrator — dashboard stats, **upload review queue**, content management (feature/remove, **per-video Parental toggle**), **users & subscriptions (deactivate/grant, change plans)**, **custom parental PIN**, plan activation |

## Files
```
index.html  watch.html  watchlist.html  upload.html  admin.html
css/style.css
js/data.js      → sample catalogue, plans, users (loaded first)
js/common.js    → storage helpers, watchlist, history, parental controls, auth, card rendering, nav, toasts
js/app.js       → home page logic
js/watch.js     → player, HLS/adaptive streaming, quality menu, up-next
js/watchlist.js → list + parental settings
js/upload.js    → creator upload flow
js/admin.js     → admin dashboard
```

## Features mapped to the brief
- **Browse & watch in categories** — Movies, TV Shows, Live, Documentaries, Kids chips + instant search
- **Watchlist** — `+ Watchlist` on every card, counted in the navbar (localStorage)
- **Personalised recommendations** — genre affinity built from watch history + watchlist
- **Creators upload videos** — validated form → “Pending review” → admin approves → published
- **Admins manage content & subscriptions** — feature/remove titles, suspend users, activate plans, review queue
- **Adaptive streaming** — HLS titles use hls.js multi-bitrate ABR with an Auto/quality picker; MP4 titles play progressively
- **Admin manages access** — deactivating a user forces a **“choose a plan” wall** on every page until they subscribe; plans chosen on the home page reactivate access (stored in `localStorage`)
- **Parental controls (per video)** — admin toggles 🔒 PIN per title; PIN asked before playing (default **1234**, custom PIN settable in admin); unlock lasts for the page view
- **Login / signup** — shown on every page open, users and session persisted in `localStorage` (`sv_users`, `sv_user`), admin panel verifies the admin role against those stored accounts
- **Admin changes persist** — featuring/removing titles survives reloads (`sv_video_overrides`)

Demo videos come from verified public URLs — `media.w3.org`, MDN CC0 clips, `test-videos.co.uk`, `samplelib.com`, `filesamples.com` MP4s plus Apple/Mux multi-bitrate HLS streams (all checked reachable), so an internet connection is needed for playback.
