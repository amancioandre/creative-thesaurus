import { describe, it, expect } from "vitest";
import { Plugin } from "obsidian";
import { PluginDataSettingsRepository } from "../../../src/infrastructure/obsidian/PluginDataSettingsRepository";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/Settings";

describe("PluginDataSettingsRepository", () => {
  it("returns defaults when nothing was saved", async () => {
    expect(await new PluginDataSettingsRepository(new Plugin()).load()).toEqual(DEFAULT_SETTINGS);
  });
  it("round-trips settings and normalises on the way out", async () => {
    const repo = new PluginDataSettingsRepository(new Plugin());
    await repo.save({ ...DEFAULT_SETTINGS, idleMs: 900, enabled: false });
    const loaded = await repo.load();
    expect(loaded.idleMs).toBe(900);
    expect(loaded.enabled).toBe(false);
  });
  it("tolerates corrupt persisted data", async () => {
    const plugin = new Plugin();
    await plugin.saveData({ idleMs: "lots" });
    expect((await new PluginDataSettingsRepository(plugin).load()).idleMs).toBe(DEFAULT_SETTINGS.idleMs);
  });
});
