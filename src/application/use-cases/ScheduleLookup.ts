import type { Query } from "../../domain/thesaurus/Query";
import type { LookupResult } from "../../domain/thesaurus/Suggestion";
import type { Timers } from "../ports/Timers";
import type { LookupThesaurus } from "./LookupThesaurus";

export interface ScheduleOptions {
  readonly timers: Timers;
  /** Quiet time after the last keystroke before the lookup runs. */
  readonly idleMs?: number;
  readonly onError?: (key: string, error: unknown) => void;
  /** Called with true when a lookup starts and false when it settles. */
  readonly onBusy?: (busy: boolean) => void;
}

export type Deliver = (key: string, result: LookupResult) => void;

/**
 * Turns a stream of "the command now says X" requests into the minimum
 * number of lookups: only the latest query after `idleMs` of quiet runs,
 * a new request aborts the in-flight one, and every delivery is keyed by
 * the query so the consumer can discard an answer to a question that has
 * since changed.
 */
export class ScheduleLookup {
  private idleMs: number;
  private readonly timers: Timers;
  private readonly onError: (key: string, e: unknown) => void;
  private readonly onBusy: (busy: boolean) => void;
  private timer: number | null = null;
  private inflight: AbortController | null = null;
  private pending: Query | null = null;
  private disposed = false;

  constructor(private readonly lookup: LookupThesaurus, private readonly deliver: Deliver, options: ScheduleOptions) {
    this.timers = options.timers;
    this.idleMs = options.idleMs ?? 700;
    this.onError = options.onError ?? (() => undefined);
    this.onBusy = options.onBusy ?? (() => undefined);
  }

  /** Queue a lookup after the idle delay — or immediately. */
  request(query: Query, immediate = false): void {
    if (this.disposed) return;
    this.pending = query;
    this.cancel();
    this.timer = this.timers.set(() => void this.run(), immediate ? 0 : this.idleMs);
  }

  /** Drop whatever is pending or in flight; nothing will be delivered. */
  cancel(): void {
    this.inflight?.abort();
    this.inflight = null;
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
  }

  setIdleMs(ms: number): void {
    this.idleMs = ms;
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
    this.pending = null;
  }

  private async run(): Promise<void> {
    this.timer = null;
    const query = this.pending;
    this.pending = null;
    if (!query) return;
    const controller = new AbortController();
    this.inflight = controller;
    this.onBusy(true);
    try {
      const result = await this.lookup.execute(query, controller.signal);
      if (controller.signal.aborted || this.disposed) return;
      this.deliver(query.key, result);
    } catch (e) {
      if (!isAbort(e) && !this.disposed && !controller.signal.aborted) this.onError(query.key, e);
    } finally {
      if (this.inflight === controller) this.inflight = null;
      if (this.inflight === null) this.onBusy(false);
    }
  }
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
