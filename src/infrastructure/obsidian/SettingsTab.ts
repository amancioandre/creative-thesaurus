import { type App, type Plugin, PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
import { IDLE_RANGE, MAX_ENTRIES_RANGE, normalizeNotePath, normalizeTriggers, PER_GROUP_RANGE, textToTriggers, triggersToText, type LlmProvider, type PluginSettings, type SearchScope } from "../../domain/settings/Settings";

/** What the tab needs from the outside world — not the whole plugin. */
export interface SettingsPort {
  current(): PluginSettings;
  update(next: PluginSettings): Promise<void>;
  /** The vault's configuration folder name (usually ".obsidian", but user-configurable). */
  configDir(): string;
}

const PROVIDERS: Record<LlmProvider, string> = { off: "Off", ollama: "Local (Ollama)" };
const SCOPES: Record<SearchScope, string> = { story: "The note's story", vault: "The whole vault" };
const SCOPE_DESC = "Where \"where else does this word appear\" looks, on hover in a note or in the history pane. The story is the Creative Writer project the note belongs to — the folder of a note with writing-target or story: true in its front matter; writing-scope: note narrows it to that note. Notes with creative-writer: false (memos, research) and plugin data notes are never searched. Outside every project: the note itself and notes marked creative-writer: true.";

/**
 * Settings are described once as definitions (Obsidian 1.13+: rendered by
 * the app and indexed for settings search) and read/written through dotted
 * keys. Older app versions fall back to the imperative renderer below.
 */
export class CreativeThesaurusSettingsTab extends PluginSettingTab {
  constructor(app: App, plugin: Plugin, private readonly port: SettingsPort) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      { name: "Enabled", desc: "Master switch. Off: typing a trigger does nothing; the \"Look up at cursor\" command still works.", control: { type: "toggle", key: "enabled" } },
      { name: "Triggers", desc: "What you type before the word, one per line. The box opens after a pause once something follows the trigger; two spaces after the word tell the plugin you have moved on.", control: { type: "text", key: "triggersText", placeholder: "/thesaurus::\n/th::" } },
      { name: "Pause before looking up", desc: "Milliseconds of quiet after the last keystroke before the lookup runs.", control: { type: "slider", key: "idleMs", min: IDLE_RANGE[0], max: IDLE_RANGE[1], step: IDLE_RANGE[2] } },
      { name: "Suggestions per group", desc: "How many synonyms, alternatives, antonyms and related words the box shows at most.", control: { type: "slider", key: "maxPerGroup", min: PER_GROUP_RANGE[0], max: PER_GROUP_RANGE[1], step: PER_GROUP_RANGE[2] } },
      { name: "Search in", desc: SCOPE_DESC, control: { type: "dropdown", key: "searchScope", options: SCOPES } },
      {
        type: "group",
        heading: "Datamuse",
        items: [
          { name: "Use Datamuse", desc: "A free web thesaurus (api.datamuse.com): synonyms, antonyms and related words for a word; rewordings for a phrase. The word you look up is sent to it; nothing else is.", control: { type: "toggle", key: "datamuse.enabled" } },
          { name: "Datamuse API key", desc: `Not needed today. When Datamuse starts requiring one, paste it here. ${this.keyWarning()}`, control: { type: "text", key: "datamuse.apiKey", placeholder: "(none)" } },
        ],
      },
      {
        type: "group",
        heading: "Local model",
        items: [
          { name: "Model", desc: "A local language model adds what a word list cannot: the register of each synonym, the nuance that separates it from your word, natural rewordings, an example sentence and a caution about common mistakes. Everything stays on this machine.", control: { type: "dropdown", key: "llm.provider", options: PROVIDERS } },
          { name: "Ollama URL", control: { type: "text", key: "llm.ollamaUrl", placeholder: "http://localhost:11434" } },
          { name: "Ollama model", desc: "Any chat model you have pulled. qwen2.5:7b answers in a few seconds and follows the JSON format well.", control: { type: "text", key: "llm.ollamaModel", placeholder: "qwen2.5:7b" } },
          { name: "Explain in", desc: "The language the model writes its notes in — Portuguese, Spanish, German… Empty: English. The suggested words are always English.", control: { type: "text", key: "llm.explainIn", placeholder: "English" } },
        ],
      },
      {
        type: "group",
        heading: "History",
        items: [
          { name: "Keep a history", desc: "Record every command call (and what you picked), shown in the history pane. Kept in the plugin folder, out of the file explorer.", control: { type: "toggle", key: "history.enabled" } },
          { name: "History as a vault note", desc: "Keep the history as a Markdown note in the vault instead — visible in the file explorer, synced with your notes. Reload after switching.", control: { type: "toggle", key: "history.inVaultNote" } },
          { name: "History note", desc: "Vault-relative path of that note. Takes effect at the next save; reload to read from a new path.", control: { type: "text", key: "history.notePathText", placeholder: "Creative Thesaurus/History.md" } },
          { name: "Entries kept", desc: "Oldest entries are dropped beyond this.", control: { type: "slider", key: "history.maxEntries", min: MAX_ENTRIES_RANGE[0], max: MAX_ENTRIES_RANGE[1], step: MAX_ENTRIES_RANGE[2] } },
        ],
      },
    ];
  }

  getControlValue(key: string): unknown {
    if (key === "triggersText") return triggersToText(this.port.current().triggers);
    if (key === "history.notePathText") return this.port.current().history.notePath;
    return key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), this.port.current());
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const c = this.port.current();
    if (key === "triggersText") { await this.port.update({ ...c, triggers: normalizeTriggers(textToTriggers(String(value ?? ""))) }); return; }
    if (key === "history.notePathText") { const p = normalizeNotePath(value); if (p) await this.port.update({ ...c, history: { ...c.history, notePath: p } }); return; }
    await this.port.update(setPath(c, key.split("."), value));
  }

  display(): void {
    // Obsidian ≥ 1.13 renders getSettingDefinitions(); older versions have no base display().
    const base = (PluginSettingTab.prototype as { display?: (this: PluginSettingTab) => void }).display;
    if (typeof base === "function") base.call(this);
    else this.renderLegacy();
  }

  /** Imperative rendering for Obsidian < 1.13. Same settings, same keys. */
  renderLegacy(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.port.current();
    const set = (patch: Partial<PluginSettings>) => this.port.update({ ...this.port.current(), ...patch });
    const llm = (patch: Partial<PluginSettings["llm"]>) => set({ llm: { ...this.port.current().llm, ...patch } });
    const history = (patch: Partial<PluginSettings["history"]>) => set({ history: { ...this.port.current().history, ...patch } });

    new Setting(containerEl).setName("Enabled").setDesc("Master switch.")
      .addToggle((t) => t.setValue(s.enabled).onChange((v) => set({ enabled: v })));
    new Setting(containerEl).setName("Triggers").setDesc("What you type before the word, one per line.")
      .addText((t) => t.setPlaceholder("/thesaurus::").setValue(triggersToText(s.triggers)).onChange((v) => set({ triggers: normalizeTriggers(textToTriggers(v)) })));
    new Setting(containerEl).setName("Pause before looking up").setDesc("Milliseconds of quiet after the last keystroke before the lookup runs.")
      .addSlider((sl) => sl.setLimits(IDLE_RANGE[0], IDLE_RANGE[1], IDLE_RANGE[2]).setValue(s.idleMs).onChange((v) => set({ idleMs: v })));
    new Setting(containerEl).setName("Suggestions per group")
      .addSlider((sl) => sl.setLimits(PER_GROUP_RANGE[0], PER_GROUP_RANGE[1], PER_GROUP_RANGE[2]).setValue(s.maxPerGroup).onChange((v) => set({ maxPerGroup: v })));

    new Setting(containerEl).setName("Search in").setDesc(SCOPE_DESC)
      .addDropdown((d) => d.addOptions(SCOPES).setValue(s.searchScope).onChange((v) => set({ searchScope: v as SearchScope })));

    new Setting(containerEl).setName("Datamuse").setHeading();
    new Setting(containerEl).setName("Use Datamuse").setDesc("A free web thesaurus. The word you look up is sent to it; nothing else is.")
      .addToggle((t) => t.setValue(s.datamuse.enabled).onChange((v) => set({ datamuse: { ...this.port.current().datamuse, enabled: v } })));
    new Setting(containerEl).setName("Datamuse API key").setDesc(`Not needed today. ${this.keyWarning()}`)
      .addText((t) => t.setPlaceholder("(none)").setValue(s.datamuse.apiKey).onChange((v) => set({ datamuse: { ...this.port.current().datamuse, apiKey: v.trim() } })));

    new Setting(containerEl).setName("Local model").setHeading();
    new Setting(containerEl).setName("Model").setDesc("A local model adds register, nuance, rewordings, an example and a caution. Everything stays on this machine.")
      .addDropdown((d) => d.addOptions(PROVIDERS).setValue(s.llm.provider).onChange((v) => llm({ provider: v as LlmProvider })));
    new Setting(containerEl).setName("Ollama URL")
      .addText((t) => t.setPlaceholder("http://localhost:11434").setValue(s.llm.ollamaUrl).onChange((v) => llm({ ollamaUrl: v })));
    new Setting(containerEl).setName("Ollama model").setDesc("Any chat model you have pulled.")
      .addText((t) => t.setPlaceholder("qwen2.5:7b").setValue(s.llm.ollamaModel).onChange((v) => llm({ ollamaModel: v })));
    new Setting(containerEl).setName("Explain in").setDesc("The language the model writes its notes in. Empty: English.")
      .addText((t) => t.setPlaceholder("English").setValue(s.llm.explainIn).onChange((v) => llm({ explainIn: v })));

    new Setting(containerEl).setName("History").setHeading();
    new Setting(containerEl).setName("Keep a history").setDesc("Record every command call, shown in the history pane. Kept in the plugin folder.")
      .addToggle((t) => t.setValue(s.history.enabled).onChange((v) => history({ enabled: v })));
    new Setting(containerEl).setName("History as a vault note").setDesc("Keep the history as a Markdown note in the vault instead. Reload after switching.")
      .addToggle((t) => t.setValue(s.history.inVaultNote).onChange((v) => history({ inVaultNote: v })));
    new Setting(containerEl).setName("History note").setDesc("Vault-relative path of the note that keeps the history.")
      .addText((t) => t.setPlaceholder("Creative Thesaurus/History.md").setValue(s.history.notePath).onChange((v) => { const p = normalizeNotePath(v); if (p) void history({ notePath: p }); }));
    new Setting(containerEl).setName("Entries kept")
      .addSlider((sl) => sl.setLimits(MAX_ENTRIES_RANGE[0], MAX_ENTRIES_RANGE[1], MAX_ENTRIES_RANGE[2]).setValue(s.history.maxEntries).onChange((v) => history({ maxEntries: v })));
  }

  private keyWarning(): string {
    return `Stored in PLAINTEXT in this vault's ${this.port.configDir()}/plugins/creative-thesaurus/data.json. If the vault syncs, the key syncs with it.`;
  }
}

/** Immutable deep set along a key path. */
function setPath<T>(obj: T, path: string[], value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const o = obj as unknown as Record<string, unknown>;
  return { ...o, [head!]: setPath(o[head!], rest, value) } as T;
}
