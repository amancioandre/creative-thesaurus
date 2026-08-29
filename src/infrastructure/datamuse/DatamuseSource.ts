import type { HttpClient } from "../../application/ports/HttpClient";
import type { SourceReading, SuggestionSource } from "../../application/ports/SuggestionSource";
import type { Query } from "../../domain/thesaurus/Query";
import type { Suggestion, SuggestionKind } from "../../domain/thesaurus/Suggestion";

export interface DatamuseConfig {
  readonly baseUrl?: string;
  /** Sent as `key=` when set. Datamuse is keyless at the time of writing; this is the seam for when it is not. */
  readonly apiKey?: string;
  readonly max?: number;
}

interface DatamuseWord {
  word: string;
  score?: number;
  tags?: string[];
}

const POS = new Set(["n", "v", "adj", "adv"]);

/**
 * Datamuse (https://www.datamuse.com/api/): free, fast, no key. One word gets
 * synonyms (`rel_syn`), antonyms (`rel_ant`) and related terms (`rel_trg`);
 * a phrase gets "means like" (`ml`), which is the only endpoint that reads
 * multi-word input, and lands in the "alternative" group. The three calls
 * run in parallel; one failing does not lose the others.
 */
export class DatamuseSource implements SuggestionSource {
  readonly name = "datamuse";
  private readonly baseUrl: string;
  private readonly max: number;

  constructor(private readonly http: HttpClient, private readonly config: DatamuseConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "https://api.datamuse.com").replace(/\/+$/, "");
    this.max = config.max ?? 20;
  }

  async suggest(query: Query, signal: AbortSignal): Promise<SourceReading> {
    const calls: Array<[string, string, SuggestionKind]> = query.isPhrase
      ? [["ml", query.text, "alternative"]]
      : [["rel_syn", query.text, "synonym"], ["rel_ant", query.text, "antonym"], ["rel_trg", query.text, "related"]];
    const settled = await Promise.allSettled(calls.map(([param, value, kind]) => this.fetch(param, value, kind, signal)));
    const suggestions = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const failed = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed.length === settled.length) throw failed[0]!.reason;
    // `ml` for a single word is a broader net than rel_syn; used only when the strict relations found nothing.
    if (!query.isPhrase && suggestions.length === 0) return { suggestions: await this.fetch("ml", query.text, "synonym", signal) };
    return { suggestions };
  }

  private async fetch(param: string, value: string, kind: SuggestionKind, signal: AbortSignal): Promise<Suggestion[]> {
    const qs = new URLSearchParams({ [param]: value, md: "p", max: String(this.max) });
    if (this.config.apiKey) qs.set("key", this.config.apiKey);
    const res = await this.http.getJson(`${this.baseUrl}/words?${qs.toString()}`, {}, signal);
    if (res.status !== 200) throw new Error(`Datamuse: HTTP ${res.status}`);
    if (!Array.isArray(res.json)) throw new Error("Datamuse: unexpected response");
    return (res.json as DatamuseWord[])
      .filter((w) => typeof w.word === "string" && w.word.trim())
      .map((w) => {
        const pos = w.tags?.find((t) => POS.has(t));
        return { word: w.word, kind, source: this.name, score: typeof w.score === "number" ? w.score : 0, ...(pos ? { pos } : {}) };
      });
  }
}
