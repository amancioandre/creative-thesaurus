import type { CacheRepository } from "../../application/ports/CacheRepository";
import { normalizeCache, type ResultCache } from "../../domain/thesaurus/ResultCache";
import type { AdapterJsonFile } from "./AdapterJsonFile";

/** Answers in `cache.json` in the plugin folder. */
export class AdapterCacheRepository implements CacheRepository {
  constructor(private readonly file: AdapterJsonFile) {}

  async load(): Promise<ResultCache> {
    return normalizeCache(await this.file.read());
  }

  async save(cache: ResultCache): Promise<void> {
    await this.file.write(cache);
  }
}
