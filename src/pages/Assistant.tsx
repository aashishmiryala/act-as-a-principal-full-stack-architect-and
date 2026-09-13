import { useRef, useState } from "react";
import {
  Bot,
  BookOpen,
  CornerDownLeft,
  FileText,
  Layers,
  Loader2,
  Search,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import type { RagAnswer } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Badge";
import { askAssistant, ragStats, SUGGESTED_QUESTIONS } from "@/lib/rag/retriever";
import { CATEGORY_LABELS, CORPUS_TOKEN_COUNT } from "@/lib/rag/corpus";
import { formatNumber } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";

interface Turn {
  id: string;
  question: string;
  answer: RagAnswer | null;
}

export default function Assistant() {
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || loading) return;
    setQuery("");
    const id = `turn_${Date.now()}`;
    setTurns((t) => [...t, { id, question, answer: null }]);
    setLoading(true);
    const answer = await askAssistant(question);
    setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, answer } : turn)));
    setLoading(false);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="RAG Clinical Assistant"
        description="Grounded answers retrieved from the HealthGuard documentation corpus."
        icon={<Bot className="h-6 w-6" />}
        actions={
          <Chip tone="brand">
            <Sparkles className="h-3.5 w-3.5" />
            {import.meta.env.VITE_LLM_API_URL ? "LLM synthesis" : "Extractive mode"}
          </Chip>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chat column */}
        <Card className="flex h-[calc(100vh-15rem)] min-h-[520px] flex-col lg:col-span-2">
          <CardHeader
            title="Ask about protocols, devices, ML or security"
            subtitle={`${ragStats.chunks} chunks · ${ragStats.documents} documents · TF-IDF + cosine retrieval`}
            icon={<Search className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
          />

          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 pb-2">
            {turns.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/20">
                  <BookOpen className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-100">Ask the knowledge base anything</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-ink-400">
                    Answers are retrieved from the corpus and cited. Try one of these:
                  </p>
                </div>
                <div className="flex max-w-lg flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => ask(q)}
                      className="chip cursor-pointer border-white/10 bg-white/5 text-ink-300 hover:border-brand-400/30 hover:bg-white/10"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn) => (
              <div key={turn.id} className="space-y-3">
                {/* user */}
                <div className="flex items-start justify-end gap-2.5">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500/15 px-3.5 py-2.5 text-sm text-ink-50 ring-1 ring-brand-400/20">
                    {turn.question}
                  </div>
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/5 text-ink-300">
                    <UserIcon className="h-4 w-4" />
                  </div>
                </div>

                {/* assistant */}
                <div className="flex items-start gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {turn.answer === null ? (
                      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-white/[0.03] px-3.5 py-2.5 text-sm text-ink-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Retrieving passages…
                      </div>
                    ) : (
                      <AnswerBlock answer={turn.answer} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(query);
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  className="input pr-10"
                  placeholder={`Ask a question, ${user?.fullName?.split(" ")[0] ?? "there"}…`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <CornerDownLeft className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600" />
              </div>
              <button type="submit" className="btn-primary" disabled={loading || !query.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
              </button>
            </form>
          </div>
        </Card>

        {/* Corpus / retrieval sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Knowledge corpus"
              subtitle="Indexed, in-browser vector store"
              icon={<Layers className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
            />
            <div className="grid grid-cols-2 gap-3 px-4 pb-4">
              <Metric value={ragStats.documents} label="Documents" />
              <Metric value={ragStats.chunks} label="Chunks" />
              <Metric value={formatNumber(ragStats.vocabulary)} label="Vocabulary" />
              <Metric value={formatNumber(CORPUS_TOKEN_COUNT)} label="Tokens" />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Coverage"
              subtitle="Documentation categories"
              icon={<FileText className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
            />
            <div className="flex flex-wrap gap-2 px-4 pb-4">
              {Object.values(CATEGORY_LABELS).map((label) => (
                <Chip key={label} tone="neutral">
                  {label}
                </Chip>
              ))}
            </div>
          </Card>

          {turns.length > 0 && turns[turns.length - 1].answer && (
            <RetrievalCard answer={turns[turns.length - 1].answer!} />
          )}
        </div>
      </div>
    </div>
  );
}

function AnswerBlock({ answer }: { answer: RagAnswer }) {
  return (
    <div className="rounded-2xl rounded-tl-sm bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/5">
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-100">{answer.answer}</div>
      {answer.citations.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-white/5 pt-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Sources</div>
          {answer.citations.map((c) => (
            <div key={c.index} className="flex items-center gap-2 text-[11px] text-ink-400">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-brand-500/15 text-[9px] font-bold text-brand-300">
                {c.index}
              </span>
              <span className="font-medium text-ink-300">{c.title}</span>
              <span className="text-ink-600">·</span>
              <span className="font-mono text-ink-500">{c.source}</span>
              <span className="ml-auto tabular-nums text-ink-600">
                {(c.similarity * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-[10px] text-ink-600">
        <Chip tone={answer.mode === "llm" ? "violet" : "brand"}>{answer.mode}</Chip>
        <span>{answer.latencyMs} ms · {answer.retrieved.length} passages retrieved</span>
      </div>
    </div>
  );
}

function RetrievalCard({ answer }: { answer: RagAnswer }) {
  return (
    <Card>
      <CardHeader
        title="Retrieved passages"
        subtitle="Ranked by hybrid similarity score"
        icon={<Search className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
      />
      <div className="space-y-2 px-4 pb-4">
        {answer.retrieved.map((r, i) => (
          <div key={r.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-ink-100">
                {i + 1}. {r.title}
              </span>
              <span className="shrink-0 text-[10px] font-semibold tabular-nums text-brand-300">
                {(r.finalScore * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] text-ink-400">{r.snippet}</p>
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-600">
              <span>cos {(r.similarity * 100).toFixed(0)}%</span>
              <span>·</span>
              <span>kw {(r.keywordScore * 100).toFixed(0)}%</span>
              <span className="ml-auto font-mono">{r.source}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Metric({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="text-lg font-bold tabular-nums text-ink-50">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-500">{label}</div>
    </div>
  );
}
