// Supabase Edge Function: polar
// Polar AccessLink is free, but its token endpoint needs HTTP Basic auth with the client secret and
// does not allow browser requests. This function holds the secret and does the three jobs the app
// needs:
//   { action: "config" }                                        -> public client id for the consent screen
//   { action: "exchange", code, redirect_uri, member_id }       -> access token, and registers the user once
//   { action: "exercises", access_token, user_id }               -> the athlete's exercises
// Deploy:  supabase functions deploy polar
// Secrets: supabase secrets set POLAR_CLIENT_ID=... POLAR_CLIENT_SECRET=...

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CLIENT_ID = Deno.env.get('POLAR_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('POLAR_CLIENT_SECRET') ?? '';
const API = 'https://www.polaraccesslink.com';
const TOKEN_URL = 'https://polarremote.com/v2/oauth2/token';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const basic = () => btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

// One exercise, in the few fields the app needs. Polar names them with hyphens.
function short(x: any) {
  return {
    id: x?.id ?? '',
    start: x?.['start-time'] ?? null,
    seconds: x?.duration ?? null, // ISO 8601 duration, converted in the app
    distance: x?.distance ?? null, // metres
    hr: x?.['heart-rate']?.average ?? null,
    sport: x?.sport ?? '',
  };
}

// Fallback for clients that only expose the older transaction flow.
async function viaTransaction(uid: string, token: string) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const t = await fetch(`${API}/v3/users/${uid}/exercise-transactions`, { headers });
  if (t.status === 204) return [];
  if (!t.ok) return null;
  const tx = await t.json().catch(() => null);
  const uri = tx?.['resource-uri'], id = tx?.['transaction-id'];
  if (!uri) return [];
  const res = await fetch(uri, { headers });
  const d = await res.json().catch(() => null);
  if (id) await fetch(`${API}/v3/users/${uid}/exercise-transactions/${id}`, { method: 'PUT', headers }).catch(() => null);
  return Array.isArray(d) ? d : Array.isArray(d?.exercises) ? d.exercises : [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json({ error: 'Polar is not configured: set the POLAR_CLIENT_ID and POLAR_CLIENT_SECRET secrets.' }, 500);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Bad request body.' }, 400); }
  const action = String(body.action ?? '');

  if (action === 'config') return json({ client_id: CLIENT_ID });

  if (action === 'exchange') {
    const form = new URLSearchParams({ grant_type: 'authorization_code', code: String(body.code ?? '') });
    if (body.redirect_uri) form.set('redirect_uri', String(body.redirect_uri));
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: 'Basic ' + basic(),
      },
      body: form,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.access_token) {
      return json({ error: d?.error_description || d?.error || `Polar rejected the token request (${r.status}).` }, r.ok ? 400 : r.status);
    }
    // AccessLink must know the user before it will offer their data. 409 means it already does.
    const member = String(body.member_id ?? '');
    if (member) {
      await fetch(`${API}/v3/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${d.access_token}` },
        body: JSON.stringify({ 'member-id': member }),
      }).catch(() => null);
    }
    return json({ access_token: d.access_token, user_id: d.x_user_id });
  }

  if (action === 'exercises') {
    const token = String(body.access_token ?? ''), uid = String(body.user_id ?? '');
    if (!token || !uid) return json({ error: 'Missing access token or user id.' }, 400);
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const r = await fetch(`${API}/v3/users/${encodeURIComponent(uid)}/exercises`, { headers });

    if (r.status === 404) {
      const list = await viaTransaction(encodeURIComponent(uid), token);
      if (list === null) return json({ error: 'Polar did not offer an exercise list for this connection.' }, 404);
      return json({ exercises: list.map(short) });
    }
    if (r.status === 204) return json({ exercises: [] });
    if (r.status === 401) return json({ error: 'Polar rejected this connection. Disconnect and connect again.' }, 401);
    if (r.status === 403) return json({ error: 'Polar needs you to accept its data-sharing consents at account.polar.com, then connect again.' }, 403);

    const d = await r.json().catch(() => null);
    if (!r.ok) return json({ error: d?.message || d?.error || `Polar returned ${r.status}.` }, r.status);
    const list = Array.isArray(d) ? d : Array.isArray(d?.exercises) ? d.exercises : [];
    return json({ exercises: list.map(short) });
  }

  return json({ error: 'Unknown action.' }, 400);
});
