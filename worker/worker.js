// danzoa.com's own dedicated Worker: serves the real MVP (pirouette
// rotation-consistency analyzer, ../mvp) instead of falling through to
// mobley-venture-fleet-a's generic placeholder. Replaces a prior
// "danzoa-com-worker" deploy that was a fabricated stub - see wrangler.toml
// comment. Pattern reused from the mhslp-staging asset-worker scaffold -
// adds basic security headers and sane cache-control on top of static
// asset serving.

function securedHeaders(source, additions = {}) {
  const headers = new Headers(source);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('X-Venture', 'danzoa.com');
  for (const [name, value] of Object.entries(additions)) headers.set(name, value);
  return headers;
}

function cacheControl(url, response) {
  const type = response.headers.get('Content-Type') || '';
  const documentLike = url.pathname.endsWith('/')
    || url.pathname.endsWith('.html')
    || type.includes('text/html');
  return documentLike ? 'no-cache' : 'public, max-age=3600';
}

function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: securedHeaders({}, { 'Content-Type': 'application/json' })
  });
}

// Real lead capture, not a decorative form: the registry's own next_step
// for this venture is "a named dance instructor/studio to try it, not
// more building" - this is the missing piece that lets a real visitor
// who wants that actually leave contact info, backed by a real D1 table
// (danzoa_com_leads), not a mailto: link or a fake success message.
async function handleInterest(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON body' }, 400);
  }
  const email = String(body?.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'a valid email is required' }, 400);
  }
  const studioName = typeof body?.studio_name === 'string' ? body.studio_name.slice(0, 200) : null;
  const note = typeof body?.note === 'string' ? body.note.slice(0, 1000) : null;
  try {
    await env.LEADS_DB.prepare(
      'INSERT INTO leads (id, email, studio_name, note, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING'
    ).bind(crypto.randomUUID(), email, studioName, note, new Date().toISOString()).run();
    return jsonResponse({ ok: true }, 201);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/interest' && request.method === 'POST') {
      return handleInterest(request, env);
    }
    if (url.pathname === '/api/interest') {
      return jsonResponse({ error: 'method not allowed' }, 405);
    }

    const asset = await env.ASSETS.fetch(request);
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers: securedHeaders(asset.headers, {
        'Cache-Control': cacheControl(url, asset)
      })
    });
  }
};
