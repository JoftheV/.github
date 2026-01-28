import { err } from "../util/json";

function minuteKey(sub: string) {
  const m = Math.floor(Date.now() / 60000);
  return `rl:${sub}:${m}`;
}

export async function rateLimitOrThrow(req: Request, env: any, ident: { sub: string }) {
  const limit = Number(env.RATE_LIMIT_RPM || "120");
  const key = minuteKey(ident.sub);

  const current = Number((await env.KV_CONFIG.get(key)) || "0") + 1;
  await env.KV_CONFIG.put(key, String(current), { expirationTtl: 120 });

  if (current > limit) throw err(429, "Rate limit exceeded");
}
