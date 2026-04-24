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
let progress = loadProgress();   // { id: { visited, rating, notes, date } }
let map, cluster, markersById = {}, activeId = null;
let trip = [];
let tripPolyline = null;
let poiLayer = null;
let poiCache = JSON.parse(localStorage.getItem(POI_CACHE_KEY) || '{}');

// ---------- Init ----------
init();

async function init() {
  playgrounds = await fetch('./data/playgrounds.json').then(r => r.json());

  initMap();
  initMarkers();
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
  });
  map.addLayer(cluster);

  poiLayer = L.layerGroup().addTo(map);
}

function initMarkers() {
  playgrounds.forEach(p => {
    const m = L.marker([p.lat, p.lng], { icon: makePinIcon(p), title: p.name });
    m.on('click', () => { openDetail(p.id); });
    markersById[p.id] = m;
    cluster.addLayer(m);
  });
}

function makePinIcon(p) {
  const visited = !!progress[p.id]?.visited;
  const featured = !!p.note;
  const inTrip = trip.includes(p.id);
  const cls = ['pg-marker'];
  if (visited) cls.push('visited');
  else if (featured) cls.push('featured');
  if (inTrip) cls.push('trip');
  if (activeId === p.id) cls.push('active');
  const emoji = visited ? '✓' : (featured ? '★' : '');
  return L.divIcon({
    className: '', iconSize: [30, 38], iconAnchor: [15, 36], popupAnchor: [0, -32],
    html: `<div class="${cls.join(' ')}"><div class="pin"><span>${emoji}</span></div></div>`,
  });
}

function refreshMarker(id) {
  const m = markersById[id];
  const p = playgrounds.find(x => x.id === id);
  if (m && p) m.setIcon(makePinIcon(p));
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

  document.getElementById('toggleSidebar').addEventListener('click', () => document.body.classList.toggle('sb-open'));

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
  document.getElementById('dAddr').textContent = [p.address, p.zipcode].filter(Boolean).join(' · ') || 'San Francisco, CA';

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
