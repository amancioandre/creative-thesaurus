import type { HistoryRepository } from "../../application/ports/HistoryRepository";
import { EMPTY_HISTORY, type History } from "../../domain/history/History";
import { parseHistoryNote, serializeHistoryNote } from "../../domain/history/HistoryNote";
import type { NoteVaultLike } from "./VaultNoteIO";

/** The history in a vault note (see HistoryNote). The path is read on every call so a settings change takes effect at the next save. */
export class HistoryNoteRepository implements HistoryRepository {
  constructor(private readonly vault: NoteVaultLike, private readonly path: () => string) {}

  async load(): Promise<History> {
    const path = this.path();
    if (!(await this.vault.exists(path))) return EMPTY_HISTORY;
    try {
      return parseHistoryNote(await this.vault.read(path));
    } catch {
      return EMPTY_HISTORY;
    }
  }

  async save(history: History): Promise<void> {
    await this.vault.write(this.path(), serializeHistoryNote(history));
  }
}
