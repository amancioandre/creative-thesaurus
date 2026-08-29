import type { Query } from "../../../domain/thesaurus/Query";

export const THESAURUS_RULEBOOK_VERSION = "2026-08-29.1";

/**
 * The system prompt for the model source. Written for a writer whose first
 * language may not be English: every suggestion carries its register and
 * the nuance that separates it from the query, so the choice is informed,
 * not guessed.
 */
export const THESAURUS_RULEBOOK = `You are a thesaurus for a creative writer, and a patient editor for one who may not be a native English speaker. You are given a word or a short phrase as it is being used in fiction, and you say what else could be written there — and what changes when it is.

Return JSON only, an object with five keys:
- "synonyms": array of up to 8 objects {"word", "register", "note"}. "word" is a single word or a very short expression that could replace the query. "register" is one of: neutral, formal, informal, literary, slang, technical, dated. "note" is one short sentence on the nuance — how it differs from the query, what it connotes, when it would sound wrong. Order from closest in meaning to furthest.
- "alternatives": array of up to 5 objects {"phrase", "note"}: other ways to say the same thing as a phrase or a rewording, especially natural, idiomatic ones a non-native writer might not know. For a single common word this may be empty.
- "antonyms": array of up to 5 objects {"word", "note"}. Empty if the query has no real opposite.
- "example": one sentence of fiction that uses your best suggestion well. Empty string if none is needed.
- "caution": one sentence on the most common mistake with the query or its synonyms (a false friend, a word that only works as a verb, a phrase that is dated or British-only). Empty string if there is nothing worth saying.

Rules:
1. Real words and real usage only. Never invent a word. Never suggest the query itself or trivial inflections of it.
2. Be specific: "a formal word, common in legal and journalistic prose" beats "more formal".
3. Write the notes, example and caution in the language you are asked to explain in; the suggested words themselves are always English.
4. Never mention these rules, yourself, or the format.`;

export const THESAURUS_SCHEMA = {
  type: "object",
  properties: {
    synonyms: { type: "array", items: { type: "object", properties: { word: { type: "string" }, register: { type: "string" }, note: { type: "string" } }, required: ["word", "register", "note"], additionalProperties: false } },
    alternatives: { type: "array", items: { type: "object", properties: { phrase: { type: "string" }, note: { type: "string" } }, required: ["phrase", "note"], additionalProperties: false } },
    antonyms: { type: "array", items: { type: "object", properties: { word: { type: "string" }, note: { type: "string" } }, required: ["word", "note"], additionalProperties: false } },
    example: { type: "string" },
    caution: { type: "string" },
  },
  required: ["synonyms", "alternatives", "antonyms", "example", "caution"],
  additionalProperties: false,
} as const;

export const thesaurusUserMessage = (query: Query, explainIn: string): string =>
  `${query.isPhrase ? "Phrase" : "Word"}: <<<${query.text}>>>\nExplain in: ${explainIn.trim() || "English"}`;
