# SF Playground Passport — User Guide

A complete guide to using the app and to the JSON data files that power it.

- **Live site:** https://ryjonesy.github.io/sf-playground-passport/
- **Source code:** https://github.com/ryjonesy/sf-playground-passport

---

## Table of contents

1. [Quick start](#quick-start)
2. [The map](#the-map)
3. [Tracking visits & the passport](#tracking-visits--the-passport)
4. [Filters & search](#filters--search)
5. [Discovery layers (libraries, museums, restrooms, pools, beaches, ice cream)](#discovery-layers)
6. [Trip planner](#trip-planner)
7. [Backup, restore & privacy](#backup-restore--privacy)
8. [Running locally](#running-locally)
9. [How the JSON files work](#how-the-json-files-work)
10. [Adding or editing data](#adding-or-editing-data)
11. [Troubleshooting](#troubleshooting)

---

## Quick start

1. Open https://ryjonesy.github.io/sf-playground-passport/ on any modern browser (phone or desktop).
2. The map loads with **135 playgrounds** as orange pins.
3. Click any pin → a popup opens with the playground's name, address, and a **Mark visited** button.
4. Your progress is saved automatically in your browser. No login, no account.

Everything below is optional — explore at your pace.

---

## The map

- **Pan:** drag the map.
- **Zoom:** scroll wheel, pinch on touch, or the `+ / −` buttons.
- **Locate me:** the **📍 Nearest** button uses your device GPS to highlight the closest playground.
- **Surprise me:** picks a random playground you haven't visited yet — handy when you can't decide.
- **Basemap:** soft, low-contrast CARTO Voyager tiles so the colored pins pop.

Pin colors at a glance:

| Pin | Meaning |
|---|---|
| 🟠 Orange (large) | Playground (visited or not) |
| 🟢 Green ring | Playground you've marked visited |
| 🔵 Blue dot | Library |
| 🟣 Purple dot | Museum |
| 🟢 Teal dot | Public restroom |
| 🔷 Deep-blue dot | Community pool |
| 🟡 Sandy yellow dot | Beach |
| 🌸 Pink dot | Ice cream shop |
| ☀️ / 🌤 / 🌫 chip | Live weather at a microclimate zone |

---

## Tracking visits & the passport

- Click any playground pin → **Mark visited** in the popup.
- The sidebar's progress ring updates: **X / 135**.
- Achievement badges unlock at **5, 10, 25, 50, half (68), and all 135** visits.
- Open a visited playground again to:
  - Add a **star rating** (1–5).
  - Write **notes** (e.g., "great toddler swings, shaded by 3pm").
  - Set a **last-visited date** (defaults to today when you mark it).
- Click **Mark unvisited** to undo.

All of this lives in your browser's `localStorage` under the key `sf-playground-passport`.

---

## Filters & search

The sidebar has three controls that stack:

1. **Search box** — name or address. Matches as you type.
2. **Visited / Unvisited / All** toggle.
3. **♿ Accessible only** — show only playgrounds with documented ADA features (accessible swings, restrooms, parking, etc.) per SF Rec & Park.

The map pins and the list update together.

---

## Discovery layers

Six toggle layers help with planning a day out. Each is a checkbox in the sidebar.

| Layer | Default | What's in it |
|---|---|---|
| **Libraries** | ON | All 29 SF Public Library branches |
| **Museums** | ON | 13 kid-friendly museums (Cal Academy, Exploratorium, Randall, Bay Area Discovery, etc.) |
| **Restrooms** | OFF | 83 public restrooms — 67 from SF Rec & Park parks plus 16 [Pit Stops](https://sfpublicworks.wpengine.com/pitstop/) |
| **Pools** | OFF | 9 SF Rec & Park community pools |
| **Beaches** | OFF | 8 family-friendly beaches (Crissy, Baker, Ocean, China, Aquatic Park, Heron's Head, Marshall's, Pier 7) |
| **Ice cream** | OFF | 15 hand-picked SF ice cream shops (Mitchell's, Bi-Rite, Smitten, Salt & Straw, Humphry Slocombe…) |
| **Live weather** | OFF | Current temp + conditions at 10 SF microclimate zones (Outer Sunset, Richmond, Presidio, Marina, Downtown, Mission, Bernal, Glen Park, Bayview, Twin Peaks). Refreshes every 15 min. |

**Tips**

- Restrooms and ice cream are off by default to keep the map readable — flip them on when you're planning a specific outing.
- Click any discovery dot for an info popup with name, address, and (where available) website link and one-line blurb.
- Layers are independent — you can stack any combination.

### About the live weather layer

SF microclimates are real — the Outer Sunset can sit at 55°F under fog while the Mission is sunny and 75°F. The weather layer makes that visible at a glance, with two complementary views:

**On the map** — a small, color-tinted pill at each zone showing weather emoji + temperature (emoji-only on mobile to keep it tight). Hovering enlarges the chip; clicking opens a popup with wind, humidity, and last-updated time.

**Side panel** (desktop) **/ bottom sheet** (mobile) — a `SF weather right now` card that lists all 10 zones sorted **coolest → warmest**, so the temperature spread across the city is immediately obvious. On mobile it's collapsed by default — just tap the header to slide it up. Tapping a zone row flies the map there and opens its popup.

**The data**

- Source: [Open-Meteo](https://open-meteo.com/) (free, no API key, no signup) — one multi-coordinate request to `api.open-meteo.com/v1/forecast` returns all 10 zones in a single network call.
- Zones sampled: Outer Sunset, Richmond, Presidio, Marina, Downtown, Mission, Bernal, Glen Park, Bayview, Twin Peaks.
- Color tints: blue (<55°F), green (55–65°F), amber (65–75°F), red (75°F+) — same scale on map chips and panel rows.
- Cached in `localStorage` (`sf-weather-cache-v1`) for instant reload; auto-refreshes every 15 minutes while the toggle is on.
- Closing the panel (the × button) turns the layer off entirely — same effect as un-checking the sidebar toggle.
- Zones are defined in [`data/microclimates.json`](#microclimatesjson) — same shape as the other simple datasets, edit to add/move zones.

---

## Trip planner

1. On any playground popup, click **Add to trip**.
2. The trip sidebar shows the stops in order.
3. The map draws a connecting line and totals the walking distance.
4. Drag stops to reorder, or remove with the × button.
5. **Clear trip** wipes the route (your visit history is untouched).

---

## Backup, restore & privacy

**Privacy:** 100% client-side. Visited list, ratings, notes, and trip plans never leave your device. The **📍 Nearest** button calls the browser geolocation API only when you click it.

**Back up your progress** (e.g., to copy from phone to laptop):

- **⬇︎ Export** in the sidebar downloads a small JSON file like `sf-playground-passport-2026-04-26.json`.
- **⬆︎ Import** on another device replaces (or merges, depending on the dialog) your local state with the file.

If you clear your browser data, your visit history goes with it — export occasionally if you care about it.

---

## Running locally

It's a pure static site. No build step, no Node, no dependencies.

```bash
git clone https://github.com/ryjonesy/sf-playground-passport.git
cd sf-playground-passport
python3 -m http.server 8080
# open http://localhost:8080
```

Any static server works (`npx serve`, `caddy`, nginx, GitHub Pages, Netlify…). Don't open `index.html` via `file://` — browsers block `fetch()` from local files.

---

## How the JSON files work

All data lives in `/data/*.json` and is loaded once on page load via `fetch()`. Each file is a **plain JSON array of objects**, one object per place. The app validates that every object has at least `name`, `lat`, and `lng`; missing fields are tolerated and just skipped in the popup.

### File index

| File | Count | What it represents |
|---|---|---|
| `data/playgrounds.json` | 135 | Every SF Rec & Park children's play area |
| `data/libraries.json` | 29 | SF Public Library branches |
| `data/museums.json` | 13 | Kid-friendly museums (incl. Bay Area Discovery in Sausalito) |
| `data/restrooms.json` | 83 | Park restrooms + Pit Stops |
| `data/pools.json` | 9 | SF Rec & Park community pools |
| `data/beaches.json` | 8 | Family-friendly beaches |
| `data/ice_cream.json` | 15 | Curated ice cream shops |
| `data/microclimates.json` | 10 | Sample points for the live weather overlay |

### Coordinate convention

- `lat` and `lng` are **decimal degrees, WGS-84** (the standard).
- All points should fall inside the SF bounding box used by the app:
  `37.6 < lat < 37.86` and `-122.55 < lng < -122.35`
  (the upper lat is stretched a bit so Bay Area Discovery in Sausalito is included).
- Anything outside that box is filtered out by the build scripts so a stray data point can't move the map.

### Schemas

#### `playgrounds.json` — the core dataset

```json
{
  "name": "10th Ave & Clement Mini Park",
  "facility": "Children's Play Area",
  "address": "351 Ninth Ave",
  "zipcode": "94118",
  "lat": 37.78191067,
  "lng": -122.46841197,
  "acres": 0.05024662603,
  "accessibility": [],
  "id": "10th-ave-clement-mini-park",
  "operator": "SF Rec & Park"
}
```

| Field | Required | Notes |
|---|---|---|
| `name` | ✅ | Display name |
| `id` | ✅ | Stable slug used as the localStorage key for visit data — **do not change** for existing entries |
| `lat`, `lng` | ✅ | Decimal degrees |
| `address`, `zipcode` | optional | Shown in popup |
| `facility` | optional | Always `"Children's Play Area"` for this dataset |
| `acres` | optional | Park size from DataSF |
| `accessibility` | optional | Array of strings; empty = no documented accessible features. Powers the ♿ filter |
| `operator` | optional | Almost always `"SF Rec & Park"` |

> Source: [DataSF — Recreation and Parks Facilities](https://data.sfgov.org/Culture-and-Recreation/Recreation-and-Parks-Facilities/ib5c-xgwu) (`facility_type='Children\'s Play Area'`). Accessibility flags are merged in from [SF Rec & Park's accessible play areas page](https://sfrecpark.org/1636/Accessible-Childrens-Play-Areas).

#### `libraries.json`

```json
{
  "name": "Main",
  "address": "100 Larkin Street",
  "zipcode": "94102",
  "lat": 37.7791882,
  "lng": -122.4157831
}
```

> Source: [SFPL branch list](https://sfpl.org/locations).

#### `museums.json`

```json
{
  "name": "Randall Museum",
  "address": "199 Museum Way, San Francisco, CA 94114",
  "url": "https://randallmuseum.org/",
  "blurb": "Free hands-on natural-history & arts museum for kids in Corona Heights.",
  "lat": 37.764398,
  "lng": -122.438367
}
```

| Field | Notes |
|---|---|
| `url` | optional, becomes a popup link |
| `blurb` | optional, ≤120 char one-liner shown in popup |

#### `restrooms.json`

```json
{
  "name": "Golden Gate Park - Section 7 – Big Rec Restroom",
  "kind": "park",
  "address": "501 Stanyan St",
  "lat": 37.768536,
  "lng": -122.465376
}
```

| Field | Notes |
|---|---|
| `kind` | `"park"` (SF Rec & Park facility) or `"pitstop"` (24/7 staffed Pit Stop). Used for the popup label only. |
| `hours` | optional — Pit Stops include this string |
| `neighborhood` | optional — Pit Stops include this |

> Sources: [DataSF Recreation Parks Facilities `ib5c-xgwu`](https://data.sfgov.org/resource/ib5c-xgwu.json?$where=facility_type=%27Restroom%27) (filtered to `facility_type='Restroom'`) and [DataSF Pit Stops `mr6h-cr3u`](https://data.sfgov.org/resource/mr6h-cr3u.json).

#### `pools.json`

```json
{
  "name": "Balboa Pool",
  "address": "747 Havelock St, San Francisco, CA 94112",
  "url": "https://sfrecpark.org/486/Balboa-Pool",
  "blurb": "Indoor pool in Balboa Park, popular for rec and lap swim.",
  "lat": 37.726747,
  "lng": -122.443267
}
```

> Source: curated from [sfrecpark.org/482/Swimming-Pools](https://sfrecpark.org/482/Swimming-Pools).

#### `beaches.json`

```json
{
  "name": "Crissy Field East Beach",
  "address": "603 Mason St, San Francisco, CA 94129",
  "url": "https://www.parksconservancy.org/parks/crissy-field",
  "blurb": "Wide flat beach with Golden Gate views and a calm cove for kids — Presidio.",
  "lat": 37.803903,
  "lng": -122.455456
}
```

> Source: hand-curated. Pulls from National Park Service, Golden Gate National Parks Conservancy, and SF Rec & Park pages.

#### `ice_cream.json`

```json
{
  "name": "Mitchell's Ice Cream",
  "address": "688 San Jose Ave, San Francisco, CA 94110",
  "blurb": "1953-era Bernal Heights classic — Mexican chocolate, ube, mango.",
  "lat": 37.744168,
  "lng": -122.422833
}
```

> Source: hand-curated from local food press; geocoded via [Nominatim](https://nominatim.org/).

#### `microclimates.json`

```json
{
  "id": "outer-sunset",
  "name": "Outer Sunset",
  "lat": 37.7596,
  "lng": -122.4938
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | ✅ | Stable slug; used as the cache key for that zone's weather |
| `name` | ✅ | Shown on the map chip and popup |
| `lat`, `lng` | ✅ | Sampled location — pick the rough center of the neighborhood |

Unlike the other JSON files, this one is **just sample points** — the live values come from the Open-Meteo API at runtime. To add a new microclimate zone (say, "Lake Merced"), append an object with a fresh `id` and the lat/lng of where you want the sample taken. No code changes needed.

> Source: zones picked by hand to represent SF's distinct climate bands. Live weather data: [Open-Meteo Forecast API](https://open-meteo.com/en/docs).

---

## Adding or editing data

### Edit an existing place

Just open the relevant JSON file, change the field, save, and reload the page. For example, fixing a typo in a museum blurb:

```diff
  "name": "Randall Museum",
- "blurb": "Free hands-on naturl-history & arts museum…",
+ "blurb": "Free hands-on natural-history & arts museum…",
```

For **playgrounds**, **never change `id`** — it's the localStorage key for everyone's visit history.

### Add a new place to a discovery layer

Append an object to the array in the relevant JSON file:

```json
{
  "name": "Twirl & Dip",
  "address": "Crissy Field, San Francisco, CA 94129",
  "blurb": "Organic soft-serve from a converted Citroën van.",
  "lat": 37.803,
  "lng": -122.466
}
```

Required: `name`, `lat`, `lng`. Everything else is optional.

To find lat/lng quickly:

- Right-click a spot in Google Maps → coordinates copy.
- Or use [Nominatim](https://nominatim.openstreetmap.org/ui/search.html) for an address.

### Re-running the build scripts

Two scripts in `scripts/` regenerate datasets from upstream sources:

```bash
# Pulls 13 museums (incl. Bay Area Discovery)
python3 scripts/build_museums.py

# Pulls restrooms + Pit Stops; geocodes pools/beaches/ice cream
python3 scripts/build_overlays.py
```

The overlay script has a manual-coordinate fallback dict at the top — if you edit `pools.json` / `beaches.json` / `ice_cream.json` by hand, also update the fallback so the next script run doesn't overwrite your fix. Both scripts respect Nominatim's 1.1-second rate limit and are safe to re-run.

### Adding a brand-new layer

1. Create `data/<your-layer>.json` with the same minimal shape (`name`, `lat`, `lng`).
2. In `app.js`:
   - Add state: `let foo = []; let fooLayer = null;`
   - Add it to the `Promise.all` in `init()`.
   - Add it to `initSimpleOverlays()` using the `buildSimpleOverlay(items, opts)` helper.
   - Add an entry to the `simpleOverlays` array in `bindUI()`.
3. In `index.html`, add a `<label class="chk">…</label>` toggle.
4. In `styles.css`, add a `.<your-layer>-dot { background: #...; box-shadow: 0 0 0 1px #... }` swatch.

That's the same pattern the four newest layers use.

---

## Troubleshooting

**The map is blank.**
- Check the browser console (F12). The most common cause is opening `index.html` via `file://` — use a local server.
- A bad coordinate in a JSON file (e.g., `lat: null`) will skip just that one entry, not break the map.

**My visited playgrounds disappeared.**
- They live in `localStorage`. They go away if you clear browser data, switch browsers, or use private mode. Use **⬇︎ Export** to back up.

**A playground I know is missing.**
- The dataset is from DataSF Rec & Parks. Privately-owned playgrounds and SFUSD schoolyards aren't included by design. Mini-parks that aren't tagged `Children's Play Area` upstream are also skipped.

**A pin is in the wrong spot.**
- Open an issue with the playground name and the correct lat/lng — or send a PR editing the JSON file directly.

**An ice cream shop closed / a new one opened.**
- Edit `data/ice_cream.json` and open a PR. This list is hand-curated, so contributions are welcome.

---

Built with ❤️ for SF families. MIT licensed — see [`LICENSE`](./LICENSE).
