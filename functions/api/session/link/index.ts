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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

// POST /api/session/link
// body: { user_id: string (新设备的 id), sync_code: string }
// 效果：把新设备的 user_id 指向同步码对应的数据
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { user_id?: string; sync_code?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const { user_id, sync_code } = body;
  if (!user_id || !sync_code) return json({ error: 'missing fields' }, 400);

  const code = sync_code.toUpperCase().trim();

  // 找到同步码对应的原始记录
  const source = await env.lumina_reader_db
    .prepare('SELECT * FROM sessions WHERE sync_code = ?')
    .bind(code)
    .first<SessionRow>();

  if (!source) return json({ error: 'invalid sync code' }, 404);

  // 如果新设备 user_id 和源 user_id 相同，直接返回
  if (source.user_id === user_id) {
    return json({
      ok: true,
      session: JSON.parse(source.session_json),
      sync_code: source.sync_code,
    });
  }

  // 把新 user_id 也写入一条记录，共享同一个 sync_code 和数据
  // 注意：两台设备各自保存时都会更新自己的 user_id 行，sync_code 保持一致
  await env.lumina_reader_db
    .prepare(`
      INSERT INTO sessions (user_id, sync_code, session_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        sync_code = excluded.sync_code,
        session_json = excluded.session_json,
        updated_at = excluded.updated_at
    `)
    .bind(user_id, source.sync_code, source.session_json, Date.now())
    .run();

  return json({
    ok: true,
    session: JSON.parse(source.session_json),
    sync_code: source.sync_code,
  });
};
