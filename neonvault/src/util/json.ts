export function json(body: any, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function err(statusCode: number, message: string) {
  const e: any = new Error(message);
  e.statusCode = statusCode;
  throw e;
}
