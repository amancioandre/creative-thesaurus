import type { ResultCache } from "../../domain/thesaurus/ResultCache";

/** Where answers live between sessions — the plugin's own folder, not a note. */
export interface CacheRepository {
  load(): Promise<ResultCache>;
  save(cache: ResultCache): Promise<void>;
}
