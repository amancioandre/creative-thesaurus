import type { HttpClient, HttpResponse } from "../../../src/application/ports/HttpClient";

export interface Call { method: "GET" | "POST"; url: string; body?: unknown; headers: Record<string, string> }

/** Records requests and replays canned responses. */
export class FakeHttp implements HttpClient {
  calls: Call[] = [];
  constructor(private readonly responder: (call: Call, signal: AbortSignal) => Promise<HttpResponse> | HttpResponse) {}
  async getJson(url: string, headers: Record<string, string>, signal: AbortSignal) {
    const call: Call = { method: "GET", url, headers };
    this.calls.push(call);
    return this.responder(call, signal);
  }
  async postJson(url: string, body: unknown, headers: Record<string, string>, signal: AbortSignal) {
    const call: Call = { method: "POST", url, body, headers };
    this.calls.push(call);
    return this.responder(call, signal);
  }
}

export const MODEL_ANSWER = {
  synonyms: [{ word: "silent", register: "neutral", note: "No sound at all." }, { word: "hushed", register: "literary", note: "Lowered on purpose." }],
  alternatives: [{ phrase: "keep it down", note: "Informal." }],
  antonyms: [{ word: "loud", note: "" }],
  example: "The house was silent.",
  caution: "",
};

export const OLLAMA_OK = { model: "qwen2.5:7b", message: { role: "assistant", content: JSON.stringify(MODEL_ANSWER) }, done: true };
