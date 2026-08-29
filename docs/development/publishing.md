# Publishing

Same process as the sibling plugin.

- `manifest.json` — `id` (`creative-thesaurus`, must never change), `version`, `minAppVersion`, `isDesktopOnly: true`.
- `versions.json` — plugin version → minimum app version; updated by `npm version`.
- Build: `npm run build` → `main.js` (gitignored; attached to releases, not committed).
- Guidelines: no `innerHTML` with untrusted content, no default hotkeys, sentence-case settings, no `console.log`, network only through `requestUrl` (Datamuse, Ollama).

```bash
npm version patch        # bumps package.json, manifest.json, versions.json; commits + tags
npm run release:check
git push --follow-tags   # CI builds, attests and creates the GitHub release
```

Things a reviewer may ask about: the plaintext Datamuse key (the setting says so); the word sent to Datamuse (the README's privacy section says so); `isDesktopOnly` because the model path assumes a local Ollama.
