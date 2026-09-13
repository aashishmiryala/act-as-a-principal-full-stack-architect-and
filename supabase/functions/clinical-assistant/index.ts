// AIoT HealthGuard — Clinical RAG Assistant (Supabase Edge Function)
// ---------------------------------------------------------------------------
// Server-side retrieval-augmented answering over the `doc_chunks` corpus in
// Postgres. Builds a TF-IDF index per request, ranks passages by hybrid
// cosine + keyword-overlap similarity, and returns a grounded, cited answer.
// If an OPENAI_API_KEY (or LLM_API_URL) secret is configured the top passages
// are used as grounded LLM context; otherwise a deterministic extractive answer
// is synthesised so the assistant always works.
//
// Deploy: supabase functions deploy clinical-assistant --project-ref <ref>

interface DocChunk {
  id: string;
  doc_id: string;
  title: string;
  category: string;
  source: string;
  heading: string;
  content: string;
  tokens: number;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STOPWORDS = new Set(
  "a an the and or but if then of to in on for with without at by from as is are was were be been being this that these those it its into over under out up down off above below between within per via not no do does did can could should would may might will shall we you they he she i our your their his her them us".split(
    /\s+/,
  ),
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%°.\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

interface Indexed {
  chunk: DocChunk;
  vector: Map<string, number>;
  norm: number;
  termSet: Set<string>;
}

class TfidfStore {
  private docs: Indexed[] = [];
  private idf = new Map<string, number>();
  vocab = new Set<string>();

  constructor(chunks: DocChunk[]) {
    const df = new Map<string, number>();
    const tfPerDoc: Array<Map<string, number>> = [];
    for (const chunk of chunks) {
      const tokens = tokenize(`${chunk.title} ${chunk.heading} ${chunk.content}`);
      const tf = new Map<string, number>();
      for (const tok of tokens) {
        tf.set(tok, (tf.get(tok) ?? 0) + 1);
        this.vocab.add(tok);
      }
      tfPerDoc.push(tf);
      for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
    }
    const N = chunks.length || 1;
    for (const [term, count] of df) this.idf.set(term, Math.log((N + 1) / (count + 1)) + 1);
    chunks.forEach((chunk, i) => {
      const tf = tfPerDoc[i];
      const vector = new Map<string, number>();
      const maxTf = Math.max(...tf.values(), 1);
      for (const [term, freq] of tf) {
        vector.set(term, (0.5 + (0.5 * freq) / maxTf) * (this.idf.get(term) ?? 0));
      }
      let sumSq = 0;
      for (const w of vector.values()) sumSq += w * w;
      this.docs.push({ chunk, vector, norm: Math.sqrt(sumSq) || 1, termSet: new Set(tf.keys()) });
    });
  }

  private embed(query: string) {
    const tf = new Map<string, number>();
    for (const tok of tokenize(query)) tf.set(tok, (tf.get(tok) ?? 0) + 1);
    const vector = new Map<string, number>();
    const maxTf = Math.max(...tf.values(), 1);
    for (const [term, freq] of tf) {
      const idf = this.idf.get(term);
      if (idf === undefined) continue;
      vector.set(term, (0.5 + (0.5 * freq) / maxTf) * idf);
    }
    let sumSq = 0;
    for (const w of vector.values()) sumSq += w * w;
    return { vector, norm: Math.sqrt(sumSq) || 1, terms: new Set(tf.keys()) };
  }

  search(query: string, k = 4) {
    const q = this.embed(query);
    return this.docs
      .map((doc) => {
        let dot = 0;
        const [small, large] =
          q.vector.size < doc.vector.size ? [q.vector, doc.vector] : [doc.vector, q.vector];
        for (const [term, w] of small) {
          const other = large.get(term);
          if (other) dot += w * other;
        }
        const similarity = dot / (q.norm * doc.norm);
        let overlap = 0;
        for (const t of q.terms) if (doc.termSet.has(t)) overlap++;
        const keywordScore = q.terms.size ? overlap / q.terms.size : 0;
        const finalScore = 0.75 * similarity + 0.25 * keywordScore;
        return { chunk: doc.chunk, similarity, keywordScore, finalScore };
      })
      .filter((r) => r.finalScore > 0.001)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, k);
  }
}

function buildSnippet(content: string, queryTerms: Set<string>, maxLen = 240): string {
  const sentences = content.split(/(?<=[.!?])\s+/);
  let best = sentences[0] ?? content;
  let bestHits = -1;
  for (const s of sentences) {
    let hits = 0;
    for (const t of tokenize(s)) if (queryTerms.has(t)) hits++;
    if (hits > bestHits) {
      bestHits = hits;
      best = s;
    }
  }
  if (best.length > maxLen) best = best.slice(0, maxLen - 1).trimEnd() + "…";
  return best;
}

async function synthesiseLlm(query: string, retrieved: Array<{ title: string; heading: string; content: string }>) {
  const url = Deno.env.get("LLM_API_URL") ?? (Deno.env.get("OPENAI_API_KEY") ? "https://api.openai.com/v1/chat/completions" : "");
  const key = Deno.env.get("LLM_API_KEY") ?? Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!url) return null;
  const context = retrieved
    .slice(0, 4)
    .map((r, i) => `[${i + 1}] ${r.title} — ${r.heading}\n${r.content}`)
    .join("\n\n");
  const prompt = `You are the HealthGuard clinical assistant. Answer using ONLY the context below. Cite sources inline as [n]. If the context is insufficient, say so.\n\nContext:\n${context}\n\nQuestion: ${query}\n\nAnswer:`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model: Deno.env.get("LLM_MODEL") ?? "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? data?.content ?? data?.output_text ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const started = Date.now();
  try {
    const { query, k = 4 } = await req.json().catch(() => ({ query: "" }));
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/doc_chunks?select=*`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const chunks: DocChunk[] = res.ok ? await res.json() : [];

    const store = new TfidfStore(chunks);
    const hits = store.search(query, k);
    const queryTerms = new Set(tokenize(query));

    const retrieved = hits.map((r) => ({
      id: r.chunk.id,
      docId: r.chunk.doc_id,
      title: r.chunk.title,
      category: r.chunk.category,
      source: r.chunk.source,
      heading: r.chunk.heading,
      content: r.chunk.content,
      tokens: r.chunk.tokens,
      similarity: Number(r.similarity.toFixed(4)),
      keywordScore: Number(r.keywordScore.toFixed(4)),
      finalScore: Number(r.finalScore.toFixed(4)),
      snippet: buildSnippet(r.chunk.content, queryTerms),
    }));

    const citations = retrieved.slice(0, 3).map((r, i) => ({
      index: i + 1,
      title: r.title,
      source: r.source,
      heading: r.heading,
      similarity: r.similarity,
    }));

    let mode: "extractive" | "llm" = "llm";
    let answer = await synthesiseLlm(query, retrieved);
    if (!answer) {
      mode = "extractive";
      if (!retrieved.length) {
        answer =
          "I couldn't find anything relevant in the HealthGuard documentation for that question. Try rephrasing, or ask about vitals ranges, the anomaly ensemble, MQTT topics, device provisioning, alerts, or security.";
      } else {
        const confident = retrieved[0].finalScore >= 0.18;
        const lead = confident
          ? `Based on the HealthGuard documentation, here's what applies to "${query.trim()}":`
          : `I found some possibly-related documentation for "${query.trim()}":`;
        const bullets = retrieved.slice(0, 3).map((r, i) => `- ${r.snippet} [${i + 1}]`).join("\n");
        answer = `${lead}\n\n${bullets}`;
      }
    }

    return new Response(
      JSON.stringify({
        query,
        answer,
        citations,
        retrieved,
        latencyMs: Date.now() - started,
        mode,
        corpusChunks: chunks.length,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
