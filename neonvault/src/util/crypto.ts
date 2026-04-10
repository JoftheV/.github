export function newId(): string {
  return crypto.randomUUID();
}

export function ipHash(ip: string): string {
  // fast non-cryptographic-ish hash is OK for IP anonymization; upgrade to SHA256 if desired
  let h = 2166136261;
  for (let i = 0; i < ip.length; i++) h = Math.imul(h ^ ip.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256HexFromStream(stream: ReadableStream): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const digest = await crypto.subtle.digest("SHA-256", merged);
  return bytesToHex(new Uint8Array(digest));
}
