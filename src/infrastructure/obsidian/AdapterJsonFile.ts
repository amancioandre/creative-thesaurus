/** The slice of Obsidian's `DataAdapter` a JSON file in the plugin folder needs; typed structurally so tests can fake it. */
export interface AdapterLike {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
}

/**
 * One JSON file under `.obsidian/plugins/creative-thesaurus/` — out of the
 * file explorer, out of search, out of the writer's way. Obsidian Sync
 * carries it when "installed community plugins" sync is on; git carries it
 * unless `.obsidian` is ignored.
 */
export class AdapterJsonFile {
  constructor(private readonly adapter: AdapterLike, private readonly path: string) {}

  /** Parsed content, or null when the file is missing or unreadable. */
  async read(): Promise<unknown> {
    try {
      if (!(await this.adapter.exists(this.path))) return null;
      return JSON.parse(await this.adapter.read(this.path));
    } catch {
      return null;
    }
  }

  async write(data: unknown): Promise<void> {
    await this.adapter.write(this.path, JSON.stringify(data));
  }
}
