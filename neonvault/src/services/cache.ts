const metaKey = (ownerSub: string, id: string) => `meta:${ownerSub}:${id}`;

export async function getMetaCached(env: any, id: string, ownerSub: string) {
  const raw = await env.KV_CONFIG.get(metaKey(ownerSub, id));
  return raw ? JSON.parse(raw) : null;
}

export async function putMetaCache(env: any, meta: any, ownerSub: string) {
  const ttl = Number(env.METADATA_CACHE_TTL_SECONDS || "60");
  await env.KV_CONFIG.put(metaKey(ownerSub, meta.id), JSON.stringify(meta), { expirationTtl: ttl });
}

export async function delMetaCache(env: any, id: string, ownerSub: string) {
  await env.KV_CONFIG.delete(metaKey(ownerSub, id));
}
