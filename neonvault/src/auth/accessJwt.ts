import { err } from "../util/json";

export type AccessIdentity = {
  sub: string;
  email?: string;
  aud?: string | string[];
  exp?: number;
};

// Minimal JWT decode helpers (no external deps)
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const raw = atob(s);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
function parseJsonPart(part: string): any {
  const bytes = b64urlToBytes(part);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

async function fetchJwks(teamDomain: string) {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const res = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw err(500, "Failed to load Access JWKS");
  return res.json() as Promise<{ keys: any[] }>;
}

async function importKeyFromJwk(jwk: any): Promise<CryptoKey> {
  // Cloudflare Access uses RS256 commonly
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function verifyRs256(jwt: string, jwks: { keys: any[] }) {
  const [h, p, s] = jwt.split(".");
  if (!h || !p || !s) throw err(401, "Invalid token");

  const header = parseJsonPart(h);
  const payload = parseJsonPart(p);

  const sig = b64urlToBytes(s);
  const data = new TextEncoder().encode(`${h}.${p}`);

  const kid = header.kid;
  const jwk = jwks.keys.find(k => k.kid === kid) ?? jwks.keys[0];
  if (!jwk) throw err(401, "No JWKS keys");

  const key = await importKeyFromJwk(jwk);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, data);
  if (!ok) throw err(401, "Access token signature invalid");
  return payload;
}

function audOk(aud: any, expectedAud: string) {
  if (!aud) return false;
  if (Array.isArray(aud)) return aud.includes(expectedAud);
  return aud === expectedAud;
}

export async function requireAccessIdentity(req: Request, env: { ACCESS_TEAM_DOMAIN: string; ACCESS_AUD: string }) {
  const jwt = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) throw err(401, "Missing Access token (Cf-Access-Jwt-Assertion)");

  const jwks = await fetchJwks(env.ACCESS_TEAM_DOMAIN);
  const payload = await verifyRs256(jwt, jwks);

  if (!audOk(payload.aud, env.ACCESS_AUD)) throw err(403, "Access token aud mismatch");

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw err(401, "Access token expired");

  const ident: AccessIdentity = {
    sub: payload.sub,
    email: payload.email
  };

  if (!ident.sub) throw err(401, "Access token missing sub");
  return ident;
}
