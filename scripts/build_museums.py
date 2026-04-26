#!/usr/bin/env python3
"""Build SF kid-friendly museums dataset with geocoded coordinates."""
import json, time, urllib.parse, urllib.request, sys, os

# Curated list of kid/family-relevant museums in SF (plus Bay Area Discovery
# Museum in Sausalito — included by user request because their family goes
# there often; bounds check below allows Marin Headlands area).
MUSEUMS = [
    {
        "name": "Randall Museum",
        "address": "199 Museum Way, San Francisco, CA 94114",
        "url": "https://randallmuseum.org/",
        "blurb": "Free hands-on natural-history & arts museum for kids in Corona Heights.",
    },
    {
        "name": "Exploratorium",
        "address": "Pier 15, Embarcadero, San Francisco, CA 94111",
        "url": "https://www.exploratorium.edu/",
        "blurb": "Iconic hands-on science, art & human-perception museum on the waterfront.",
    },
    {
        "name": "California Academy of Sciences",
        "address": "55 Music Concourse Dr, San Francisco, CA 94118",
        "url": "https://www.calacademy.org/",
        "blurb": "Aquarium, planetarium, rainforest & natural history museum in Golden Gate Park.",
    },
    {
        "name": "Children's Creativity Museum",
        "address": "221 4th St, San Francisco, CA 94103",
        "url": "https://creativity.org/",
        "blurb": "Interactive arts & tech museum for ages 2-12 in Yerba Buena Gardens.",
    },
    {
        "name": "Walt Disney Family Museum",
        "address": "104 Montgomery St, San Francisco, CA 94129",
        "url": "https://www.waltdisney.org/",
        "blurb": "Disney's life and art, in the Presidio's Main Post.",
    },
    {
        "name": "Aquarium of the Bay",
        "address": "Pier 39, The Embarcadero, San Francisco, CA 94133",
        "url": "https://www.aquariumofthebay.org/",
        "blurb": "Local sea life, sharks & rays in glass tunnels at Pier 39.",
    },
    {
        "name": "de Young Museum",
        "address": "50 Hagiwara Tea Garden Dr, San Francisco, CA 94118",
        "url": "https://www.famsf.org/visit/de-young",
        "blurb": "Fine art museum with a free observation tower and Kimball Education Gallery.",
    },
    {
        "name": "Legion of Honor",
        "address": "100 34th Ave, San Francisco, CA 94121",
        "url": "https://www.famsf.org/visit/legion-of-honor",
        "blurb": "European art in Lincoln Park; family programs & a great cliff view.",
    },
    {
        "name": "Cable Car Museum",
        "address": "1201 Mason St, San Francisco, CA 94108",
        "url": "https://www.cablecarmuseum.org/",
        "blurb": "Free working powerhouse where you can watch the cable cars' giant wheels spin.",
    },
    {
        "name": "Yerba Buena Center for the Arts",
        "address": "701 Mission St, San Francisco, CA 94103",
        "url": "https://ybca.org/",
        "blurb": "Contemporary art & performance with regular family events.",
    },
    {
        "name": "Musée Mécanique",
        "address": "Pier 45, Shed A, San Francisco, CA 94133",
        "url": "https://museemecanique.com/",
        "blurb": "Free entry; hundreds of antique coin-operated arcade machines at Fisherman's Wharf.",
    },
    {
        "name": "San Francisco Zoo",
        "address": "Sloat Blvd & Great Highway, San Francisco, CA 94132",
        "url": "https://www.sfzoo.org/",
        "blurb": "Not technically a museum, but a perennial family-day destination by Ocean Beach.",
    },
    {
        "name": "Bay Area Discovery Museum",
        "address": "557 McReynolds Rd, Sausalito, CA 94965",
        "url": "https://baykidsmuseum.org/",
        "blurb": "Hands-on children's museum just across the Golden Gate Bridge in Sausalito.",
    },
]

UA = "sf-playground-passport/1.0 (ryjonesy.github.io)"


def geocode(query: str):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": query, "format": "json", "limit": 1, "countrycodes": "us",
    })
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode("utf-8"))
    if not data:
        return None
    lat = float(data[0]["lat"])
    lng = float(data[0]["lon"])
    return lat, lng


# Manual fallback coords (verified) for things Nominatim sometimes mis-geocodes
FALLBACK = {
    "Exploratorium": (37.8013, -122.3984),
    "Aquarium of the Bay": (37.8087, -122.4098),
    "Walt Disney Family Museum": (37.7989, -122.4577),
    "Pier 39 / Aquarium of the Bay": (37.8087, -122.4098),
    "Musée Mécanique": (37.8099, -122.4177),
    "Children's Creativity Museum": (37.7849, -122.4030),
}

# Expanded bounds: SF + Marin Headlands / Sausalito (for Bay Area Discovery)
def in_sf(lat, lng):
    return 37.6 < lat < 37.86 and -122.55 < lng < -122.35


def main():
    out = []
    for m in MUSEUMS:
        name = m["name"]
        coords = None
        try:
            coords = geocode(m["address"])
            time.sleep(1.1)
        except Exception as e:
            print(f"  geocode error for {name}: {e}", file=sys.stderr)
        if coords and not in_sf(*coords):
            print(f"  {name}: out-of-SF result {coords}, trying name search", file=sys.stderr)
            try:
                coords = geocode(name + ", San Francisco, CA")
                time.sleep(1.1)
            except Exception as e:
                print(f"  retry error: {e}", file=sys.stderr)
        if (not coords or not in_sf(*coords)) and name in FALLBACK:
            coords = FALLBACK[name]
            print(f"  {name}: using fallback {coords}", file=sys.stderr)
        if not coords or not in_sf(*coords):
            print(f"  ❌ skipping {name} (no good coords)", file=sys.stderr)
            continue
        lat, lng = coords
        out.append({
            "name": name,
            "address": m["address"],
            "url": m["url"],
            "blurb": m["blurb"],
            "lat": round(lat, 6),
            "lng": round(lng, 6),
        })
        print(f"  ✓ {name}: {lat:.5f}, {lng:.5f}")

    here = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(here, "..", "data", "museums.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWrote {len(out)} museums to {out_path}")


if __name__ == "__main__":
    main()
