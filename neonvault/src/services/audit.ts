import { newId, ipHash } from "../util/crypto";

export async function audit(
  env: any,
  args: {
    ident: { sub: string; email?: string | null };
    action: string;
    ok: number;
    status: number;
    requestId: string;
    objectId: string | null;
    r2Key: string | null;
    req: Request;
  }
) {
  const ua = args.req.headers.get("user-agent") || "";
  const ip = args.req.headers.get("cf-connecting-ip") || "";
  const ipH = ip ? ipHash(ip) : null;

  await env.DB.prepare(`
    INSERT INTO audit (id, actor_sub, actor_email, action, object_id, r2_key, ok, status, request_id, ip_hash, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      newId(),
      args.ident.sub,
      args.ident.email ?? null,
      args.action,
      args.objectId,
      args.r2Key,
      args.ok,
      args.status,
      args.requestId,
      ipH,
      ua
    )
    .run();
}
