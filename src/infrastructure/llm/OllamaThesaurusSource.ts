import type { HttpClient } from "../../application/ports/HttpClient";
import type { SourceReading, SuggestionSource } from "../../application/ports/SuggestionSource";
import type { Query } from "../../domain/thesaurus/Query";
import { validateModelSuggestions } from "../../domain/thesaurus/validateModelSuggestions";
import { extractJson } from "./extractJson";
import { THESAURUS_RULEBOOK, THESAURUS_SCHEMA, thesaurusUserMessage } from "./prompts/thesaurusRulebook";

export interface OllamaConfig {
  readonly baseUrl: string;
  readonly model: string;
  readonly explainIn?: string;
}

/**
 * Local model via Ollama's /api/chat with schema-constrained output.
 * Temperature 0: the same word gets the same answer, which also keeps the
 * session cache honest. The answer is validated in the domain before it
 * becomes suggestions — nothing the model says is trusted as-is.
 */
export class OllamaThesaurusSource implements SuggestionSource {
  readonly name: string;
  readonly variant: string;

  constructor(private readonly http: HttpClient, private readonly config: OllamaConfig) {
    this.name = `ollama:${config.model}`;
    this.variant = (config.explainIn ?? "").trim().toLowerCase();
  }

  async suggest(query: Query, signal: AbortSignal): Promise<SourceReading> {
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/api/chat`;
    const body = {
      model: this.config.model,
      stream: false,
      format: THESAURUS_SCHEMA,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: THESAURUS_RULEBOOK },
        { role: "user", content: thesaurusUserMessage(query, this.config.explainIn ?? "") },
      ],
    };
    const res = await this.http.postJson(url, body, { "Content-Type": "application/json" }, signal);
    if (res.status !== 200) throw new Error(`Ollama: ${(res.json as { error?: string } | undefined)?.error ?? `HTTP ${res.status}`}`);
    const parsed = extractJson((res.json as { message?: { content?: string } }).message?.content ?? "");
    if (!parsed || typeof parsed !== "object") throw new Error("Ollama: response was not a JSON object");
    return validateModelSuggestions(parsed, query, this.name);
  }
}
