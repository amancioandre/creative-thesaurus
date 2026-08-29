import type { Query } from "../../domain/thesaurus/Query";
import type { Suggestion } from "../../domain/thesaurus/Suggestion";

export interface SourceReading {
  readonly suggestions: readonly Suggestion[];
  /** Free text worth showing under the groups (an example sentence, a caution). */
  readonly notes?: readonly string[];
}

/** Anything that can answer "what else could I say?" — a web thesaurus, a local model. */
export interface SuggestionSource {
  readonly name: string;
  /** Anything beyond the name that changes the answer (the language the model explains in), for cache keys. */
  readonly variant?: string;
  suggest(query: Query, signal: AbortSignal): Promise<SourceReading>;
}
