/**
 * What "the story" is — the same contract as the Creative Writer plugin, read
 * from front matter so the two agree without depending on each other:
 *
 *   writing-target: 50000   or   story: true     declares the note's folder a project (the story);
 *   writing-scope: note                          makes that one note the project instead;
 *   creative-writer: false                       keeps a note (memo, research, review) out of it;
 *   creative-writer-*: …                         marks a note the other plugin wrote for itself.
 *
 * A note belongs to the innermost project whose scope contains it.
 */
export interface NoteMeta {
  readonly path: string;
  readonly frontmatter: unknown;
}

/** A folder prefix ending in "/" ("" for the vault root) or a single note's path. */
export type Scope = string;

export function pathInScope(path: string, scope: Scope): boolean {
  return scope.endsWith("/") || scope === "" ? path.startsWith(scope) : path === scope;
}

const fm = (raw: unknown): Record<string, unknown> => (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {});
const truthy = (v: unknown) => v === true || (typeof v === "string" && /^(true|yes|on)$/i.test(v.trim()));
const falsy = (v: unknown) => v === false || (typeof v === "string" && /^(false|no|off)$/i.test(v.trim()));

/** The scope a note declares as a project, or null. */
export function projectScopeOf(note: NoteMeta): Scope | null {
  const f = fm(note.frontmatter);
  const target = Number(f["writing-target"]);
  if (!((Number.isFinite(target) && target > 0) || truthy(f["story"]))) return null;
  if (f["writing-scope"] === "note") return note.path;
  const slash = note.path.lastIndexOf("/");
  return slash < 0 ? "" : note.path.slice(0, slash + 1);
}

/** `creative-writer: true|false`, or null when absent. */
export function creativeWriterFlag(frontmatter: unknown): boolean | null {
  const v = fm(frontmatter)["creative-writer"];
  return truthy(v) ? true : falsy(v) ? false : null;
}

/** A note some plugin wrote for itself — a log, a map, a history — never prose. */
export function isPluginDataNote(frontmatter: unknown): boolean {
  return Object.keys(fm(frontmatter)).some((k) => /^creative-(writer|thesaurus)-/.test(k));
}

/** The innermost project a path belongs to, or null when it is outside every story. */
export function storyOf(path: string, projects: readonly Scope[]): Scope | null {
  let best: Scope | null = null;
  for (const s of projects) if (pathInScope(path, s) && (best === null || s.length > best.length)) best = s;
  return best;
}

/** Whether a note is prose of the story: inside its scope, not flagged out, not plugin data. */
export function isStoryNote(note: NoteMeta, story: Scope): boolean {
  return pathInScope(note.path, story) && creativeWriterFlag(note.frontmatter) !== false && !isPluginDataNote(note.frontmatter);
}

export interface SearchInput {
  /** The note the search is about: where a word was picked, or the active note. Null when unknown. */
  readonly anchor: string | null;
  readonly notes: readonly NoteMeta[];
  /** "story": the anchor's story; "vault": every note. */
  readonly mode: "story" | "vault";
}

export interface SearchSet {
  readonly story: Scope | null;
  readonly paths: readonly string[];
}

/**
 * Which notes to search for a word. In story mode, the anchor's project;
 * outside every project, the anchor itself plus notes marked
 * `creative-writer: true` — the writer's own declaration of what is prose.
 * Plugin data notes and `creative-writer: false` notes are never searched.
 */
export function searchSet({ anchor, notes, mode }: SearchInput): SearchSet {
  const prose = notes.filter((n) => creativeWriterFlag(n.frontmatter) !== false && !isPluginDataNote(n.frontmatter));
  if (mode === "vault") return { story: null, paths: prose.map((n) => n.path) };
  const projects = notes.map(projectScopeOf).filter((s): s is Scope => s !== null);
  const story = anchor ? storyOf(anchor, projects) : null;
  if (story !== null) return { story, paths: prose.filter((n) => pathInScope(n.path, story)).map((n) => n.path) };
  const marked = prose.filter((n) => creativeWriterFlag(n.frontmatter) === true || n.path === anchor).map((n) => n.path);
  return { story: null, paths: marked };
}
