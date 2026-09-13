/**
 * TF-IDF vector store with cosine similarity.
 * ------------------------------------------------------------------
 * A dependency-free semantic index over the documentation corpus. We build an
 * IDF-weighted term-frequency vector per chunk at construction time, then score
 * queries by cosine similarity. This mirrors what a pgvector / embedding store
 * would do server-side, but runs entirely in the browser so the RAG assistant
 * works offline with zero external calls.
 */

import type { DocChunk } from "@/types";

const STOPWORDS = new Set(
  "a an the and or but if then of to in on for with without at by from as is are was were be been being this that these those it its it's into over under out up down off above below between within per via not no do does did can could should would may might will shall we you they he she i our your their his her them us".split(
    /\s+/,
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%°.\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

interface IndexedDoc {
  chunk: DocChunk;
  vector: Map<string, number>;
  norm: number;
  termSet: Set<string>;
}

export class TfidfVectorStore {
  private docs: IndexedDoc[] = [];
  private idf = new Map<string, number>();
  private vocabulary = new Set<string>();

  constructor(chunks: DocChunk[]) {
    this.build(chunks);
  }

  get size(): number {
    return this.docs.length;
  }
  get vocabSize(): number {
    return this.vocabulary.size;
  }

  private build(chunks: DocChunk[]): void {
    const df = new Map<string, number>();
    const tfPerDoc: Array<Map<string, number>> = [];

    for (const chunk of chunks) {
      const tokens = tokenize(`${chunk.title} ${chunk.heading} ${chunk.content}`);
      const tf = new Map<string, number>();
      for (const tok of tokens) {
        tf.set(tok, (tf.get(tok) ?? 0) + 1);
        this.vocabulary.add(tok);
      }
      tfPerDoc.push(tf);
      for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
    }

    const N = chunks.length;
    for (const [term, count] of df) {
      // Smoothed IDF.
      this.idf.set(term, Math.log((N + 1) / (count + 1)) + 1);
    }

    chunks.forEach((chunk, i) => {
      const tf = tfPerDoc[i];
      const vector = new Map<string, number>();
      const maxTf = Math.max(...tf.values(), 1);
      for (const [term, freq] of tf) {
        const weight = (0.5 + (0.5 * freq) / maxTf) * (this.idf.get(term) ?? 0);
        vector.set(term, weight);
      }
      let sumSq = 0;
      for (const w of vector.values()) sumSq += w * w;
      this.docs.push({
        chunk,
        vector,
        norm: Math.sqrt(sumSq) || 1,
        termSet: new Set(tf.keys()),
      });
    });
  }

  private embedQuery(query: string): { vector: Map<string, number>; norm: number; terms: Set<string> } {
    const tokens = tokenize(query);
    const tf = new Map<string, number>();
    for (const tok of tokens) tf.set(tok, (tf.get(tok) ?? 0) + 1);
    const vector = new Map<string, number>();
    const maxTf = Math.max(...tf.values(), 1);
    for (const [term, freq] of tf) {
      const idf = this.idf.get(term);
      if (idf === undefined) continue; // out-of-vocabulary term
      vector.set(term, (0.5 + (0.5 * freq) / maxTf) * idf);
    }
    let sumSq = 0;
    for (const w of vector.values()) sumSq += w * w;
    return { vector, norm: Math.sqrt(sumSq) || 1, terms: new Set(tf.keys()) };
  }

  /** Return the top-k chunks by cosine similarity, with a keyword-overlap bonus. */
  search(
    query: string,
    k = 4,
  ): Array<{ chunk: DocChunk; similarity: number; keywordScore: number; finalScore: number }> {
    const q = this.embedQuery(query);
    const results = this.docs.map((doc) => {
      let dot = 0;
      // Iterate the smaller vector for efficiency.
      const [small, large] =
        q.vector.size < doc.vector.size ? [q.vector, doc.vector] : [doc.vector, q.vector];
      for (const [term, w] of small) {
        const other = large.get(term);
        if (other) dot += w * other;
      }
      const similarity = dot / (q.norm * doc.norm);

      // Keyword overlap: fraction of query terms present in the chunk.
      let overlap = 0;
      for (const t of q.terms) if (doc.termSet.has(t)) overlap++;
      const keywordScore = q.terms.size ? overlap / q.terms.size : 0;

      const finalScore = 0.75 * similarity + 0.25 * keywordScore;
      return { chunk: doc.chunk, similarity, keywordScore, finalScore };
    });

    return results
      .filter((r) => r.finalScore > 0.001)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, k);
  }
}
