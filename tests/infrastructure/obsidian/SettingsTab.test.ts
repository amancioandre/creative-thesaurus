import { describe, it, expect, beforeEach } from "vitest";
import { App, Plugin, Setting } from "obsidian";
import { CreativeThesaurusSettingsTab } from "../../../src/infrastructure/obsidian/SettingsTab";
import { DEFAULT_SETTINGS, type PluginSettings } from "../../../src/domain/settings/Settings";

const names = (items: unknown[]): string[] =>
  items.flatMap((i) => { const o = i as { name?: string; items?: unknown[] }; return o.items ? names(o.items) : o.name ? [o.name] : []; });

describe("CreativeThesaurusSettingsTab", () => {
  let saved: PluginSettings[];
  let current: PluginSettings;
  let tab: CreativeThesaurusSettingsTab;

  beforeEach(() => {
    Setting.created = [];
    saved = [];
    current = DEFAULT_SETTINGS;
    tab = new CreativeThesaurusSettingsTab(new App(), new Plugin(), { current: () => current, update: async (s) => { saved.push(s); current = s; }, configDir: () => ".obsidian-custom" });
  });

  describe("declarative definitions (Obsidian ≥ 1.13)", () => {
    it("declares every setting with a searchable name", () => {
      expect(names(tab.getSettingDefinitions())).toEqual(["Enabled", "Triggers", "Pause before looking up", "Suggestions per group", "Search in", "Use Datamuse", "Datamuse API key", "Model", "Ollama URL", "Ollama model", "Explain in", "Keep a history", "History as a vault note", "History note", "Entries kept"]);
    });
    it("warns that the key is stored in plaintext, naming the config folder", () => {
      const key = (tab.getSettingDefinitions() as Array<{ items?: Array<{ name: string; desc: string }> }>).flatMap((d) => d.items ?? []).find((d) => d.name === "Datamuse API key")!;
      expect(key.desc).toContain("PLAINTEXT");
      expect(key.desc).toContain(".obsidian-custom/plugins/creative-thesaurus/data.json");
    });
    it("reads values through dotted keys and the text views", () => {
      expect(tab.getControlValue("enabled")).toBe(true);
      expect(tab.getControlValue("llm.ollamaModel")).toBe("qwen2.5:7b");
      expect(tab.getControlValue("triggersText")).toBe("/thesaurus::\n/th::");
      expect(tab.getControlValue("history.notePathText")).toBe("Creative Thesaurus/History.md");
      expect(tab.getControlValue("nope.nope")).toBeUndefined();
    });
    it("writes values immutably through dotted keys", async () => {
      await tab.setControlValue("llm.provider", "ollama");
      await tab.setControlValue("idleMs", 500);
      expect(current.llm.provider).toBe("ollama");
      expect(current.idleMs).toBe(500);
      expect(current.llm).not.toBe(DEFAULT_SETTINGS.llm);
      expect(DEFAULT_SETTINGS.llm.provider).toBe("off");
    });
    it("normalises the trigger list and the note path", async () => {
      await tab.setControlValue("triggersText", "/syn::\n/thesaurus::");
      expect(current.triggers).toEqual(["/thesaurus::", "/syn::"]);
      await tab.setControlValue("history.notePathText", "  Notes/hist ");
      expect(current.history.notePath).toBe("Notes/hist.md");
      await tab.setControlValue("history.notePathText", "");
      expect(current.history.notePath).toBe("Notes/hist.md");
    });
  });

  describe("legacy renderer (Obsidian < 1.13)", () => {
    it("renders the same settings and saves through the same port", async () => {
      tab.display();
      const by = (name: string) => Setting.created.find((s) => s.name === name)!;
      expect(Setting.created.map((s) => s.name)).toEqual(expect.arrayContaining(["Enabled", "Triggers", "Use Datamuse", "Model", "Ollama model", "Explain in", "Keep a history", "History note", "Entries kept"]));
      await by("Enabled").toggle!.onChangeCb(false);
      await by("Model").dropdown!.onChangeCb("ollama");
      await by("Triggers").text!.onChangeCb("/x::");
      await by("History note").text!.onChangeCb("h");
      await by("History as a vault note").toggle!.onChangeCb(true);
      await by("Entries kept").slider!.onChangeCb(100);
      expect(current.enabled).toBe(false);
      expect(current.llm.provider).toBe("ollama");
      expect(current.triggers).toEqual(["/x::"]);
      expect(current.history).toMatchObject({ notePath: "h.md", maxEntries: 100, inVaultNote: true });
      expect(saved).toHaveLength(6);
    });
  });
});
