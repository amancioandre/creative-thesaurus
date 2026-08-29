/**
 * Minimal stand-in for the `obsidian` package, which ships types only and
 * cannot be imported at test time. Only what the adapters touch is modelled.
 */
import { StateField } from "@codemirror/state";

/** Obsidian's per-editor info; tests set a file path through `withFile`. */
export const editorInfoField = StateField.define<{ file: { path: string } | null }>({
  create: () => ({ file: null }),
  update: (v) => v,
});
export const withFile = (path: string | null) => editorInfoField.init(() => ({ file: path ? { path } : null }));

export class App {}
export class Plugin {
  app = new App();
  private data: unknown = undefined;
  async loadData(): Promise<unknown> { return this.data; }
  async saveData(d: unknown): Promise<void> { this.data = d; }
}
export class PluginSettingTab {
  containerEl: HTMLElement = document.createElement("div");
  constructor(public app: App, public plugin: Plugin) {}
  hide(): void {}
}
type ToggleCb = (v: boolean) => unknown;
type SliderCb = (v: number) => unknown;
export class ToggleComponent {
  value = false;
  onChangeCb: ToggleCb = () => undefined;
  setValue(v: boolean) { this.value = v; return this; }
  onChange(cb: ToggleCb) { this.onChangeCb = cb; return this; }
}
export class SliderComponent {
  value = 0;
  onChangeCb: SliderCb = () => undefined;
  setLimits(_min: number, _max: number, _step: number) { return this; }
  setValue(v: number) { this.value = v; return this; }
  setDynamicTooltip() { return this; }
  onChange(cb: SliderCb) { this.onChangeCb = cb; return this; }
}
export class Setting {
  static created: Setting[] = [];
  name = "";
  desc = "";
  toggle?: ToggleComponent;
  slider?: SliderComponent;
  dropdown?: DropdownComponent;
  text?: TextComponent;
  settingEl: HTMLElement;
  constructor(public containerEl: HTMLElement) { this.settingEl = containerEl.createDiv({ cls: "setting-item" }); Setting.created.push(this); }
  setName(n: string) { this.name = n; return this; }
  setDesc(d: string) { this.desc = d; return this; }
  setHeading() { return this; }
  addToggle(cb: (t: ToggleComponent) => unknown) { this.toggle = new ToggleComponent(); cb(this.toggle); return this; }
  addSlider(cb: (s: SliderComponent) => unknown) { this.slider = new SliderComponent(); cb(this.slider); return this; }
  addDropdown(cb: (d: DropdownComponent) => unknown) { this.dropdown = new DropdownComponent(); cb(this.dropdown); return this; }
  addText(cb: (t: TextComponent) => unknown) { this.text = new TextComponent(); cb(this.text); return this; }
}
export async function requestUrl(_req: unknown): Promise<{ status: number; json: unknown }> {
  return { status: 200, json: {} };
}
export class Notice {
  static shown: string[] = [];
  constructor(message: string) { Notice.shown.push(message); }
}
type StrCb = (v: string) => unknown;
export class DropdownComponent {
  value = "";
  options: Record<string, string> = {};
  onChangeCb: StrCb = () => undefined;
  addOptions(o: Record<string, string>) { this.options = o; return this; }
  setValue(v: string) { this.value = v; return this; }
  onChange(cb: StrCb) { this.onChangeCb = cb; return this; }
}
export class TextComponent {
  value = "";
  onChangeCb: StrCb = () => undefined;
  setPlaceholder(_p: string) { return this; }
  setValue(v: string) { this.value = v; return this; }
  onChange(cb: StrCb) { this.onChangeCb = cb; return this; }
}
export function setIcon(el: HTMLElement, icon: string): void { el.setAttribute("data-icon", icon); }
export class WorkspaceLeaf {}
export class ItemView {
  contentEl: HTMLElement = document.createElement("div");
  constructor(public leaf: WorkspaceLeaf) {}
  getViewType(): string { return ""; }
  getDisplayText(): string { return ""; }
  getIcon(): string { return ""; }
}

declare global {
  interface HTMLElement {
    addClass(cls: string): void;
    empty(): void;
    setText(text: string): void;
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomOpts): HTMLElementTagNameMap[K];
    createDiv(o?: DomOpts): HTMLElement;
    createSpan(o?: DomOpts): HTMLElement;
  }
  type DomOpts = { text?: string; cls?: string; attr?: Record<string, string> };
  function createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: DomOpts): HTMLElementTagNameMap[K];
  function createDiv(o?: DomOpts): HTMLElement;
  function createSpan(o?: DomOpts): HTMLElement;
}

export type SettingDefinitionItem = unknown;
