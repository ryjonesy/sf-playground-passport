// SF Playground Passport — main app
// Uses Leaflet + OpenStreetMap. All progress saved to localStorage.

const STORAGE_KEY = 'sf-playgrounds-v1';
const POI_CACHE_KEY = 'sf-poi-cache-v1';

const POI_TAGS = {
  restaurant: { q: 'amenity=restaurant', emoji: '🍽', color: '#e76f51' },
  ice_cream:  { q: 'amenity=ice_cream',  emoji: '🍦', color: '#ec7ad6' },
  park:       { q: 'leisure=park',       emoji: '🌳', color: '#3a8c4a' },
  museum:     { q: 'tourism=museum',     emoji: '🏛', color: '#8a6dbe' },
  library:    { q: 'amenity=library',    emoji: '📚', color: '#4a6fa5' },
  cafe:       { q: 'amenity=cafe',       emoji: '☕', color: '#8a5a3b' },
};

const BADGES = [
  { id: 'first',     label: '🌟 First visit',   need: p => p.count >= 1 },
  { id: 'five',      label: '🖐 5 visited',     need: p => p.count >= 5 },
  { id: 'ten',       label: '🔟 10 visited',    need: p => p.count >= 10 },
  { id: 'twentyfive',label: '🎯 25 visited',    need: p => p.count >= 25 },
  { id: 'fifty',     label: '🏆 50 visited',    need: p => p.count >= 50 },
  { id: 'half',      label: '🥈 Half the city', need: p => p.count >= p.total/2 },
  { id: 'all',       label: '👑 All visited!',  need: p => p.count >= p.total },
];

// ---------- State ----------
let playgrounds = [];
let libraries = [];
let librariesLayer = null;
let museums = [];
let museumsLayer = null;
let restrooms = [];
let restroomsLayer = null;
let pools = [];
let poolsLayer = null;
let beaches = [];
let beachesLayer = null;
let iceCream = [];
let iceCreamLayer = null;
let microclimates = [];
let weatherLayer = null;
let weatherCache = JSON.parse(localStorage.getItem('sf-weather-cache-v1') || 'null'); // { fetchedAt, byId: {id: {...}} }
let weatherTimer = null;
let progress = loadProgress();   // { id: { visited, rating, notes, date } }
let map, cluster, markersById = {}, activeId = null;
let trip = [];
let tripPolyline = null;
let poiLayer = null;
let poiCache = JSON.parse(localStorage.getItem(POI_CACHE_KEY) || '{}');

// ---------- Init ----------
init();

async function init() {
  [playgrounds, libraries, museums, restrooms, pools, beaches, iceCream, microclimates] = await Promise.all([
    fetch('./data/playgrounds.json').then(r => r.json()),
    fetch('./data/libraries.json').then(r => r.json()).catch(() => []),
    fetch('./data/museums.json').then(r => r.json()).catch(() => []),
    fetch('./data/restrooms.json').then(r => r.json()).catch(() => []),
    fetch('./data/pools.json').then(r => r.json()).catch(() => []),
    fetch('./data/beaches.json').then(r => r.json()).catch(() => []),
    fetch('./data/ice_cream.json').then(r => r.json()).catch(() => []),
    fetch('./data/microclimates.json').then(r => r.json()).catch(() => []),
  ]);

  initMap();
  initMarkers();
  initLibraries();
  initMuseums();
  initSimpleOverlays();
  bindUI();
  renderList();
  updatePassport();

  // Open shared playground if URL hash present (e.g. #pg=mission-playground)
  const m = location.hash.match(/pg=([\w-]+)/);
  if (m) openDetail(m[1]);
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
function getP(id) {
  if (!progress[id]) progress[id] = { visited: false, rating: 0, notes: '', date: '' };
  return progress[id];
}

// ---------- Map ----------
function initMap() {
  map = L.map('map', { zoomControl: true, preferCanvas: true })
    .setView([37.7649, -122.4394], 12.5);
  L.control.zoom({ position: 'bottomright' }).remove(); // we kept the default top-right
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © CARTO',
    subdomains: 'abcd', maxZoom: 19,
  }).addTo(map);

  cluster = L.markerClusterGroup({
    maxClusterRadius: 35,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: makeClusterIcon,
  });
  map.addLayer(cluster);

  poiLayer = L.layerGroup().addTo(map);
  librariesLayer = L.layerGroup().addTo(map);
  museumsLayer = L.layerGroup().addTo(map);
  // Note: restrooms/pools/beaches/iceCream layers are created lazily in
  // initSimpleOverlays() and added to the map only if the user toggles them on.
}

// Build a layer of small colored circle markers for a simple overlay (no
// per-feature progress, just a list of locations).
function buildSimpleOverlay(items, opts) {
  const layer = L.layerGroup();
  items.forEach(it => {
    if (typeof it.lat !== 'number' || typeof it.lng !== 'number') return;
    const marker = L.circleMarker([it.lat, it.lng], {
      radius: opts.radius || 6,
      color: '#ffffff',
      weight: 2,
      fillColor: opts.color,
      fillOpacity: 0.95,
      className: opts.className || '',
    });
    const popup = opts.popup(it);
    marker.bindPopup(popup);
    if (opts.tooltip) marker.bindTooltip(opts.tooltip(it), { direction: 'top', offset: [0, -4] });
    layer.addLayer(marker);
  });
  return layer;
}

function initSimpleOverlays() {
  // Restrooms (slate-blue, smaller dots since there are many)
  restroomsLayer = buildSimpleOverlay(restrooms, {
    color: '#2c7a7b', radius: 5, className: 'restroom-dot-marker',
    popup: r => {
      const isPit = r.kind === 'pitstop';
      const icon = isPit ? '🚮' : '🚹';
      const label = isPit ? 'Pit Stop' : 'Park Restroom';
      const hours = r.hours ? `<br><span style="font-size:12px">${escapeHtml(r.hours)}</span>` : '';
      return `
        <strong>${icon} ${escapeHtml(r.name)}</strong><br>
        <span style="color:#66707b;font-size:12px">${escapeHtml(label)} ${escapeHtml(r.address || '')}</span>${hours}<br>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}" target="_blank" rel="noopener">Directions</a>
      `;
    },
    tooltip: r => `${r.kind === 'pitstop' ? '🚮' : '🚹'} ${r.name}`,
  });

  // Pools (deep blue)
  poolsLayer = buildSimpleOverlay(pools, {
    color: '#0f6dcf', className: 'pool-dot-marker',
    popup: p => `
      <strong>🏊 ${escapeHtml(p.name)}</strong><br>
      <span style="color:#66707b;font-size:12px">${escapeHtml(p.address)}</span><br>
      <span style="font-size:12px">${escapeHtml(p.blurb || '')}</span><br>
      <a href="${p.url}" target="_blank" rel="noopener">Pool info</a> ·
      <a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener">Directions</a>
    `,
    tooltip: p => `🏊 ${p.name}`,
  });

  // Beaches (sandy yellow/tan)
  beachesLayer = buildSimpleOverlay(beaches, {
    color: '#d9a441', className: 'beach-dot-marker',
    popup: b => `
      <strong>🏖 ${escapeHtml(b.name)}</strong><br>
      <span style="color:#66707b;font-size:12px">${escapeHtml(b.address || '')}</span><br>
      <span style="font-size:12px">${escapeHtml(b.blurb || '')}</span><br>
      <a href="${b.url}" target="_blank" rel="noopener">Beach info</a> ·
      <a href="https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}" target="_blank" rel="noopener">Directions</a>
    `,
    tooltip: b => `🏖 ${b.name}`,
  });

  // Ice cream (pink)
  iceCreamLayer = buildSimpleOverlay(iceCream, {
    color: '#ec7ad6', className: 'icecream-dot-marker',
    popup: ic => `
      <strong>🍦 ${escapeHtml(ic.name)}</strong><br>
      <span style="color:#66707b;font-size:12px">${escapeHtml(ic.address)}</span><br>
      <span style="font-size:12px">${escapeHtml(ic.blurb || '')}</span><br>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${ic.lat},${ic.lng}" target="_blank" rel="noopener">Directions</a>
    `,
    tooltip: ic => `🍦 ${ic.name}`,
  });
}

// ---------- Weather (microclimate chips) ----------
// WMO weather code → emoji + short label
// https://open-meteo.com/en/docs (search "WMO Weather interpretation codes")
const WMO = {
  0:  { e: '☀️', t: 'Clear' },
  1:  { e: '🌤', t: 'Mostly clear' },
  2:  { e: '⛅', t: 'Partly cloudy' },
  3:  { e: '☁️', t: 'Overcast' },
  45: { e: '🌫', t: 'Fog' },
  48: { e: '🌫', t: 'Freezing fog' },
  51: { e: '🌦', t: 'Light drizzle' },
  53: { e: '🌦', t: 'Drizzle' },
  55: { e: '🌧', t: 'Heavy drizzle' },
  61: { e: '🌧', t: 'Light rain' },
  63: { e: '🌧', t: 'Rain' },
  65: { e: '🌧', t: 'Heavy rain' },
  71: { e: '🌨', t: 'Light snow' },
  73: { e: '🌨', t: 'Snow' },
  75: { e: '❄️', t: 'Heavy snow' },
  80: { e: '🌦', t: 'Showers' },
  81: { e: '🌧', t: 'Showers' },
  82: { e: '⛈', t: 'Heavy showers' },
  95: { e: '⛈', t: 'Thunderstorm' },
  96: { e: '⛈', t: 'Thunderstorm w/ hail' },
  99: { e: '⛈', t: 'Severe thunderstorm' },
};
function wmoInfo(code) { return WMO[code] || { e: '·', t: 'Unknown' }; }

async function fetchMicroclimateWeather() {
  // Open-Meteo accepts comma-separated lat/lng for a single multi-location request.
  if (!microclimates.length) return null;
  const lats = microclimates.map(z => z.lat).join(',');
  const lngs = microclimates.map(z => z.lng).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
              '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m' +
              '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Los_Angeles';
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather fetch failed: ' + res.status);
  const data = await res.json();
  // When you pass multiple coords, Open-Meteo returns an array of forecast objects.
  const arr = Array.isArray(data) ? data : [data];
  const byId = {};
  microclimates.forEach((zone, i) => {
    const cur = arr[i] && arr[i].current;
    if (!cur) return;
    byId[zone.id] = {
      temp: Math.round(cur.temperature_2m),
      code: cur.weather_code,
      wind: Math.round(cur.wind_speed_10m),
      humidity: Math.round(cur.relative_humidity_2m),
      time: cur.time,
    };
  });
  return { fetchedAt: Date.now(), byId };
}

function renderWeatherChips() {
  if (!weatherLayer) weatherLayer = L.layerGroup();
  weatherLayer.clearLayers();
  if (!weatherCache || !weatherCache.byId) return;
  microclimates.forEach(zone => {
    const w = weatherCache.byId[zone.id];
    if (!w) return;
    const info = wmoInfo(w.code);
    const html = `
      <div class="wx-chip" data-temp="${tempBucket(w.temp)}" title="${escapeHtml(zone.name)} — ${info.t}, ${w.temp}°F, ${w.wind} mph wind, ${w.humidity}% humidity">
        <span class="wx-emoji">${info.e}</span><span class="wx-temp">${w.temp}°</span>
        <span class="wx-name">${escapeHtml(zone.name)}</span>
      </div>`;
    const icon = L.divIcon({ className: 'wx-icon', html, iconSize: null, iconAnchor: [0, 0] });
    const marker = L.marker([zone.lat, zone.lng], { icon, interactive: true, keyboard: false });
    marker.bindPopup(`
      <strong>${escapeHtml(zone.name)}</strong><br>
      <span style="font-size:14px">${info.e} ${info.t} · <strong>${w.temp}°F</strong></span><br>
      <span style="color:#66707b;font-size:12px">Wind ${w.wind} mph · Humidity ${w.humidity}%</span><br>
      <span style="color:#66707b;font-size:11px">Updated ${formatRelativeTime(weatherCache.fetchedAt)}</span><br>
      <span style="color:#aaa;font-size:11px">Source: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></span>
    `);
    weatherLayer.addLayer(marker);
  });
}

function tempBucket(t) {
  if (t == null) return 'mid';
  if (t < 55) return 'cool';
  if (t < 65) return 'mild';
  if (t < 75) return 'warm';
  return 'hot';
}

function formatRelativeTime(ts) {
  if (!ts) return 'just now';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'just now';
  if (min === 1) return '1 min ago';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  return `${hr} hr ago`;
}

async function refreshWeather(force = false) {
  // Use cache if it's < 15 min old and not forced.
  const fresh = weatherCache && (Date.now() - weatherCache.fetchedAt) < 15 * 60 * 1000;
  if (!fresh || force) {
    try {
      const data = await fetchMicroclimateWeather();
      if (data) {
        weatherCache = data;
        localStorage.setItem('sf-weather-cache-v1', JSON.stringify(weatherCache));
      }
    } catch (err) {
      console.warn('Weather fetch failed, using cached data if any:', err);
    }
  }
  renderWeatherChips();
}

function startWeatherUpdates() {
  refreshWeather();
  if (weatherTimer) clearInterval(weatherTimer);
  // Refresh every 15 minutes while the toggle is on.
  weatherTimer = setInterval(() => refreshWeather(true), 15 * 60 * 1000);
}
function stopWeatherUpdates() {
  if (weatherTimer) { clearInterval(weatherTimer); weatherTimer = null; }
}

function initMuseums() {
  museums.forEach(mu => {
    const marker = L.circleMarker([mu.lat, mu.lng], {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: '#8a6dbe',
      fillOpacity: 0.95,
      className: 'museum-dot-marker',
    });
    const popup = `
      <strong>🏛 ${escapeHtml(mu.name)}</strong><br>
      <span style="color:#66707b;font-size:12px">${escapeHtml(mu.address)}</span><br>
      <span style="font-size:12px">${escapeHtml(mu.blurb || '')}</span><br>
      <a href="${mu.url}" target="_blank" rel="noopener">Visit website</a> ·
      <a href="https://www.google.com/maps/dir/?api=1&destination=${mu.lat},${mu.lng}" target="_blank" rel="noopener">Directions</a>
    `;
    marker.bindPopup(popup);
    marker.bindTooltip(`🏛 ${mu.name}`, { direction: 'top', offset: [0, -4] });
    museumsLayer.addLayer(marker);
  });
}

function initLibraries() {
  libraries.forEach(lib => {
    const marker = L.circleMarker([lib.lat, lib.lng], {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: '#1e88ff',
      fillOpacity: 0.95,
      className: 'library-dot',
    });
    const popup = `
      <strong>📚 ${escapeHtml(lib.name)} Branch Library</strong><br>
      <span style="color:#66707b;font-size:12px">${escapeHtml(lib.address)}, SF ${escapeHtml(lib.zipcode)}</span><br>
      <a href="https://sfpl.org/locations" target="_blank" rel="noopener">Hours & info</a> ·
      <a href="https://www.google.com/maps/dir/?api=1&destination=${lib.lat},${lib.lng}" target="_blank" rel="noopener">Directions</a>
    `;
    marker.bindPopup(popup);
    marker.bindTooltip(`📚 ${lib.name}`, { direction: 'top', offset: [0, -4] });
    librariesLayer.addLayer(marker);
  });
}

function initMarkers() {
  playgrounds.forEach(p => {
    const m = L.marker([p.lat, p.lng], { icon: makePinIcon(p), title: p.name });
    m._pgId = p.id;
    m.on('click', () => { openDetail(p.id); });
    markersById[p.id] = m;
    cluster.addLayer(m);
  });
}

function makePinIcon(p) {
  const visited = !!progress[p.id]?.visited;
  const featured = !!p.note;
  const inTrip = trip.includes(p.id);
  const isNps = p.operator && p.operator !== 'SF Rec & Park';
  const cls = ['pg-marker'];
  if (visited) cls.push('visited');
  else if (isNps) cls.push('nps');
  else if (featured) cls.push('featured');
  if (inTrip) cls.push('trip');
  if (activeId === p.id) cls.push('active');
  const emoji = visited ? '✓' : (isNps ? '🌲' : (featured ? '★' : ''));
  return L.divIcon({
    className: '', iconSize: [30, 38], iconAnchor: [15, 36], popupAnchor: [0, -32],
    html: `<div class="${cls.join(' ')}"><div class="pin"><span>${emoji}</span></div></div>`,
  });
}

function refreshMarker(id) {
  const m = markersById[id];
  const p = playgrounds.find(x => x.id === id);
  if (m && p) m.setIcon(makePinIcon(p));
  // Force the cluster group to re-evaluate cluster icons (so the bubble color
  // updates when its last unvisited child becomes visited).
  if (cluster && cluster.refreshClusters) cluster.refreshClusters();
}

function makeClusterIcon(c) {
  const children = c.getAllChildMarkers();
  const total = children.length;
  let visited = 0;
  children.forEach(m => {
    // each marker has a `title` set to the playground name; we tagged the
    // playground id on the marker via `_pgId` for fast lookup
    if (progress[m._pgId]?.visited) visited += 1;
  });
  const allVisited = visited === total && total > 0;
  const someVisited = visited > 0 && !allVisited;
  const cls = ['marker-cluster'];
  if (total < 10) cls.push('marker-cluster-small');
  else if (total < 100) cls.push('marker-cluster-medium');
  else cls.push('marker-cluster-large');
  if (allVisited) cls.push('cluster-all-visited');
  else if (someVisited) cls.push('cluster-partial');
  // Tooltip-style label: "3 / 5" when partial, just total otherwise
  const label = someVisited ? `${visited}/${total}` : `${total}`;
  return L.divIcon({
    html: `<div><span>${label}</span></div>`,
    className: cls.join(' '),
    iconSize: L.point(40, 40),
  });
}

// ---------- UI binding ----------
function bindUI() {
  document.getElementById('searchInput').addEventListener('input', renderList);
  ['fltVisited','fltUnvisited','fltAccessible','fltRestroom','fltTrip']
    .forEach(id => document.getElementById(id).addEventListener('change', renderList));

  document.getElementById('surpriseBtn').addEventListener('click', surpriseMe);
  document.getElementById('nearestBtn').addEventListener('click', findNearest);

  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importData);

  document.querySelectorAll('.layerToggle').forEach(el => el.addEventListener('change', refreshPOIs));
  document.getElementById('radiusSel').addEventListener('change', refreshPOIs);

  // SFPL libraries toggle
  const libToggle = document.getElementById('fltLibraries');
  const libCount = document.getElementById('libCount');
  if (libCount) libCount.textContent = libraries.length ? `(${libraries.length})` : '';
  if (libToggle) libToggle.addEventListener('change', () => {
    if (libToggle.checked) map.addLayer(librariesLayer);
    else map.removeLayer(librariesLayer);
  });

  // Museums toggle
  const muToggle = document.getElementById('fltMuseums');
  const muCount = document.getElementById('muCount');
  if (muCount) muCount.textContent = museums.length ? `(${museums.length})` : '';
  if (muToggle) muToggle.addEventListener('change', () => {
    if (muToggle.checked) map.addLayer(museumsLayer);
    else map.removeLayer(museumsLayer);
  });

  // Generic on-demand overlay toggles (default off — they're noisy if all on).
  // Each entry: [toggleId, countId, items array, layer reference]
  const simpleOverlays = [
    { toggleId: 'fltRestrooms', countId: 'rrCount',  items: restrooms, getLayer: () => restroomsLayer },
    { toggleId: 'fltPools',     countId: 'poolCount', items: pools,    getLayer: () => poolsLayer },
    { toggleId: 'fltBeaches',   countId: 'beachCount', items: beaches, getLayer: () => beachesLayer },
    { toggleId: 'fltIceCream',  countId: 'icCount',   items: iceCream, getLayer: () => iceCreamLayer },
  ];
  simpleOverlays.forEach(o => {
    const toggle = document.getElementById(o.toggleId);
    const count = document.getElementById(o.countId);
    if (count) count.textContent = o.items.length ? `(${o.items.length})` : '';
    if (!toggle) return;
    // Apply initial state (in case user reloaded with checkbox already checked)
    if (toggle.checked) map.addLayer(o.getLayer());
    toggle.addEventListener('change', () => {
      const layer = o.getLayer();
      if (toggle.checked) map.addLayer(layer);
      else map.removeLayer(layer);
    });
  });

  // Weather (microclimate chips). Live data, default off.
  const wxToggle = document.getElementById('fltWeather');
  const wxCount = document.getElementById('wxCount');
  if (wxCount) wxCount.textContent = microclimates.length ? `(${microclimates.length} zones)` : '';
  if (wxToggle) {
    wxToggle.addEventListener('change', async () => {
      if (wxToggle.checked) {
        await refreshWeather();              // populates weatherCache + builds weatherLayer
        if (weatherLayer) map.addLayer(weatherLayer);
        startWeatherUpdates();
      } else {
        if (weatherLayer) map.removeLayer(weatherLayer);
        stopWeatherUpdates();
      }
    });
  }

  const toggleBtn = document.getElementById('toggleSidebar');
  const toggleIcon = document.getElementById('toggleIcon');
  const updateToggleIcon = () => {
    if (toggleIcon) toggleIcon.textContent = document.body.classList.contains('sb-open') ? '✕' : '☰';
  };
  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('sb-open');
    updateToggleIcon();
  });
  // Close sidebar when tapping the backdrop on mobile
  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('sb-open')) return;
    if (window.innerWidth > 760) return;
    const sidebar = document.getElementById('sidebar');
    if (sidebar.contains(e.target)) return;
    if (toggleBtn.contains(e.target)) return;
    // Tap on map / backdrop closes sidebar
    document.body.classList.remove('sb-open');
    updateToggleIcon();
  });

  // Detail dialog wiring
  const dlg = document.getElementById('detail');
  document.getElementById('dVisited').addEventListener('change', e => {
    const id = dlg.dataset.id; if (!id) return;
    const p = getP(id);
    p.visited = e.target.checked;
    if (p.visited && !p.date) p.date = new Date().toISOString().slice(0,10);
    document.getElementById('dDate').value = p.date || '';
    saveProgress();
    refreshMarker(id);
    renderList();
    updatePassport();
    if (p.visited) toast('🎉 Marked as visited');
  });
  document.getElementById('dNotes').addEventListener('input', e => {
    const id = dlg.dataset.id; if (!id) return;
    getP(id).notes = e.target.value; saveProgress();
  });
  document.getElementById('dDate').addEventListener('change', e => {
    const id = dlg.dataset.id; if (!id) return;
    getP(id).date = e.target.value; saveProgress();
  });
  document.getElementById('dStars').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const id = dlg.dataset.id; if (!id) return;
    const r = +btn.dataset.r;
    const p = getP(id);
    p.rating = (p.rating === r) ? 0 : r;
    saveProgress();
    paintStars(p.rating);
  });
  document.getElementById('dDirections').addEventListener('click', () => {
    const id = dlg.dataset.id; const p = playgrounds.find(x => x.id === id);
    if (!p) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`, '_blank');
  });
  document.getElementById('dStreetView').addEventListener('click', () => {
    const id = dlg.dataset.id; const p = playgrounds.find(x => x.id === id);
    if (!p) return;
    // Google Maps Street View URL — no API key needed, works on web + iOS/Android
    // Format: ?api=1&map_action=pano&viewpoint=lat,lng
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.lat},${p.lng}`, '_blank');
  });
  document.getElementById('dTrip').addEventListener('click', () => {
    const id = dlg.dataset.id; if (!id) return;
    toggleTrip(id);
  });

  dlg.addEventListener('close', () => {
    // Keep activeId set so the layer/POI controls still work for that playground;
    // user can clear it by clicking the map or another playground.
    history.replaceState(null, '', location.pathname + location.search);
  });
}

// ---------- List rendering ----------
function renderList() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const onlyVisited = document.getElementById('fltVisited').checked;
  const onlyUnvisited = document.getElementById('fltUnvisited').checked;
  const onlyAcc = document.getElementById('fltAccessible').checked;
  const onlyRestroom = document.getElementById('fltRestroom').checked;
  const onlyTrip = document.getElementById('fltTrip').checked;

  const filtered = playgrounds.filter(p => {
    if (q && !p.name.toLowerCase().includes(q)) return false;
    const v = !!progress[p.id]?.visited;
    if (onlyVisited && !v) return false;
    if (onlyUnvisited && v) return false;
    if (onlyAcc && (!p.accessibility || p.accessibility.length === 0)) return false;
    if (onlyRestroom && !(p.accessibility || []).some(a => a.includes('Restroom'))) return false;
    if (onlyTrip && !trip.includes(p.id)) return false;
    return true;
  });

  // Sort: visited last, then alpha
  filtered.sort((a,b) => {
    const av = progress[a.id]?.visited ? 1 : 0;
    const bv = progress[b.id]?.visited ? 1 : 0;
    if (av !== bv) return av - bv;
    return a.name.localeCompare(b.name);
  });

  const ul = document.getElementById('playgroundList');
  ul.innerHTML = '';
  filtered.forEach(p => {
    const li = document.createElement('li');
    const visited = !!progress[p.id]?.visited;
    li.className = 'pg-item' + (visited ? ' visited' : '') + (activeId === p.id ? ' active' : '');
    li.innerHTML = `
      <div class="pg-check">${visited ? '✓' : ''}</div>
      <div class="pg-text">
        <div class="pg-name">${escapeHtml(p.name)}</div>
        <div class="pg-meta">
          ${p.address ? `<span>${escapeHtml(p.address)}</span>` : ''}
          ${p.operator && p.operator !== 'SF Rec & Park' ? `<span class="dot">•</span><span>🌲 NPS</span>` : ''}
          ${p.accessibility?.length ? `<span class="dot">•</span><span>♿ ADA</span>` : ''}
          ${p.note ? `<span class="dot">•</span><span>★ Featured</span>` : ''}
          ${trip.includes(p.id) ? `<span class="dot">•</span><span>🚶 In trip</span>` : ''}
        </div>
      </div>
    `;
    li.addEventListener('click', () => { openDetail(p.id); });
    ul.appendChild(li);
  });
  document.getElementById('listCount').textContent = filtered.length;
}

// ---------- Passport / badges ----------
function updatePassport() {
  const total = playgrounds.length;
  const count = playgrounds.filter(p => progress[p.id]?.visited).length;
  document.getElementById('progCount').textContent = count;
  document.getElementById('progTotal').textContent = total;
  const ring = document.getElementById('progRing');
  const circ = 2 * Math.PI * 34;
  ring.style.strokeDashoffset = circ * (1 - count / total);

  const row = document.getElementById('badgeRow');
  row.innerHTML = '';
  BADGES.forEach(b => {
    const earned = b.need({ count, total });
    const el = document.createElement('span');
    el.className = 'badge' + (earned ? '' : ' locked');
    el.textContent = b.label;
    row.appendChild(el);
  });
}

// ---------- Detail ----------
function openDetail(id) {
  const p = playgrounds.find(x => x.id === id);
  if (!p) return;
  if (activeId && activeId !== id) refreshMarker(activeId);
  activeId = id;
  refreshMarker(id);

  const dlg = document.getElementById('detail');
  dlg.dataset.id = id;
  document.getElementById('dName').textContent = p.name;
  const operatorLine = p.operator && p.operator !== 'SF Rec & Park' ? ` · 🌲 ${p.operator}` : '';
  document.getElementById('dAddr').textContent = ([p.address, p.zipcode].filter(Boolean).join(' · ') || 'San Francisco, CA') + operatorLine;

  const pp = getP(id);
  document.getElementById('dVisited').checked = pp.visited;
  document.getElementById('dNotes').value = pp.notes || '';
  document.getElementById('dDate').value = pp.date || '';
  paintStars(pp.rating);

  const accBox = document.getElementById('dAccess');
  accBox.innerHTML = (p.accessibility || []).map(a => `<span class="tag-pill">♿ ${escapeHtml(a)}</span>`).join('');
  document.getElementById('dNote').textContent = p.note || '';

  document.getElementById('dTrip').textContent = trip.includes(id) ? '✓ In trip (remove)' : '➕ Add to trip';

  // Pan map
  map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });

  // POIs around this playground
  refreshPOIs();

  dlg.showModal();
  history.replaceState(null, '', `${location.pathname}#pg=${id}`);
  renderList();
}

function paintStars(r) {
  document.querySelectorAll('#dStars button').forEach(b => {
    b.classList.toggle('on', +b.dataset.r <= r);
  });
}

// ---------- Surprise me / Nearest ----------
function surpriseMe() {
  const candidates = playgrounds.filter(p => !progress[p.id]?.visited);
  if (candidates.length === 0) {
    toast("You've visited them all! 👑"); return;
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  openDetail(pick.id);
  toast(`🎲 Try: ${pick.name}`);
}

function findNearest() {
  if (!navigator.geolocation) { toast('Geolocation not available'); return; }
  toast('📍 Finding your location…');
  navigator.geolocation.getCurrentPosition(pos => {
    const me = [pos.coords.latitude, pos.coords.longitude];
    L.circleMarker(me, { radius: 7, color: '#1e88ff', fillColor: '#1e88ff', fillOpacity: 0.6 }).addTo(map);
    const sorted = playgrounds.map(p => ({ p, d: dist(me, [p.lat, p.lng]) }))
      .sort((a,b) => a.d - b.d);
    const nearest = sorted[0].p;
    openDetail(nearest.id);
    toast(`📍 Nearest: ${nearest.name} (${(sorted[0].d/1609).toFixed(2)} mi)`);
  }, () => toast('Could not get location'));
}

function dist([lat1, lng1], [lat2, lng2]) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1)*Math.PI/180, Δλ = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ---------- Trip planner ----------
function toggleTrip(id) {
  const i = trip.indexOf(id);
  if (i >= 0) { trip.splice(i, 1); toast('Removed from trip'); }
  else { trip.push(id); toast(`Added to trip (${trip.length})`); }
  document.getElementById('dTrip').textContent = trip.includes(id) ? '✓ In trip (remove)' : '➕ Add to trip';
  refreshMarker(id);
  drawTripRoute();
  renderList();
  updateTripInfo();
}

function drawTripRoute() {
  if (tripPolyline) { map.removeLayer(tripPolyline); tripPolyline = null; }
  if (trip.length < 2) return;
  const coords = trip.map(id => {
    const p = playgrounds.find(x => x.id === id);
    return [p.lat, p.lng];
  });
  tripPolyline = L.polyline(coords, { color: '#5b6bff', weight: 4, dashArray: '8 6', opacity: 0.85 }).addTo(map);
}

function updateTripInfo() {
  const info = document.getElementById('tripInfo');
  if (trip.length === 0) { info.textContent = ''; return; }
  let total = 0;
  for (let i = 1; i < trip.length; i++) {
    const a = playgrounds.find(x => x.id === trip[i-1]);
    const b = playgrounds.find(x => x.id === trip[i]);
    total += dist([a.lat, a.lng], [b.lat, b.lng]);
  }
  info.textContent = `${trip.length} stop${trip.length>1?'s':''} · ${(total/1609).toFixed(1)} mi`;
}

// ---------- POIs (Overpass API) ----------
async function refreshPOIs() {
  poiLayer.clearLayers();
  if (!activeId) return;
  const enabled = [...document.querySelectorAll('.layerToggle:checked')].map(el => el.dataset.layer);
  if (enabled.length === 0) return;
  const p = playgrounds.find(x => x.id === activeId);
  const radius = +document.getElementById('radiusSel').value;

  // Draw radius circle
  L.circle([p.lat, p.lng], { radius, color: '#5b6bff', weight: 1, fillOpacity: 0.04, dashArray: '4 4' }).addTo(poiLayer);

  for (const layer of enabled) {
    try {
      const items = await fetchPOIs(p.lat, p.lng, radius, layer);
      const cfg = POI_TAGS[layer];
      items.forEach(it => {
        const icon = L.divIcon({
          className: '', iconSize: [22, 22],
          html: `<div class="poi-icon" style="border-color:${cfg.color}">${cfg.emoji}</div>`,
        });
        L.marker([it.lat, it.lng], { icon })
          .bindPopup(`<strong>${escapeHtml(it.name || cfg.emoji)}</strong><br><a href="https://www.google.com/maps/dir/?api=1&destination=${it.lat},${it.lng}" target="_blank">Directions</a>`)
          .addTo(poiLayer);
      });
    } catch (e) {
      console.warn('POI fetch failed', layer, e);
    }
  }
}

async function fetchPOIs(lat, lng, radius, layer) {
  const cfg = POI_TAGS[layer];
  const key = `${layer}|${lat.toFixed(4)}|${lng.toFixed(4)}|${radius}`;
  if (poiCache[key]) return poiCache[key];

  const query = `[out:json][timeout:15];
    (node[${cfg.q}](around:${radius},${lat},${lng});
     way[${cfg.q}](around:${radius},${lat},${lng});
    );
    out center 60;`;
  const url = 'https://overpass-api.de/api/interpreter';
  const resp = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query) });
  if (!resp.ok) throw new Error('Overpass error');
  const data = await resp.json();
  const items = data.elements.map(e => ({
    name: e.tags?.name,
    lat: e.lat ?? e.center?.lat,
    lng: e.lon ?? e.center?.lon,
  })).filter(x => x.lat && x.lng);
  poiCache[key] = items;
  // Keep cache small
  const keys = Object.keys(poiCache);
  if (keys.length > 200) delete poiCache[keys[0]];
  localStorage.setItem(POI_CACHE_KEY, JSON.stringify(poiCache));
  return items;
}

// ---------- Export / Import ----------
function exportData() {
  const blob = new Blob([JSON.stringify({ progress, trip, exported: new Date().toISOString() }, null, 2)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sf-playground-progress-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  toast('⬇︎ Progress exported');
}

function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.progress) progress = data.progress;
      if (Array.isArray(data.trip)) trip = data.trip;
      saveProgress();
      Object.keys(markersById).forEach(refreshMarker);
      drawTripRoute(); updateTripInfo();
      renderList(); updatePassport();
      toast('⬆︎ Progress imported');
    } catch { toast('Could not read file'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ---------- Helpers ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
