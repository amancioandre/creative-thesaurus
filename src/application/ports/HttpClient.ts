/** Minimal JSON HTTP. Obsidian implements it with `requestUrl` (Node-side, no CORS); tests fake it. */
export interface HttpResponse {
  readonly status: number;
  readonly json: unknown;
}

export interface HttpClient {
  getJson(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<HttpResponse>;
  postJson(url: string, body: unknown, headers: Record<string, string>, signal: AbortSignal): Promise<HttpResponse>;
}
