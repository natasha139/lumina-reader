import { emptyLibrary, mergeLibraries, normalizeLibrary, type ReadingLibrary } from '../../../src/lib/library';

interface LibraryRow { id: string; sync_code: string; library_json: string; revision: number }
interface LegacyRow { user_id: string; sync_code: string; session_json: string; updated_at: number }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const validDevice = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(id);
const result = (row: LibraryRow) => ({ ok: true, library: normalizeLibrary(JSON.parse(row.library_json)), sync_code: row.sync_code, revision: row.revision });

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(6))].map(n => chars[n % chars.length]).join('');
}

async function byDevice(db: D1Database, device: string) {
  return db.prepare(`SELECT l.* FROM reading_libraries l JOIN reading_devices d ON d.library_id = l.id WHERE d.device_id = ?`)
    .bind(device).first<LibraryRow>();
}

async function fromLegacy(db: D1Database, code: string): Promise<LibraryRow | null> {
  const existing = await db.prepare('SELECT * FROM reading_libraries WHERE sync_code = ?').bind(code).first<LibraryRow>();
  if (existing) return existing;
  const rows = await db.prepare('SELECT * FROM sessions WHERE sync_code = ? ORDER BY updated_at ASC').bind(code).all<LegacyRow>();
  if (!rows.results.length) return null;
  let library = emptyLibrary();
  for (const row of rows.results) {
    try {
      const imported = normalizeLibrary(JSON.parse(row.session_json));
      library = mergeLibraries(emptyLibrary(), imported, library);
    } catch { /* A damaged legacy row must not hide other intact records. */ }
  }
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO reading_libraries (id, sync_code, library_json, revision) VALUES (?, ?, ?, 0)').bind(id, code, JSON.stringify(library)),
    ...rows.results.map(row => db.prepare(`INSERT OR IGNORE INTO reading_devices (device_id, library_id)
      SELECT ?, id FROM reading_libraries WHERE sync_code = ?`).bind(row.user_id, code)),
  ]);
  return db.prepare('SELECT * FROM reading_libraries WHERE sync_code = ?').bind(code).first<LibraryRow>();
}

async function ensureLibrary(db: D1Database, device: string): Promise<LibraryRow> {
  const existing = await byDevice(db, device);
  if (existing) return existing;
  const old = await db.prepare('SELECT * FROM sessions WHERE user_id = ?').bind(device).first<LegacyRow>();
  if (old) {
    const imported = await fromLegacy(db, old.sync_code);
    if (imported) return (await byDevice(db, device))!;
  }
  // No data is deleted when devices are connected to another library.
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode();
    if (await db.prepare('SELECT user_id FROM sessions WHERE sync_code = ? LIMIT 1').bind(code).first()) continue;
    const id = crypto.randomUUID();
    const inserted = await db.prepare('INSERT OR IGNORE INTO reading_libraries (id, sync_code, library_json, revision) VALUES (?, ?, ?, 0)')
      .bind(id, code, JSON.stringify(emptyLibrary())).run();
    if (!inserted.meta.changes) continue;
    await db.prepare('INSERT OR IGNORE INTO reading_devices (device_id, library_id) VALUES (?, ?)').bind(device, id).run();
    return (await byDevice(db, device))!;
  }
  throw new Error('Could not create library');
}

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 4 * 1024 * 1024) { await reader.cancel(); throw new Error('size'); }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const device = new URL(request.url).searchParams.get('user_id');
  if (!validDevice(device)) return json({ error: '设备标识无效' }, 400);
  try { return json(result(await ensureLibrary(env.lumina_reader_db, device))); }
  catch { return json({ error: '暂时无法读取云端文章库，本机数据已保留' }, 503); }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { user_id?: string; action?: string; sync_code?: string; library?: ReadingLibrary; revision?: number };
  try { body = await readBody(request); }
  catch (error) { return json({ error: error instanceof Error && error.message === 'size' ? '文章库过大，请先导出备份' : '请求内容无效' }, 400); }
  if (!body || !validDevice(body.user_id)) return json({ error: '设备标识无效' }, 400);
  const db = env.lumina_reader_db;
  try {
    if (body.action === 'link') {
      const code = typeof body.sync_code === 'string' ? body.sync_code.trim().toUpperCase() : '';
      if (!/^[A-Z0-9]{6}$/.test(code)) return json({ error: '请输入 6 位同步码' }, 400);
      const target = await fromLegacy(db, code);
      if (!target) return json({ error: '同步码无效' }, 404);
      await db.prepare(`INSERT INTO reading_devices (device_id, library_id) VALUES (?, ?)
        ON CONFLICT(device_id) DO UPDATE SET library_id = excluded.library_id`).bind(body.user_id, target.id).run();
      return json(result(target));
    }
    if (body.library?.version !== 2 || !Array.isArray(body.library.entries) || !Number.isInteger(body.revision) || body.revision! < 0)
      return json({ error: '文章库格式无效' }, 400);
    const library = normalizeLibrary(body.library);
    if (library.entries.length !== body.library.entries.length || new Set(library.entries.map(e => e.id)).size !== library.entries.length)
      return json({ error: '文章库中含有无效或重复文章' }, 400);
    const current = await ensureLibrary(db, body.user_id);
    // Older open tabs do not know about retell. Omission must not erase a
    // newer device's draft; an explicit empty retell object still clears it.
    const previous = normalizeLibrary(JSON.parse(current.library_json));
    const storedLibrary: ReadingLibrary = { ...library, entries: library.entries.map(entry => {
      const old = previous.entries.find(item => item.id === entry.id);
      return entry.retell === undefined && old?.retell ? { ...entry, retell: old.retell } : entry;
    }) };
    const saved = await db.prepare(`UPDATE reading_libraries SET library_json = ?, revision = revision + 1 WHERE id = ? AND revision = ?`)
      .bind(JSON.stringify(storedLibrary), current.id, body.revision).run();
    if (!saved.meta.changes) {
      return json({ ...result((await byDevice(db, body.user_id))!), conflict: true }, 409);
    }
    return json({ ok: true, sync_code: current.sync_code, revision: body.revision! + 1 });
  } catch { return json({ error: '同步失败，本机数据已保留，请稍后重试' }, 503); }
};
