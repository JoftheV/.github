export async function createObject(env: any, o: any) {
  const stmt = env.DB.prepare(`
    INSERT INTO objects (id, r2_key, owner_sub, owner_email, filename, content_type, size_bytes, sha256_hex, tags_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await stmt.bind(o.id, o.r2_key, o.owner_sub, o.owner_email, o.filename, o.content_type, o.size_bytes, o.sha256_hex, o.tags_json).run();
}

export async function getObjectById(env: any, id: string) {
  const row = await env.DB.prepare(`SELECT * FROM objects WHERE id = ?`).bind(id).first();
  return row || null;
}

export async function listObjectsByOwner(env: any, ownerSub: string) {
  const res = await env.DB.prepare(
    `SELECT id, filename, content_type, size_bytes, sha256_hex, created_at, updated_at FROM objects WHERE owner_sub = ? ORDER BY created_at DESC LIMIT 200`
  )
    .bind(ownerSub)
    .all();
  return res.results || [];
}

// Soft delete option: move to tombstone state.
// For now, hard-delete row to keep it simple.
export async function markDeleted(env: any, id: string) {
  await env.DB.prepare(`DELETE FROM objects WHERE id = ?`).bind(id).run();
}
