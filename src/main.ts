import { MarkdownView, Notice, Plugin, editorInfoField, type WorkspaceLeaf } from "obsidian";
import { Compartment } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import type { PluginSettings } from "./domain/settings/Settings";
import type { SuggestionSource } from "./application/ports/SuggestionSource";
import { LookupThesaurus } from "./application/use-cases/LookupThesaurus";
import { RecordLookup } from "./application/use-cases/RecordLookup";
import { parseQuery } from "./domain/thesaurus/Query";
import { DatamuseSource } from "./infrastructure/datamuse/DatamuseSource";
import { OllamaThesaurusSource } from "./infrastructure/llm/OllamaThesaurusSource";
import { settingsFacet } from "./infrastructure/codemirror/settingsFacet";
import { lookupNow, thesaurusExtension } from "./infrastructure/codemirror/thesaurusExtension";
import { RequestUrlHttpClient } from "./infrastructure/obsidian/RequestUrlHttpClient";
import { PluginDataSettingsRepository } from "./infrastructure/obsidian/PluginDataSettingsRepository";
import { HistoryNoteRepository } from "./infrastructure/obsidian/HistoryNoteRepository";
import { AdapterHistoryRepository } from "./infrastructure/obsidian/AdapterHistoryRepository";
import { AdapterCacheRepository } from "./infrastructure/obsidian/AdapterCacheRepository";
import { AdapterJsonFile } from "./infrastructure/obsidian/AdapterJsonFile";
import type { HistoryRepository } from "./application/ports/HistoryRepository";
import { vaultNoteIO } from "./infrastructure/obsidian/VaultNoteIO";
import { CreativeThesaurusSettingsTab } from "./infrastructure/obsidian/SettingsTab";
import { HISTORY_VIEW_TYPE, HistoryView, type NoteHits, type Search } from "./infrastructure/obsidian/views/HistoryView";
import { projectScopeOf, searchSet, storyOf, type NoteMeta } from "./domain/scope/StoryScope";
import { provenanceTooltip } from "./infrastructure/codemirror/provenanceTooltip";
import { picksFor } from "./domain/history/Provenance";
import { findOccurrences } from "./domain/text/Occurrences";
import { TFile } from "obsidian";

/**
 * Composition root. The only file that knows about every layer: it builds
 * the adapters, injects them into the use cases, and registers the result
 * with Obsidian. No behaviour lives here — only wiring.
 */
export default class CreativeThesaurusPlugin extends Plugin {
  private current!: PluginSettings;
  private readonly settingsCompartment = new Compartment();
  private settingsRepo!: PluginDataSettingsRepository;
  private history!: RecordLookup;
  private lookup!: LookupThesaurus;

  async onload(): Promise<void> {
    this.settingsRepo = new PluginDataSettingsRepository(this);
    this.current = await this.settingsRepo.load();

    // Sources are resolved at call time, so a settings change takes effect on the next lookup without a reload.
    const http = new RequestUrlHttpClient();
    let ollama: { key: string; source: SuggestionSource } | null = null;
    const sources = (): SuggestionSource[] => {
      const out: SuggestionSource[] = [];
      const s = this.current;
      if (s.datamuse.enabled) out.push(new DatamuseSource(http, { apiKey: s.datamuse.apiKey }));
      if (s.llm.provider === "ollama") {
        const key = `${s.llm.ollamaUrl}|${s.llm.ollamaModel}|${s.llm.explainIn}`;
        if (ollama?.key !== key) ollama = { key, source: new OllamaThesaurusSource(http, { baseUrl: s.llm.ollamaUrl, model: s.llm.ollamaModel, explainIn: s.llm.explainIn }) };
        out.push(ollama.source);
      }
      return out;
    };
    // Answers and history live in the plugin folder, not in notes: nothing of the plugin's shows in the file explorer
    // unless the writer asks for the history as a note.
    const pluginDir = `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    this.lookup = new LookupThesaurus({ sources, maxPerGroup: () => this.current.maxPerGroup, store: new AdapterCacheRepository(new AdapterJsonFile(this.app.vault.adapter, `${pluginDir}/cache.json`)) });

    const historyFile = new AdapterHistoryRepository(new AdapterJsonFile(this.app.vault.adapter, `${pluginDir}/history.json`));
    const historyNote = new HistoryNoteRepository(vaultNoteIO(this.app.vault), () => this.current.history.notePath);
    const historyRepo: HistoryRepository = { load: () => (this.current.history.inVaultNote ? historyNote : historyFile).load(), save: (h) => (this.current.history.inVaultNote ? historyNote : historyFile).save(h) };
    this.history = new RecordLookup(
      historyRepo,
      { enabled: () => this.current.history.enabled, maxEntries: () => this.current.history.maxEntries, onChange: () => this.refreshHistory() },
    );
    // The note lives in the vault, and on "Reload app without saving" the plugin loads before the vault is indexed.
    this.app.workspace.onLayoutReady(() => void this.history.load());

    let lastErrorAt = 0;
    this.registerEditorExtension([
      this.settingsCompartment.of(settingsFacet.of(this.current)),
      thesaurusExtension({
        lookup: this.lookup,
        onResult: (result, view) => void this.history.lookedUp(result, pathOf(view)),
        onPick: (query, word, view) => void this.history.picked(query, pathOf(view), word),
        onError: (e) => {
          // One notice a minute is plenty; a dead Ollama would otherwise nag on every lookup (the box shows the error anyway).
          if (Date.now() - lastErrorAt < 60_000) return;
          lastErrorAt = Date.now();
          new Notice(`creative-thesaurus: ${e instanceof Error ? e.message : String(e)}`, 6000);
        },
      }),
      provenanceTooltip({ picksFor: (word, path) => picksFor(this.history.current, word, path), pathOf: (state) => state.field(editorInfoField, false)?.file?.path ?? null }),
    ]);

    this.addCommand({
      id: "lookup-at-cursor",
      name: "Look up at cursor",
      editorCallback: (_editor, view) => {
        const cm = (view as MarkdownView & { editor: { cm?: EditorView } }).editor.cm;
        cm?.dispatch({ effects: lookupNow.of(null) });
      },
    });

    this.registerView(HISTORY_VIEW_TYPE, (leaf: WorkspaceLeaf) => new HistoryView(leaf, {
      history: () => this.history.current,
      lookup: (text, signal) => {
        const q = parseQuery(text);
        if (!q) throw new Error("Nothing to look up.");
        return this.lookup.execute(q, signal); // a re-run from the pane is not a new command call: nothing is recorded
      },
      insert: (word) => {
        const md = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!md) { new Notice("creative-thesaurus: open a note to insert into."); return; }
        md.editor.replaceSelection(word);
        md.editor.focus();
      },
      openNote: (path) => void this.app.workspace.openLinkText(path, "", false),
      remove: (entry) => this.history.remove(entry.at, entry.query),
      clear: () => this.history.clear(),
      occurrences: (term, anchor) => this.occurrences(term, anchor || this.activePath()),
      activeStory: () => { const p = this.activePath(); return p ? this.storyOf(p) : null; },
      storyOf: (path) => this.storyOf(path),
      reveal: (path, line, ch) => void this.reveal(path, line, ch),
    }));
    this.addCommand({ id: "open-history", name: "Open thesaurus history", callback: () => void this.openHistory() });
    this.addCommand({ id: "clear-cache", name: "Clear cached answers", callback: () => void this.lookup.invalidate().then(() => new Notice("creative-thesaurus: cache cleared.")) });
    this.addRibbonIcon("book-a", "Open thesaurus history", () => void this.openHistory());

    this.addSettingTab(new CreativeThesaurusSettingsTab(this.app, this, {
      current: () => this.current,
      update: (next) => this.updateSettings(next),
      configDir: () => this.app.vault.configDir,
    }));
  }

  private activePath(): string | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path ?? null;
  }

  /** Every note with its front matter, from the metadata cache — the story is declared there (see StoryScope). */
  private notes(): NoteMeta[] {
    return this.app.vault.getMarkdownFiles().map((f) => ({ path: f.path, frontmatter: this.app.metadataCache.getFileCache(f)?.frontmatter }));
  }

  private storyOf(path: string): string | null {
    return storyOf(path, this.notes().map(projectScopeOf).filter((s): s is string => s !== null));
  }

  /** Every note of the anchor's story the term appears in, the anchor first, then by hit count. Reads are cached by Obsidian. */
  private async occurrences(term: string, anchor: string | null): Promise<Search> {
    const set = searchSet({ anchor, notes: this.notes(), mode: this.current.searchScope });
    const out: NoteHits[] = [];
    for (const path of set.paths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;
      const hits = findOccurrences(await this.app.vault.cachedRead(file), term, 50);
      if (hits.length) out.push({ path, hits });
    }
    return { story: set.story, notes: out.sort((a, b) => Number(b.path === anchor) - Number(a.path === anchor) || b.hits.length - a.hits.length) };
  }

  private async reveal(path: string, line: number, ch: number): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { active: true });
    const md = leaf.view instanceof MarkdownView ? leaf.view : null;
    if (!md) return;
    md.editor.setCursor({ line, ch });
    md.editor.scrollIntoView({ from: { line, ch }, to: { line, ch } }, true);
    md.editor.focus();
  }

  private async openHistory(): Promise<void> {
    const leaf = this.app.workspace.getLeavesOfType(HISTORY_VIEW_TYPE)[0] ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: HISTORY_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
    await this.history.load();
    (leaf.view as HistoryView).refresh();
  }

  private refreshHistory(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(HISTORY_VIEW_TYPE)) (leaf.view as HistoryView).refresh();
  }

  private async updateSettings(next: PluginSettings): Promise<void> {
    this.current = next;
    await this.settingsRepo.save(next);
    // Push the new settings into every open editor; the extension reacts via the facet.
    this.app.workspace.iterateAllLeaves((leaf) => {
      const editor = (leaf.view as { editor?: { cm?: EditorView } }).editor;
      editor?.cm?.dispatch({ effects: this.settingsCompartment.reconfigure(settingsFacet.of(next)) });
    });
  }
}

const pathOf = (view: EditorView): string => view.state.field(editorInfoField, false)?.file?.path ?? "";
