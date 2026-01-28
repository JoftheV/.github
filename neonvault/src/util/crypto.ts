export function newId(): string {
  return crypto.randomUUID();
}

export function ipHash(ip: string): string {
  // fast non-cryptographic-ish hash is OK for IP anonymization; upgrade to SHA256 if desired
  let h = 2166136261;
  for (let i = 0; i < ip.length; i++) h = Math.imul(h ^ ip.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
