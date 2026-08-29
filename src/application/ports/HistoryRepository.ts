import type { History } from "../../domain/history/History";

export interface HistoryRepository {
  load(): Promise<History>;
  save(history: History): Promise<void>;
}
