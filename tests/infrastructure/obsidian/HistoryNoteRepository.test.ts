import { describe, it, expect } from "vitest";
import { HistoryNoteRepository } from "../../../src/infrastructure/obsidian/HistoryNoteRepository";
import { vaultNoteIO, type VaultLike } from "../../../src/infrastructure/obsidian/VaultNoteIO";
import { appendEntry, EMPTY_HISTORY } from "../../../src/domain/history/History";

const history = appendEntry(EMPTY_HISTORY, { at: "2026-08-29T10:00:00.000Z", query: "quiet", note: "a.md", sources: ["datamuse"], count: 2 }, 10);

export function fakeVault() {
  const files = new Map<string, string>();
  const folders = new Set<string>();
  const vault: VaultLike = {
    getAbstractFileByPath: (p) => (files.has(p) ? { path: p } : folders.has(p) ? { path: p, children: [] } : null),
    cachedRead: async (f) => files.get((f as { path: string }).path)!,
    modify: async (f, c) => { files.set((f as { path: string }).path, c); },
    create: async (p, c) => { files.set(p, c); },
    createFolder: async (p) => { folders.add(p); },
  };
  return { vault, files, folders };
}

describe("HistoryNoteRepository", () => {
  it("is empty when there is no note", async () => {
    expect(await new HistoryNoteRepository(vaultNoteIO(fakeVault().vault), () => "Creative Thesaurus/History.md").load()).toEqual(EMPTY_HISTORY);
  });
  it("saves into a note, creating parent folders, and reads it back; later saves modify", async () => {
    const { vault, files, folders } = fakeVault();
    const repo = new HistoryNoteRepository(vaultNoteIO(vault), () => "Creative Thesaurus/Logs/History.md");
    await repo.save(history);
    expect([...folders]).toEqual(["Creative Thesaurus", "Creative Thesaurus/Logs"]);
    expect(files.get("Creative Thesaurus/Logs/History.md")).toContain("creative-thesaurus-history: 1");
    expect(await repo.load()).toEqual(history);
    await repo.save(EMPTY_HISTORY);
    expect(await repo.load()).toEqual(EMPTY_HISTORY);
    expect(files.size).toBe(1);
  });
  it("keeps a parent folder the index does not know yet instead of failing the write", async () => {
    const { vault, files } = fakeVault();
    const strict: VaultLike = { ...vault, createFolder: async (p) => { if (p === "Creative Thesaurus") throw new Error("Folder already exists."); await vault.createFolder(p); } };
    await new HistoryNoteRepository(vaultNoteIO(strict), () => "Creative Thesaurus/History.md").save(history);
    expect(files.has("Creative Thesaurus/History.md")).toBe(true);
    const broken: VaultLike = { ...vault, createFolder: async () => { throw new Error("EACCES"); } };
    await expect(new HistoryNoteRepository(vaultNoteIO(broken), () => "Locked/History.md").save(history)).rejects.toThrow("EACCES");
  });
  it("is empty when the note cannot be read", async () => {
    const { vault, files } = fakeVault();
    files.set("H.md", "x");
    const failing: VaultLike = { ...vault, cachedRead: async () => { throw new Error("gone"); } };
    expect(await new HistoryNoteRepository(vaultNoteIO(failing), () => "H.md").load()).toEqual(EMPTY_HISTORY);
  });
});
