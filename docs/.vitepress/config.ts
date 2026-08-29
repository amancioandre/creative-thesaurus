import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Creative Thesaurus",
  description: "An Obsidian plugin for creative writers: type /thesaurus::word, pause, pick from a floating box. Datamuse and/or a local model; a history pane scoped to the story.",
  base: "/creative-thesaurus/",
  lang: "en-GB",
  lastUpdated: true,
  cleanUrls: true,
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/creative-thesaurus/favicon.svg" }]],
  themeConfig: {
    logo: "/favicon.svg",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/commands" },
      { text: "Development", link: "/development/architecture" },
      { text: "GitHub", link: "https://github.com/amancioandre/creative-thesaurus" },
    ],
    sidebar: {
      "/guide/": [
        { text: "Guide", items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "The box", link: "/guide/the-box" },
          { text: "Sources", link: "/guide/sources" },
          { text: "History & provenance", link: "/guide/history" },
        ] },
      ],
      "/reference/": [
        { text: "Reference", items: [
          { text: "Commands", link: "/reference/commands" },
          { text: "Settings", link: "/reference/settings" },
          { text: "The story (front matter)", link: "/reference/front-matter" },
          { text: "Files & privacy", link: "/reference/data-and-privacy" },
        ] },
      ],
      "/development/": [
        { text: "Development", items: [
          { text: "Architecture", link: "/development/architecture" },
          { text: "Testing", link: "/development/testing" },
          { text: "Publishing", link: "/development/publishing" },
        ] },
      ],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/amancioandre/creative-thesaurus" }],
    search: { provider: "local" },
    editLink: { pattern: "https://github.com/amancioandre/creative-thesaurus/edit/main/docs/:path", text: "Edit this page" },
    footer: { message: "MIT licensed. Word data from Datamuse.", copyright: "© André Amnc" },
    outline: [2, 3],
  },
});
