interface Env {
  lumina_reader_db: D1Database;
}

interface SessionRow {
  user_id: string;
  sync_code: string;
  session_json: string;
  updated_at: number;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};

// GET /api/session?user_id=xxx
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  if (!userId) return json({ error: 'missing user_id' }, 400);

  const row = await env.lumina_reader_db
    .prepare('SELECT * FROM sessions WHERE user_id = ?')
    .bind(userId)
    .first<SessionRow>();

  if (!row) return json({ found: false });

  return json({
    found: true,
    sync_code: row.sync_code,
    session: JSON.parse(row.session_json),
    updated_at: row.updated_at,
  });
};

// POST /api/session  body: { user_id, session, sync_code? }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { user_id?: string; session?: unknown; sync_code?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const { user_id, session, sync_code } = body;
  if (!user_id || !session) return json({ error: 'missing fields' }, 400);

  // 生成或复用 sync_code（6位大写字母数字）
  let code = sync_code;
  if (!code) {
    const existing = await env.lumina_reader_db
      .prepare('SELECT sync_code FROM sessions WHERE user_id = ?')
      .bind(user_id)
      .first<{ sync_code: string }>();
    code = existing?.sync_code ?? generateCode(user_id);
  }

  await env.lumina_reader_db
    .prepare(`
      INSERT INTO sessions (user_id, sync_code, session_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        session_json = excluded.session_json,
        updated_at = excluded.updated_at
    `)
    .bind(user_id, code, JSON.stringify(session), Date.now())
    .run();

  return json({ ok: true, sync_code: code });
};

function generateCode(seed: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[hash % chars.length];
    hash = (hash * 1664525 + 1013904223) >>> 0;
  }
  return code;
}
