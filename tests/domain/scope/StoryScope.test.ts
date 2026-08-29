import { describe, it, expect } from "vitest";
import { creativeWriterFlag, isPluginDataNote, isStoryNote, projectScopeOf, searchSet, storyOf } from "../../../src/domain/scope/StoryScope";

const notes = [
  { path: "Novel/Novel.md", frontmatter: { "writing-target": 80000 } },
  { path: "Novel/Ch 1.md", frontmatter: {} },
  { path: "Novel/Ch 2.md", frontmatter: { "creative-writer": "yes" } },
  { path: "Novel/Notes/Research.md", frontmatter: { "creative-writer": false } },
  { path: "Novel/Story map.md", frontmatter: { "creative-writer": false, "creative-writer-storymap": 2 } },
  { path: "Novel/Part 2/Part.md", frontmatter: { story: true } },
  { path: "Novel/Part 2/Ch 9.md", frontmatter: {} },
  { path: "Poems/Ode.md", frontmatter: { "writing-target": 300, "writing-scope": "note" } },
  { path: "Poems/Draft.md", frontmatter: {} },
  { path: "Journal/Today.md", frontmatter: { "creative-writer": true } },
  { path: "Recipes/Soup.md", frontmatter: {} },
  { path: "Creative Thesaurus/History.md", frontmatter: { "creative-thesaurus-history": 1 } },
];

describe("StoryScope", () => {
  it("reads a project from writing-target or story: true, folder or single note", () => {
    expect(projectScopeOf(notes[0]!)).toBe("Novel/");
    expect(projectScopeOf(notes[5]!)).toBe("Novel/Part 2/");
    expect(projectScopeOf(notes[7]!)).toBe("Poems/Ode.md");
    expect(projectScopeOf(notes[1]!)).toBeNull();
    expect(projectScopeOf({ path: "Root.md", frontmatter: { "writing-target": "5000" } })).toBe("");
  });
  it("reads the creative-writer flag in its spellings and spots plugin data notes", () => {
    expect(creativeWriterFlag({ "creative-writer": "yes" })).toBe(true);
    expect(creativeWriterFlag({ "creative-writer": "off" })).toBe(false);
    expect(creativeWriterFlag({})).toBeNull();
    expect(isPluginDataNote(notes[4]!.frontmatter)).toBe(true);
    expect(isPluginDataNote(notes[11]!.frontmatter)).toBe(true);
    expect(isPluginDataNote({ "creative-writer": true })).toBe(false);
  });
  it("assigns a path to the innermost project", () => {
    const projects = ["Novel/", "Novel/Part 2/", "Poems/Ode.md"];
    expect(storyOf("Novel/Ch 1.md", projects)).toBe("Novel/");
    expect(storyOf("Novel/Part 2/Ch 9.md", projects)).toBe("Novel/Part 2/");
    expect(storyOf("Poems/Draft.md", projects)).toBeNull();
    expect(isStoryNote(notes[3]!, "Novel/")).toBe(false);
    expect(isStoryNote(notes[1]!, "Novel/")).toBe(true);
  });
  it("searches the anchor's story, without memos and data notes", () => {
    expect(searchSet({ anchor: "Novel/Ch 1.md", notes, mode: "story" })).toEqual({ story: "Novel/", paths: ["Novel/Novel.md", "Novel/Ch 1.md", "Novel/Ch 2.md", "Novel/Part 2/Part.md", "Novel/Part 2/Ch 9.md"] });
    expect(searchSet({ anchor: "Novel/Part 2/Ch 9.md", notes, mode: "story" }).paths).toEqual(["Novel/Part 2/Part.md", "Novel/Part 2/Ch 9.md"]);
  });
  it("outside every story searches the anchor and the notes marked creative-writer: true", () => {
    expect(searchSet({ anchor: "Recipes/Soup.md", notes, mode: "story" })).toEqual({ story: null, paths: ["Novel/Ch 2.md", "Journal/Today.md", "Recipes/Soup.md"] });
    expect(searchSet({ anchor: null, notes, mode: "story" }).paths).toEqual(["Novel/Ch 2.md", "Journal/Today.md"]);
  });
  it("vault mode searches every prose note", () => {
    const { story, paths } = searchSet({ anchor: "Novel/Ch 1.md", notes, mode: "vault" });
    expect(story).toBeNull();
    expect(paths).toHaveLength(9);
    expect(paths).not.toContain("Novel/Notes/Research.md");
  });
});
