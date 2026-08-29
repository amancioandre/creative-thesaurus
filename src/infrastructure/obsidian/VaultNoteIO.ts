/** The slice of Obsidian's vault the note repository needs, typed structurally so tests can fake it. */
export interface VaultLike {
  getAbstractFileByPath(path: string): { path: string; children?: unknown } | null;
  cachedRead(file: unknown): Promise<string>;
  modify(file: unknown, content: string): Promise<void>;
  create(path: string, content: string): Promise<unknown>;
  createFolder(path: string): Promise<unknown>;
}

export interface NoteVaultLike {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
}

/**
 * Read/write a note by path, creating it — and any missing parent folders —
 * on first write. A file is anything `getAbstractFileByPath` returns
 * without `children`; a folder has them.
 */
export function vaultNoteIO(vault: VaultLike): NoteVaultLike {
  const isFile = (p: string) => { const f = vault.getAbstractFileByPath(p); return !!f && f.children === undefined; };
  return {
    exists: async (p) => isFile(p),
    read: async (p) => vault.cachedRead(vault.getAbstractFileByPath(p)),
    write: async (p, content) => {
      const existing = vault.getAbstractFileByPath(p);
      if (existing && existing.children === undefined) { await vault.modify(existing, content); return; }
      const parts = p.split("/").slice(0, -1);
      for (let i = 1; i <= parts.length; i++) {
        const dir = parts.slice(0, i).join("/");
        if (vault.getAbstractFileByPath(dir)) continue;
        // The index can lag the disk (early in a reload, after an external sync): a folder that exists but is not
        // yet known is fine to keep, so only a genuinely failed create is an error.
        try { await vault.createFolder(dir); } catch (e) { if (!/already exists/i.test(e instanceof Error ? e.message : String(e))) throw e; }
      }
      await vault.create(p, content);
    },
  };
}
