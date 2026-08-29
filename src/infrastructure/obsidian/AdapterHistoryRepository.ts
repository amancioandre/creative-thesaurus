import type { HistoryRepository } from "../../application/ports/HistoryRepository";
import { normalizeHistory, type History } from "../../domain/history/History";
import type { AdapterJsonFile } from "./AdapterJsonFile";

/** History in `history.json` in the plugin folder — the default, invisible in the vault. */
export class AdapterHistoryRepository implements HistoryRepository {
  constructor(private readonly file: AdapterJsonFile) {}

  async load(): Promise<History> {
    return normalizeHistory(await this.file.read());
  }

  async save(history: History): Promise<void> {
    await this.file.write(history);
  }
}
