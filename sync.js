// Optional Google sign-in + cloud sync via Supabase. The app works fully without it.
const SUPABASE_URL = 'https://tequqbsozjxbxetowxkr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CKripIzthLv30KeaLQSr2Q_THl-oxyw'; // public by design; protected by RLS
const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Newest-edit-wins merge, per playground. Entries without ts count as oldest.
export function mergeProgress(local, cloud) {
  const out = { ...cloud };
  for (const [id, l] of Object.entries(local || {})) {
    const empty = !l.visited && !l.rating && !l.notes && !l.date;
    if (empty) continue;
    const c = out[id];
    if (!c || (l.ts || 0) > (c.ts || 0)) out[id] = l;
  }
  return out;
}

const $ = id => document.getElementById(id);
let sb, user, pushTimer, applying = false;

function status(msg) { const el = $('syncStatus'); if (el) el.textContent = msg; }

function render() {
  const btn = $('authBtn'); if (!btn) return;
  if (user) {
    btn.textContent = 'Sign out';
    status('☁︎ Synced · ' + (user.email || ''));
  } else {
    btn.textContent = 'Sign in with Google to sync';
    status('Progress is saved on this device only');
  }
}

async function pull() {
  const { data, error } = await sb.from('user_progress').select('data').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  const cloud = data?.data || {};
  const st = window.__pp.getState();
  const merged = mergeProgress(st.progress, cloud.progress || {});
  const trip = st.trip?.length ? st.trip : (cloud.trip || []);
  applying = true;
  window.__pp.setState({ progress: merged, trip });
  applying = false;
  await push();
}

async function push() {
  if (!user || applying) return;
  status('☁︎ Saving…');
  const st = window.__pp.getState();
  const { error } = await sb.from('user_progress').upsert({
    user_id: user.id,
    data: { progress: st.progress, trip: st.trip },
    updated_at: new Date().toISOString(),
  });
  status(error ? '⚠︎ Sync failed – will retry' : '☁︎ Synced · ' + (user.email || ''));
  if (error) console.error(error);
}

async function init() {
  const btn = $('authBtn'); if (!btn) return;
  render();
  try {
    const { createClient } = await import(SDK);
    sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (e) { status('Sync unavailable offline'); console.error(e); return; }

  btn.addEventListener('click', async () => {
    if (user) { await sb.auth.signOut(); return; }
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },
    });
  });

  window.addEventListener('progress-saved', () => {
    if (!user || applying) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1200);
  });
  window.addEventListener('online', () => push());

  sb.auth.onAuthStateChange(async (_evt, session) => {
    const prev = user;
    user = session?.user || null;
    render();
    if (user && !prev) { try { await pull(); } catch (e) { status('⚠︎ Sync failed'); console.error(e); } }
  });
}
if (typeof document !== 'undefined') init();
