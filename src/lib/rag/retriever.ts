/**
 * RAG retriever + answer synthesiser.
 * ------------------------------------------------------------------
 * Ties the TF-IDF store to answer generation. Retrieval returns the top passages
 * with a highlighted snippet; synthesis produces a grounded, cited answer. If an
 * LLM endpoint is configured (`VITE_LLM_API_URL`) the passages are sent as
 * context; otherwise a deterministic extractive answer is composed locally so
 * the assistant always works offline.
 */

import type { RagAnswer, RagCitation, RetrievedChunk } from "@/types";
import { CORPUS } from "./corpus";
import { TfidfVectorStore, tokenize } from "./vectorStore";

const store = new TfidfVectorStore(CORPUS);

export const ragStats = {
  documents: new Set(CORPUS.map((c) => c.docId)).size,
  chunks: store.size,
  vocabulary: store.vocabSize,
};

/** Build a query-centred snippet: the sentence(s) with the most query-term hits. */
function buildSnippet(content: string, queryTerms: Set<string>, maxLen = 240): string {
  const sentences = content.split(/(?<=[.!?])\s+/);
  let best = sentences[0] ?? content;
  let bestHits = -1;
  for (const s of sentences) {
    const toks = tokenize(s);
    let hits = 0;
    for (const t of toks) if (queryTerms.has(t)) hits++;
    if (hits > bestHits) {
      bestHits = hits;
      best = s;
    }
  }
  if (best.length > maxLen) best = best.slice(0, maxLen - 1).trimEnd() + "…";
  return best;
}

export function retrieve(query: string, k = 4): RetrievedChunk[] {
  const queryTerms = new Set(tokenize(query));
  return store.search(query, k).map((r) => ({
    ...r.chunk,
    similarity: Number(r.similarity.toFixed(4)),
    keywordScore: Number(r.keywordScore.toFixed(4)),
    finalScore: Number(r.finalScore.toFixed(4)),
    snippet: buildSnippet(r.chunk.content, queryTerms),
  }));
}

function synthesiseExtractive(query: string, retrieved: RetrievedChunk[]): string {
  if (!retrieved.length) {
    return "I couldn't find anything relevant in the HealthGuard documentation for that question. Try rephrasing, or ask about vitals ranges, the anomaly ensemble, MQTT topics, device provisioning, alerts, or security.";
  }
  const top = retrieved[0];
  const confident = top.finalScore >= 0.18;

  const lead = confident
    ? `Based on the HealthGuard documentation, here's what applies to "${query.trim()}":`
    : `I found some possibly-related documentation for "${query.trim()}":`;

  const bullets = retrieved
    .slice(0, 3)
    .map((r, i) => `- ${r.snippet} [${i + 1}]`)
    .join("\n");

  return `${lead}\n\n${bullets}`;
}

function buildCitations(retrieved: RetrievedChunk[]): RagCitation[] {
  return retrieved.slice(0, 3).map((r, i) => ({
    index: i + 1,
    title: r.title,
    source: r.source,
    heading: r.heading,
    similarity: r.similarity,
  }));
}

async function synthesiseLlm(
  query: string,
  retrieved: RetrievedChunk[],
): Promise<string | null> {
  const url = import.meta.env.VITE_LLM_API_URL;
  const key = import.meta.env.VITE_LLM_API_KEY;
  if (!url) return null;

  const context = retrieved
    .slice(0, 4)
    .map((r, i) => `[${i + 1}] ${r.title} — ${r.heading}\n${r.content}`)
    .join("\n\n");

  const prompt = `You are the HealthGuard clinical assistant. Answer the question using ONLY the context below. Cite sources inline as [n]. If the context is insufficient, say so.\n\nContext:\n${context}\n\nQuestion: ${query}\n\nAnswer:`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (
      data?.choices?.[0]?.message?.content ??
      data?.content ??
      data?.output_text ??
      null
    );
  } catch {
    return null;
  }
}

export async function askAssistant(query: string, k = 4): Promise<RagAnswer> {
  const started = performance.now();
  const retrieved = retrieve(query, k);
  const citations = buildCitations(retrieved);

  let answer = await synthesiseLlm(query, retrieved);
  let mode: RagAnswer["mode"] = "llm";
  if (!answer) {
    answer = synthesiseExtractive(query, retrieved);
    mode = "extractive";
  }

  return {
    query,
    answer,
    citations,
    retrieved,
    latencyMs: Math.round(performance.now() - started),
    mode,
  };
}

export const SUGGESTED_QUESTIONS = [
  "What are the normal vital sign ranges?",
  "How does the anomaly detection ensemble score readings?",
  "What is the fall detection logic?",
  "Which MQTT topics does the fleet publish to?",
  "How are alerts escalated and acknowledged?",
  "How is patient data isolated with row-level security?",
  "How do I provision a new ESP32 node?",
  "What should I do for a hypoxemia alert?",
];
