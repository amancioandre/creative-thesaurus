import { describe, it, expect } from "vitest";
import { AdapterJsonFile, type AdapterLike } from "../../../src/infrastructure/obsidian/AdapterJsonFile";
import { AdapterHistoryRepository } from "../../../src/infrastructure/obsidian/AdapterHistoryRepository";
import { AdapterCacheRepository } from "../../../src/infrastructure/obsidian/AdapterCacheRepository";
import { appendEntry, EMPTY_HISTORY } from "../../../src/domain/history/History";
import { EMPTY_CACHE, touchCache } from "../../../src/domain/thesaurus/ResultCache";
import { parseQuery } from "../../../src/domain/thesaurus/Query";

function fakeAdapter() {
  const files = new Map<string, string>();
  const adapter: AdapterLike = { exists: async (p) => files.has(p), read: async (p) => files.get(p)!, write: async (p, d) => { files.set(p, d); } };
  return { adapter, files };
}

describe("AdapterJsonFile", () => {
  it("is null when missing or unreadable, round-trips otherwise", async () => {
    const { adapter, files } = fakeAdapter();
    const f = new AdapterJsonFile(adapter, ".obsidian/plugins/creative-thesaurus/x.json");
    expect(await f.read()).toBeNull();
    await f.write({ a: 1 });
    expect(await f.read()).toEqual({ a: 1 });
    files.set(".obsidian/plugins/creative-thesaurus/x.json", "{broken");
    expect(await f.read()).toBeNull();
  });
});

describe("plugin-folder repositories", () => {
  it("keep the history in history.json, invisible to the vault", async () => {
    const { adapter, files } = fakeAdapter();
    const repo = new AdapterHistoryRepository(new AdapterJsonFile(adapter, "cfg/plugins/creative-thesaurus/history.json"));
    expect(await repo.load()).toEqual(EMPTY_HISTORY);
    const h = appendEntry(EMPTY_HISTORY, { at: "2026-08-29T10:00:00.000Z", query: "quiet", note: "", sources: ["d"], count: 1 }, 10);
    await repo.save(h);
    expect([...files.keys()]).toEqual(["cfg/plugins/creative-thesaurus/history.json"]);
    expect(await repo.load()).toEqual(h);
  });
  it("keep answers in cache.json", async () => {
    const { adapter } = fakeAdapter();
    const repo = new AdapterCacheRepository(new AdapterJsonFile(adapter, "cfg/plugins/creative-thesaurus/cache.json"));
    expect(await repo.load()).toEqual(EMPTY_CACHE);
    const c = touchCache(EMPTY_CACHE, "k", { query: parseQuery("quiet")!, groups: [], notes: [], sources: ["d"], errors: [] }, "2026-08-29T10:00:00.000Z");
    await repo.save(c);
    expect(await repo.load()).toEqual(c);
  });
});
