import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScheduleLookup } from "../../src/application/use-cases/ScheduleLookup";
import { LookupThesaurus } from "../../src/application/use-cases/LookupThesaurus";
import { parseQuery } from "../../src/domain/thesaurus/Query";
import type { LookupResult } from "../../src/domain/thesaurus/Suggestion";

const timers = { set: (fn: () => void, ms: number) => window.setTimeout(fn, ms), clear: (id: number) => window.clearTimeout(id) };

class FakeLookup {
  calls: string[] = [];
  aborted = 0;
  delay = 10;
  fail = false;
  async execute(query: { text: string; key: string; isPhrase: boolean }, signal: AbortSignal): Promise<LookupResult> {
    this.calls.push(query.text);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, this.delay);
      signal.addEventListener("abort", () => { clearTimeout(t); this.aborted++; reject(new DOMException("aborted", "AbortError")); });
    });
    if (this.fail) throw new Error("boom");
    return { query, groups: [], notes: [], sources: ["fake"], errors: [] };
  }
  invalidate() {}
}

describe("ScheduleLookup", () => {
  let lookup: FakeLookup;
  let delivered: string[];
  let errors: string[];
  let busy: boolean[];
  let s: ScheduleLookup;
  const q = (t: string) => parseQuery(t)!;

  beforeEach(() => {
    vi.useFakeTimers();
    lookup = new FakeLookup(); delivered = []; errors = []; busy = [];
    s = new ScheduleLookup(lookup as unknown as LookupThesaurus, (key) => delivered.push(key), { timers, idleMs: 100, onError: (key) => errors.push(key), onBusy: (b) => busy.push(b) });
  });
  afterEach(() => { s.dispose(); vi.useRealTimers(); });

  it("waits for idle, then delivers keyed by the query", async () => {
    s.request(q("hello"));
    await vi.advanceTimersByTimeAsync(50);
    expect(lookup.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(80);
    expect(lookup.calls).toEqual(["hello"]);
    expect(delivered).toEqual(["hello"]);
    expect(busy).toEqual([true, false]);
  });
  it("debounces to the latest query", async () => {
    s.request(q("a")); await vi.advanceTimersByTimeAsync(30);
    s.request(q("ab")); await vi.advanceTimersByTimeAsync(30);
    s.request(q("abc")); await vi.advanceTimersByTimeAsync(200);
    expect(lookup.calls).toEqual(["abc"]);
  });
  it("runs immediately on request(…, true)", async () => {
    s.request(q("now"), true);
    await vi.advanceTimersByTimeAsync(15);
    expect(delivered).toEqual(["now"]);
  });
  it("aborts an in-flight lookup when a new query arrives, and on cancel", async () => {
    lookup.delay = 500;
    s.request(q("first")); await vi.advanceTimersByTimeAsync(150);
    s.request(q("second")); await vi.advanceTimersByTimeAsync(150);
    s.cancel(); await vi.advanceTimersByTimeAsync(1000);
    expect(lookup.aborted).toBe(2);
    expect(delivered).toEqual([]);
    expect(errors).toEqual([]);
  });
  it("reports errors with the query key", async () => {
    lookup.fail = true;
    s.request(q("z")); await vi.advanceTimersByTimeAsync(200);
    expect(errors).toEqual(["z"]);
    expect(busy).toEqual([true, false]);
  });
  it("honours setIdleMs and dispose", async () => {
    s.setIdleMs(10);
    s.request(q("quick")); await vi.advanceTimersByTimeAsync(30);
    expect(delivered).toEqual(["quick"]);
    s.dispose();
    s.request(q("late")); await vi.advanceTimersByTimeAsync(100);
    expect(lookup.calls).toEqual(["quick"]);
  });
});
