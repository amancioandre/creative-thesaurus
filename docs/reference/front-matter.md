# The story

"Where else does this word appear" and the pane's *This story* filter are limited to **the story the note belongs to** — the same thing the [Creative Writer](https://amancioandre.github.io/creative-writer/) plugin calls a project. The definition is front matter, read from Obsidian's metadata cache, so the two plugins agree without depending on each other. Creative Writer does not need to be installed.

| Key, in any note | Effect |
|---|---|
| `writing-target: 80000` or `story: true` | Declares the note's **folder** the story. Every note under it (any depth) belongs to it. |
| `writing-scope: note` | …only that one note, not the folder. |
| `creative-writer: false` | Keeps a note out of the story — memos, research, reviews. Never searched. |
| `creative-writer: true` | Outside any project, marks a note as prose: searched along with the note itself. |
| `creative-writer-*`, `creative-thesaurus-*` | A note a plugin wrote for itself (log, map, history). Never searched. |

A note belongs to the **innermost** project containing it: with `Novel/Novel.md` (`writing-target`) and `Novel/Part 2/Part.md` (`story: true`), a chapter in `Part 2` belongs to Part 2.

Outside every project, the search covers the note itself plus notes marked `creative-writer: true`. *Search in* → *The whole vault* ignores all of this except the exclusions.
