import { requireAccessIdentity, type AccessIdentity } from "./auth/accessJwt";
import { json, err } from "./util/json";
import { newId } from "./util/crypto";
import { audit } from "./services/audit";
import { rateLimitOrThrow } from "./services/rateLimit";
import { getMetaCached, putMetaCache, delMetaCache } from "./services/cache";
import { createObject, getObjectById, listObjectsByOwner, markDeleted } from "./services/objects";

export interface Env {
  ENVIRONMENT: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  METADATA_CACHE_TTL_SECONDS: string;
  RATE_LIMIT_RPM: string;

  R2_BUCKET_VAULT: R2Bucket;
  DB: D1Database;
  KV_CONFIG: KVNamespace;
}

function route(url: URL) {
  const p = url.pathname.replace(/\/+$/, "") || "/";
  return p;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const requestId = req.headers.get("cf-ray") ?? crypto.randomUUID();
    const started = Date.now();

    let ident: AccessIdentity | null = null;

    try {
      // Enforce Access identity (defense-in-depth)
      ident = await requireAccessIdentity(req, env);

      // Per-user rate limiting
      await rateLimitOrThrow(req, env, ident);

      const p = route(url);
      const m = req.method.toUpperCase();

      // Health
      if (p === "/health") {
        return json({ ok: true, env: env.ENVIRONMENT, requestId });
      }

      // List objects (owned by user)
      if (p === "/v1/objects" && m === "GET") {
        const rows = await listObjectsByOwner(env, ident.sub);
        ctx.waitUntil(
          audit(env, { ident, action: "LIST", ok: 1, status: 200, requestId, objectId: null, r2Key: null, req })
        );
        return json({ objects: rows, requestId });
      }

      // Get metadata
      if (p.startsWith("/v1/objects/") && p.endsWith("/meta") && m === "GET") {
        const id = p.split("/")[3];
        const cached = await getMetaCached(env, id, ident.sub);
        if (cached) {
          ctx.waitUntil(
            audit(env, { ident, action: "META_READ", ok: 1, status: 200, requestId, objectId: id, r2Key: cached.r2_key, req })
          );
          return json({ meta: cached, cached: true, requestId });
        }

        const meta = await getObjectById(env, id);
        if (!meta || meta.owner_sub !== ident.sub) throw err(404, "Not found");
        await putMetaCache(env, meta, ident.sub);

        ctx.waitUntil(
          audit(env, { ident, action: "META_READ", ok: 1, status: 200, requestId, objectId: id, r2Key: meta.r2_key, req })
        );
        return json({ meta, cached: false, requestId });
      }

      // Upload (stream through Worker)
      // POST /v1/upload
      if (p === "/v1/upload" && m === "POST") {
        const contentType = req.headers.get("content-type") || "application/octet-stream";
        const filename = req.headers.get("x-filename") || "upload.bin";

        const id = newId();
        const r2Key = `${ident.sub}/${id}/${filename}`;

        // Stream request body to R2
        if (!req.body) throw err(400, "Missing body");
        await env.R2_BUCKET_VAULT.put(r2Key, req.body, {
          httpMetadata: { contentType },
          customMetadata: { owner_sub: ident.sub, owner_email: ident.email ?? "" }
        });

        // size_bytes isn't returned by put; best-effort read from header
        const sizeHeader = req.headers.get("content-length");
        const sizeBytes = sizeHeader ? Number(sizeHeader) : 0;

        // Optional: compute sha256 if you want integrity (cost: CPU). For big files, do it async in a background job.
        const sha256Hex = null;

        await createObject(env, {
          id,
          r2_key: r2Key,
          owner_sub: ident.sub,
          owner_email: ident.email ?? null,
          filename,
          content_type: contentType,
          size_bytes: sizeBytes,
          sha256_hex: sha256Hex,
          tags_json: "[]"
        });

        await delMetaCache(env, id, ident.sub);

        ctx.waitUntil(
          audit(env, { ident, action: "UPLOAD", ok: 1, status: 201, requestId, objectId: id, r2Key, req })
        );
        return json({ id, r2Key, created: true, requestId }, { status: 201 });
      }

      // Download (stream through Worker)
      // GET /v1/objects/:id/download
      if (p.startsWith("/v1/objects/") && p.endsWith("/download") && m === "GET") {
        const id = p.split("/")[3];
        const meta = await getObjectById(env, id);
        if (!meta || meta.owner_sub !== ident.sub) throw err(404, "Not found");

        const obj = await env.R2_BUCKET_VAULT.get(meta.r2_key);
        if (!obj) throw err(404, "Not found in storage");

        const headers = new Headers();
        headers.set("content-type", meta.content_type || "application/octet-stream");
        headers.set("content-disposition", `attachment; filename=\"${meta.filename || "download.bin"}\"`);
        headers.set("cache-control", "private, no-store");

        ctx.waitUntil(
          audit(env, { ident, action: "DOWNLOAD", ok: 1, status: 200, requestId, objectId: id, r2Key: meta.r2_key, req })
        );
        return new Response(obj.body, { status: 200, headers });
      }

      // Delete (soft-delete in DB; delete from R2)
      // DELETE /v1/objects/:id
      if (p.startsWith("/v1/objects/") && m === "DELETE") {
        const id = p.split("/")[3];
        const meta = await getObjectById(env, id);
        if (!meta || meta.owner_sub !== ident.sub) throw err(404, "Not found");

        await env.R2_BUCKET_VAULT.delete(meta.r2_key);
        await markDeleted(env, id); // or hard-delete row if you prefer
        await delMetaCache(env, id, ident.sub);

        ctx.waitUntil(
          audit(env, { ident, action: "DELETE", ok: 1, status: 204, requestId, objectId: id, r2Key: meta.r2_key, req })
        );
        return new Response(null, { status: 204 });
      }

      throw err(404, "Route not found");
    } catch (e: any) {
      const status = e?.statusCode || e?.status || 500;
      const message = e?.message || "Internal error";

      // Best-effort audit on failures (only if we have identity)
      if (ident) {
        ctx.waitUntil(audit(env, { ident, action: "ERROR", ok: 0, status, requestId, objectId: null, r2Key: null, req }));
      }

      return json(
        {
          ok: false,
          error: message,
          status,
          requestId,
          latency_ms: Date.now() - started
        },
        { status }
      );
    }
  }
};
