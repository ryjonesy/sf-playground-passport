# 🎠 SF Playground Passport

An interactive map of every San Francisco Recreation & Park playground — track which ones your family has visited, find nearby kid-friendly spots, plan multi-stop trips, and earn badges for hitting milestones.

[👉 Live demo](#) — replace this link with your GitHub Pages URL once deployed.

![SF Playground Passport screenshot](https://img.shields.io/badge/playgrounds-134-orange) ![License](https://img.shields.io/badge/license-MIT-blue) ![Stack](https://img.shields.io/badge/stack-vanilla%20JS%20%2B%20Leaflet-green)

## What it does

- **🗺 Interactive map** of all 134 SF Rec & Park children's play areas, plotted from the official [DataSF Recreation & Parks Facilities](https://data.sfgov.org/Culture-and-Recreation/Recreation-and-Parks-Facilities/ib5c-xgwu) dataset.
- **✅ Visited tracker** — click any pin, mark it visited. Progress lives in your browser (no account, no server).
- **🏆 Playground passport** — a progress ring shows X / 134 visited, plus achievement badges (5, 10, 25, 50, half-the-city, all visited).
- **♿ Accessibility filter** — show only playgrounds with ADA-friendly features (accessible swings, restrooms, parking, etc.) per [SF Rec & Park accessibility data](https://sfrecpark.org/1636/Accessible-Childrens-Play-Areas).
- **🏛 Nearby family spots** — for any selected playground, toggle layers for restaurants, ice cream, museums, libraries, cafés, and other parks within 5–15 minute walking distance.
- **🎲 Surprise me** — picks a random unvisited playground.
- **📍 Nearest** — uses your device location to find the closest playground.
- **🚶 Trip planner** — add multiple playgrounds to a route; see total distance and a connecting line on the map.
- **⭐ Per-playground notes** — rating, free-text notes, last-visited date — all saved locally per playground.
- **⬇︎ Export / ⬆︎ Import** — back up your progress as JSON to sync between devices.

## Run locally

It's a pure static site — no build step.

```bash
# any static server works; here's one with Python:
cd sf-playgrounds-map
python3 -m http.server 8080
# open http://localhost:8080
```

Or just double-click `index.html` after disabling Chrome's strict CORS for `file://` (using a local server is easier).

## Deploy to GitHub Pages

1. Push this directory to a public GitHub repo (the included GitHub Actions workflow does the rest).
2. Go to **Settings → Pages** and confirm the source is set to **GitHub Actions**.
3. After the first push to `main`, your site will be live at `https://<your-username>.github.io/<repo-name>/`.

## File layout

```
sf-playgrounds-map/
├── index.html          # markup + sidebar + map container
├── styles.css          # all styles (light, paper-bag SF palette)
├── app.js              # vanilla JS app (Leaflet + localStorage)
├── data/
│   └── playgrounds.json  # 134 playgrounds with coords + accessibility
└── .github/workflows/
    └── pages.yml       # auto-deploys to GitHub Pages on push
```

## Data sources

| Source | What we use |
|---|---|
| [DataSF — Recreation and Parks Facilities](https://data.sfgov.org/Culture-and-Recreation/Recreation-and-Parks-Facilities/ib5c-xgwu) | Playground names, addresses, lat/lng |
| [SF Rec & Park — Accessible Children's Play Areas](https://sfrecpark.org/1636/Accessible-Childrens-Play-Areas) | ADA / accessibility features |
| [Kira Sparks — Complete list of SF playgrounds](https://www.kirasparks.com/post/a-complete-list-of-san-francisco-playgrounds) | Featured / family-favorite notes |
| [OpenStreetMap via Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) | Nearby restaurants, cafés, museums, libraries |
| [CARTO Voyager basemap](https://carto.com/basemaps/) | Map tiles |

## Privacy

100% client-side. Your visited list, ratings, notes, and trip plans never leave your device — they're stored in `localStorage`. The "Nearest" button uses the browser geolocation API only when you click it.

## Ideas worth adding

- Sync progress across devices (Firebase / Supabase free tier)
- Photo uploads per playground (would need cloud storage)
- Stroller-friendly / shade / water fountain tags (community-sourced)
- Compare progress with friends (read-only share link)
- Seasonal events overlay (concerts, story time, splash pads)
- Playground-of-the-month suggestion based on weather

## License

MIT — see `LICENSE`.

Built with ❤️ for SF families.
