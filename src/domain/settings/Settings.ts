export type LlmProvider = "off" | "ollama";

export interface DatamuseSettings {
  readonly enabled: boolean;
  /** Datamuse is keyless today; when a key becomes required it is sent as a query parameter. Stored in plaintext in data.json. */
  readonly apiKey: string;
}

export interface LlmSettings {
  readonly provider: LlmProvider;
  readonly ollamaUrl: string;
  readonly ollamaModel: string;
  /** Language the model should write its notes in. Empty = English. For writers who think in another language. */
  readonly explainIn: string;
}

export interface HistorySettings {
  readonly enabled: boolean;
  /** Keep the history as a note in the vault (visible, syncs with the notes) instead of a file in the plugin folder. */
  readonly inVaultNote: boolean;
  /** Vault-relative path of that note. */
  readonly notePath: string;
  readonly maxEntries: number;
}

export type SearchScope = "story" | "vault";

export interface PluginSettings {
  /** Master switch: when off, typing the trigger does nothing. */
  readonly enabled: boolean;
  /** Where "where else does this word appear" looks: the note's story (a Creative Writer project) or the whole vault. */
  readonly searchScope: SearchScope;
  /** What the writer types before the word: `/thesaurus::`, `/th::`… Longest match wins. */
  readonly triggers: readonly string[];
  /** Quiet time after the last keystroke before the lookup runs. */
  readonly idleMs: number;
  /** Suggestions shown per group (synonyms, alternatives, antonyms, related). */
  readonly maxPerGroup: number;
  readonly datamuse: DatamuseSettings;
  readonly llm: LlmSettings;
  readonly history: HistorySettings;
}

export const DEFAULT_TRIGGERS: readonly string[] = ["/thesaurus::", "/th::"];
export const DEFAULT_DATAMUSE: DatamuseSettings = { enabled: true, apiKey: "" };
export const DEFAULT_LLM: LlmSettings = { provider: "off", ollamaUrl: "http://localhost:11434", ollamaModel: "qwen2.5:7b", explainIn: "" };
export const DEFAULT_HISTORY: HistorySettings = { enabled: true, inVaultNote: false, notePath: "Creative Thesaurus/History.md", maxEntries: 500 };

export const DEFAULT_SETTINGS: PluginSettings = {
  enabled: true,
  searchScope: "story",
  triggers: DEFAULT_TRIGGERS,
  idleMs: 700,
  maxPerGroup: 8,
  datamuse: DEFAULT_DATAMUSE,
  llm: DEFAULT_LLM,
  history: DEFAULT_HISTORY,
};

export const IDLE_RANGE = [200, 3000, 50] as const;
export const PER_GROUP_RANGE = [3, 20, 1] as const;
export const MAX_ENTRIES_RANGE = [50, 5000, 50] as const;

const clampInt = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(v)));
const num = (v: unknown, range: readonly [number, number, number], fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? clampInt(v, range[0], range[1]) : fallback;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);

/**
 * Turns whatever was persisted (possibly from an older version, possibly
 * hand-edited) into a valid settings object. Unknown keys are dropped,
 * wrong types fall back to defaults, numbers are clamped.
 */
export function normalizeSettings(raw: unknown): PluginSettings {
  const r = obj(raw);
  const d = obj(r.datamuse), l = obj(r.llm), h = obj(r.history);
  return {
    enabled: bool(r.enabled, DEFAULT_SETTINGS.enabled),
    searchScope: r.searchScope === "vault" ? "vault" : "story",
    triggers: normalizeTriggers(r.triggers),
    idleMs: num(r.idleMs, IDLE_RANGE, DEFAULT_SETTINGS.idleMs),
    maxPerGroup: num(r.maxPerGroup, PER_GROUP_RANGE, DEFAULT_SETTINGS.maxPerGroup),
    datamuse: { enabled: bool(d.enabled, DEFAULT_DATAMUSE.enabled), apiKey: typeof d.apiKey === "string" ? d.apiKey.trim() : "" },
    llm: {
      provider: l.provider === "ollama" ? "ollama" : "off",
      ollamaUrl: str(l.ollamaUrl, DEFAULT_LLM.ollamaUrl),
      ollamaModel: str(l.ollamaModel, DEFAULT_LLM.ollamaModel),
      explainIn: typeof l.explainIn === "string" ? l.explainIn.trim() : "",
    },
    history: {
      enabled: bool(h.enabled, DEFAULT_HISTORY.enabled),
      inVaultNote: bool(h.inVaultNote, DEFAULT_HISTORY.inVaultNote),
      notePath: normalizeNotePath(h.notePath) ?? DEFAULT_HISTORY.notePath,
      maxEntries: num(h.maxEntries, MAX_ENTRIES_RANGE, DEFAULT_HISTORY.maxEntries),
    },
  };
}

/** Triggers are trimmed, deduplicated and sorted longest-first so `/thesaurus::` is tried before `/th::`. Empty list falls back to defaults. */
export function normalizeTriggers(raw: unknown): readonly string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? textToTriggers(raw) : [];
  const clean = [...new Set(list.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter((t) => t.length >= 2 && !/\s/.test(t)))];
  return clean.length ? clean.sort((a, b) => b.length - a.length || a.localeCompare(b)) : DEFAULT_TRIGGERS;
}

/** Trigger list as the settings box shows it: one per line. */
export const triggersToText = (triggers: readonly string[]): string => triggers.join("\n");
export const textToTriggers = (text: string): string[] => text.split(/[\n,]/).map((t) => t.trim()).filter(Boolean);

/** A vault-relative markdown path: trimmed, forward slashes, no leading slash, `.md` appended if missing; null when unusable. */
export function normalizeNotePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let p = raw.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
  if (!p || p.endsWith("/")) return null;
  if (!/\.md$/i.test(p)) p += ".md";
  return p;
}

/** True when the two configurations would talk to a different model. */
export function llmConfigEquals(a: LlmSettings, b: LlmSettings): boolean {
  return a.provider === b.provider && a.ollamaUrl === b.ollamaUrl && a.ollamaModel === b.ollamaModel && a.explainIn === b.explainIn;
}

/** True when settings changes would make a cached lookup stale (a different set of sources, or a different model). */
export function sourcesEqual(a: PluginSettings, b: PluginSettings): boolean {
  return a.datamuse.enabled === b.datamuse.enabled && a.datamuse.apiKey === b.datamuse.apiKey && llmConfigEquals(a.llm, b.llm) && a.maxPerGroup === b.maxPerGroup;
}
