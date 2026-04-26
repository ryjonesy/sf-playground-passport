#!/usr/bin/env python3
"""Build datasets for restrooms, pools, beaches, and ice cream overlays.

- Restrooms = SF Rec & Park park restrooms (DataSF ib5c-xgwu) + Pit Stops (DataSF mr6h-cr3u)
- Pools     = curated SF Rec & Park aquatics (9 public pools)
- Beaches   = curated SF family beaches & shoreline kid spots
- Ice cream = curated kid-favorite SF ice cream shops, geocoded via Nominatim
"""
import json, time, urllib.parse, urllib.request, sys, os

UA = "sf-playground-passport/1.0 (ryjonesy.github.io)"

def in_sf(lat, lng):
    # expanded SF bounds (incl. Treasure Island / Marin Headlands)
    return 37.6 < lat < 37.86 and -122.55 < lng < -122.35


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def geocode(query):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": query, "format": "json", "limit": 1, "countrycodes": "us",
    })
    data = fetch(url)
    if not data:
        return None
    return float(data[0]["lat"]), float(data[0]["lon"])


# ============================================================
# RESTROOMS
# ============================================================
def build_restrooms():
    out = []

    # 1) SF Rec & Park restrooms from DataSF
    park_rooms = fetch("https://data.sfgov.org/resource/ib5c-xgwu.json?$where=facility_type='Restroom'&$limit=200")
    for r in park_rooms:
        try:
            lat = float(r["latitude"])
            lng = float(r["longitude"])
        except (KeyError, ValueError, TypeError):
            continue
        if not in_sf(lat, lng):
            continue
        if (r.get("city") or "").lower() not in ("san francisco", "sf", ""):
            continue
        name = r.get("facility_name") or "Park Restroom"
        park = r.get("property_name") or ""
        # Use park name as the headline if it's distinctive
        if park and park.lower() not in name.lower():
            display = f"{park} – {name}"
        else:
            display = name
        out.append({
            "name": display,
            "kind": "park",
            "address": (r.get("address") or "").strip(),
            "lat": round(lat, 6),
            "lng": round(lng, 6),
        })

    # 2) Pit Stops from DataSF
    pit_stops = fetch("https://data.sfgov.org/resource/mr6h-cr3u.json?$limit=100")
    for p in pit_stops:
        loc = p.get("location") or {}
        coords = loc.get("coordinates") or []
        if len(coords) < 2:
            continue
        lng, lat = coords[0], coords[1]
        if not in_sf(lat, lng):
            continue
        out.append({
            "name": p.get("name") or "Pit Stop",
            "kind": "pitstop",
            "address": p.get("address") or "",
            "hours": p.get("hours") or "",
            "neighborhood": p.get("neighborhood") or "",
            "lat": round(lat, 6),
            "lng": round(lng, 6),
        })

    print(f"  Restrooms: {len(out)} (parks + pit stops)")
    return out


# ============================================================
# POOLS - 9 SF Rec & Park public pools
# ============================================================
POOLS = [
    {"name": "Balboa Pool", "address": "747 Havelock St, San Francisco, CA 94112",
     "url": "https://sfrecpark.org/486/Balboa-Pool",
     "blurb": "Indoor pool in Balboa Park, popular for rec and lap swim."},
    {"name": "Coffman Pool", "address": "1701 Visitacion Ave, San Francisco, CA 94134",
     "url": "https://sfrecpark.org/489/Coffman-Pool",
     "blurb": "Indoor 25-yd pool in Herz Playground at McLaren Park."},
    {"name": "Garfield Pool", "address": "26th & Harrison St, San Francisco, CA 94110",
     "url": "https://sfrecpark.org/494/Garfield-Pool",
     "blurb": "Mission-District favorite with tot programs and family swim."},
    {"name": "Hamilton Pool", "address": "1900 Geary Blvd, San Francisco, CA 94115",
     "url": "https://sfrecpark.org/497/Hamilton-Pool",
     "blurb": "Heated pool with TWO indoor water slides — the only ones in SF."},
    {"name": "Martin Luther King Jr. Pool", "address": "5701 3rd St, San Francisco, CA 94124",
     "url": "https://sfrecpark.org/495/Martin-Luther-King-Pool",
     "blurb": "25-yd pool plus a separate tot wading pool in Bayview."},
    {"name": "Mission Community Pool", "address": "1 Linda St, San Francisco, CA 94110",
     "url": "https://sfrecpark.org/496/Mission-Pool",
     "blurb": "SF's only outdoor public pool — open seasonally."},
    {"name": "North Beach Pool", "address": "651 Lombard St, San Francisco, CA 94133",
     "url": "https://sfrecpark.org/498/North-Beach-Pool",
     "blurb": "Two pools (lap + recreation) in the Joe DiMaggio playground complex."},
    {"name": "Rossi Pool", "address": "Arguello Blvd & Anza St, San Francisco, CA 94118",
     "url": "https://sfrecpark.org/499/Rossi-Pool",
     "blurb": "Richmond District favorite with full programming for all ages."},
    {"name": "Sava Pool", "address": "2695 19th Ave, San Francisco, CA 94116",
     "url": "https://sfrecpark.org/546/Sava-Pool",
     "blurb": "Renovated 25-yd 8-lane pool in Parkside (currently undergoing repairs)."},
]

POOL_FALLBACK = {
    # Verified coords if Nominatim fails
    "Balboa Pool": (37.7212, -122.4581),
    "Coffman Pool": (37.7140, -122.4128),
    "Garfield Pool": (37.7508, -122.4119),
    "Hamilton Pool": (37.7847, -122.4351),
    "Martin Luther King Jr. Pool": (37.7314, -122.3886),
    "Mission Community Pool": (37.7615, -122.4265),
    "North Beach Pool": (37.8024, -122.4140),
    "Rossi Pool": (37.7796, -122.4585),
    "Sava Pool": (37.7424, -122.4757),
}

def build_pools():
    out = []
    for p in POOLS:
        coords = None
        try:
            coords = geocode(p["address"])
            time.sleep(1.1)
        except Exception as e:
            print(f"  pool geocode error for {p['name']}: {e}", file=sys.stderr)
        if not coords or not in_sf(*coords):
            coords = POOL_FALLBACK.get(p["name"])
            if coords:
                print(f"  {p['name']}: using fallback {coords}", file=sys.stderr)
        if not coords:
            print(f"  ❌ skipping pool {p['name']}", file=sys.stderr)
            continue
        out.append({**p, "lat": round(coords[0], 6), "lng": round(coords[1], 6)})
        print(f"  ✓ pool: {p['name']}")
    return out


# ============================================================
# BEACHES - SF family-friendly beaches & shoreline kid spots
# ============================================================
BEACHES = [
    {"name": "Crissy Field East Beach", "address": "603 Mason St, San Francisco, CA 94129",
     "url": "https://www.parksconservancy.org/parks/crissy-field",
     "blurb": "Wide flat beach with Golden Gate views and a calm cove for kids — Presidio."},
    {"name": "Baker Beach", "address": "1504 Pershing Dr, San Francisco, CA 94129",
     "url": "https://www.parksconservancy.org/parks/baker-beach",
     "blurb": "Iconic GG-Bridge view beach in the Presidio (south end family-friendly)."},
    {"name": "Ocean Beach", "address": "1000 Great Hwy, San Francisco, CA 94121",
     "url": "https://www.nps.gov/goga/planyourvisit/oceanbeach.htm",
     "blurb": "3-mile sandy beach along Great Highway. Strong currents — no swimming, but great for kites & sand."},
    {"name": "China Beach", "address": "390 Sea Cliff Ave, San Francisco, CA 94121",
     "url": "https://www.parksconservancy.org/parks/china-beach",
     "blurb": "Small protected cove in Sea Cliff — calmer water, great for little kids."},
    {"name": "Aquatic Park Cove", "address": "499 Jefferson St, San Francisco, CA 94109",
     "url": "https://www.nps.gov/safr/planyourvisit/visit-the-park.htm",
     "blurb": "Calm, swimmable cove next to Ghirardelli Square with sand and sea-lion sightings."},
    {"name": "Heron's Head Park", "address": "Jennings St & Cargo Way, San Francisco, CA 94124",
     "url": "https://sfport.com/herons-head-park",
     "blurb": "Bayview shoreline park with a nature trail and EcoCenter; great bird-watching."},
    {"name": "Marshall's Beach", "address": "Marshall's Beach Trail, San Francisco, CA 94129",
     "url": "https://www.parksconservancy.org/parks/marshalls-beach",
     "blurb": "Dramatic GG-Bridge views via a short Presidio hike (steep stairs — older kids)."},
    {"name": "Pier 7 Promenade", "address": "Pier 7, The Embarcadero, San Francisco, CA 94111",
     "url": "https://sfport.com/pier-7",
     "blurb": "Not technically a beach, but a wide waterfront promenade kids love biking."},
]

BEACH_FALLBACK = {
    "Crissy Field East Beach": (37.8065, -122.4651),
    "Baker Beach": (37.7935, -122.4836),
    "Ocean Beach": (37.7594, -122.5107),
    "China Beach": (37.7895, -122.4912),
    "Aquatic Park Cove": (37.8082, -122.4225),
    "Heron's Head Park": (37.7374, -122.3737),
    "Marshall's Beach": (37.8000, -122.4760),
    "Pier 7 Promenade": (37.7991, -122.3970),
}

def build_beaches():
    out = []
    for b in BEACHES:
        coords = None
        try:
            coords = geocode(b["address"])
            time.sleep(1.1)
        except Exception as e:
            print(f"  beach geocode error for {b['name']}: {e}", file=sys.stderr)
        if not coords or not in_sf(*coords):
            coords = BEACH_FALLBACK.get(b["name"])
            if coords:
                print(f"  {b['name']}: using fallback {coords}", file=sys.stderr)
        if not coords:
            print(f"  ❌ skipping beach {b['name']}", file=sys.stderr)
            continue
        out.append({**b, "lat": round(coords[0], 6), "lng": round(coords[1], 6)})
        print(f"  ✓ beach: {b['name']}")
    return out


# ============================================================
# ICE CREAM - kid-favorite SF ice cream shops
# ============================================================
ICE_CREAM = [
    {"name": "Mitchell's Ice Cream", "address": "688 San Jose Ave, San Francisco, CA 94110",
     "blurb": "1953-era Bernal Heights classic — Mexican chocolate, ube, mango."},
    {"name": "Bi-Rite Creamery", "address": "3692 18th St, San Francisco, CA 94110",
     "blurb": "Mission salted-caramel destination with the Dolores Park line."},
    {"name": "Bi-Rite Creamery (Divisadero)", "address": "550 Divisadero St, San Francisco, CA 94117",
     "blurb": "Second Bi-Rite scoop shop, often shorter line."},
    {"name": "Smitten Ice Cream (Hayes Valley)", "address": "432 Octavia St #1A, San Francisco, CA 94102",
     "blurb": "Liquid-nitrogen ice cream made to order — kids love watching it freeze."},
    {"name": "Garden Creamery", "address": "3566 20th St, San Francisco, CA 94110",
     "blurb": "Tropical & Asian-inspired flavors in the Mission."},
    {"name": "Salt & Straw (Hayes Valley)", "address": "586 Hayes St, San Francisco, CA 94102",
     "blurb": "Adventurous flavors and free taste-tests with no eye-rolls."},
    {"name": "Salt & Straw (Fillmore)", "address": "2201 Fillmore St, San Francisco, CA 94115",
     "blurb": "Pacific Heights spot for the same Salt & Straw flavors."},
    {"name": "Swensen's Ice Cream (Russian Hill)", "address": "1999 Hyde St, San Francisco, CA 94109",
     "blurb": "1948 OG Swensen's — the very first one, still on a cable-car corner."},
    {"name": "Humphry Slocombe (Mission)", "address": "2790 Harrison St, San Francisco, CA 94110",
     "blurb": "Secret Breakfast (bourbon + cornflakes) — the original location."},
    {"name": "Humphry Slocombe (Ferry Building)", "address": "1 Ferry Building, San Francisco, CA 94111",
     "blurb": "Same wild flavors right on the Embarcadero."},
    {"name": "The Ice Cream Bar Soda Fountain", "address": "815 Cole St, San Francisco, CA 94117",
     "blurb": "1930s-style soda-fountain in Cole Valley with sundaes and floats."},
    {"name": "Polly Ann Ice Cream", "address": "3142 Noriega St, San Francisco, CA 94122",
     "blurb": "Sunset District legend — spin the wheel of mystery flavors."},
    {"name": "Joe's Ice Cream", "address": "5420 Geary Blvd, San Francisco, CA 94121",
     "blurb": "Classic Outer Richmond shop — homemade flavors since 1959."},
    {"name": "Marco Polo Italian Ice Cream", "address": "1447 Taraval St, San Francisco, CA 94116",
     "blurb": "Outer Sunset spot famous for durian, taro, and lychee gelato."},
    {"name": "Lush Gelato (Pac Heights)", "address": "1817 Polk St, San Francisco, CA 94109",
     "blurb": "Local gelato with rotating seasonal flavors."},
]

def build_ice_cream():
    out = []
    for ic in ICE_CREAM:
        coords = None
        try:
            coords = geocode(ic["address"])
            time.sleep(1.1)
        except Exception as e:
            print(f"  ice cream geocode error for {ic['name']}: {e}", file=sys.stderr)
        if not coords or not in_sf(*coords):
            print(f"  ❌ skipping {ic['name']} (bad geocode)", file=sys.stderr)
            continue
        out.append({**ic, "lat": round(coords[0], 6), "lng": round(coords[1], 6)})
        print(f"  ✓ ice cream: {ic['name']}")
    return out


# ============================================================
def main():
    here = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(here, "..", "data")

    print("\n=== Restrooms ===")
    restrooms = build_restrooms()
    json.dump(restrooms, open(os.path.join(data_dir, "restrooms.json"), "w"), indent=2)
    print(f"Wrote {len(restrooms)} restrooms")

    print("\n=== Pools ===")
    pools = build_pools()
    json.dump(pools, open(os.path.join(data_dir, "pools.json"), "w"), indent=2)
    print(f"Wrote {len(pools)} pools")

    print("\n=== Beaches ===")
    beaches = build_beaches()
    json.dump(beaches, open(os.path.join(data_dir, "beaches.json"), "w"), indent=2)
    print(f"Wrote {len(beaches)} beaches")

    print("\n=== Ice cream ===")
    ic = build_ice_cream()
    json.dump(ic, open(os.path.join(data_dir, "ice_cream.json"), "w"), indent=2)
    print(f"Wrote {len(ic)} ice cream shops")


if __name__ == "__main__":
    main()
