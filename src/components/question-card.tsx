import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon, XIcon } from "@/components/icons/untitled-ui";
import { CHATS_API } from "@/lib/chats-api";

// An agent's multiple-choice question (Claude's AskUserQuestion, Grok's x.ai/ask_user_question,
// which the backend reshapes to the same input), shown above the compose box like the approval
// card. One question that takes one answer is sent on the first pick (1-9 pick, as on the approval
// card); several questions, or a question that takes several answers, are sent with Send. Each
// question also takes a typed answer ("Other"). Closing the card (or Esc) skips the question.
export type QuestionOption = { label: string; description?: string | null };
export type AgentQuestion = { question: string; header?: string | null; multiSelect?: boolean; options: QuestionOption[] };

// The questions in a permission request's input, or null when it isn't a question.
export function questionsOf(toolName: string, input: unknown): AgentQuestion[] | null {
  if (toolName !== "AskUserQuestion" || !input || typeof input !== "object") return null;
  const raw = (input as { questions?: unknown }).questions;
  if (!Array.isArray(raw)) return null;
  const questions = raw.flatMap((q): AgentQuestion[] => {
    if (!q || typeof q !== "object") return [];
    const { question, header, multiSelect, options } = q as Record<string, unknown>;
    if (typeof question !== "string" || !question.trim()) return [];
    const opts = Array.isArray(options)
      ? options.flatMap((o): QuestionOption[] => {
          if (!o || typeof o !== "object") return [];
          const { label, description } = o as Record<string, unknown>;
          return typeof label === "string" && label.trim() ? [{ label, description: typeof description === "string" ? description : null }] : [];
        })
      : [];
    return [{ question, header: typeof header === "string" ? header : null, multiSelect: multiSelect === true, options: opts }];
  });
  return questions.length ? questions : null;
}

// What goes back: each question's text to the options picked plus what was typed.
export function questionAnswers(questions: AgentQuestion[], picked: Record<number, string[]>, typed: Record<number, string>) {
  const answers: Record<string, string[]> = {};
  questions.forEach((q, i) => {
    const values = [...(picked[i] ?? []), ...(typed[i]?.trim() ? [typed[i].trim()] : [])];
    if (values.length) answers[q.question] = values;
  });
  return answers;
}

export function QuestionCard({
  sessionId,
  requestId,
  questions,
  onGone,
}: {
  sessionId: string | undefined;
  requestId: string;
  questions: AgentQuestion[];
  // The backend has no such request open any more (404).
  onGone: () => void;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const firstOtherRef = useRef<HTMLInputElement>(null);
  // One question, one answer: the first pick sends it.
  const instant = questions.length === 1 && !questions[0].multiSelect;
  const answers = questionAnswers(questions, picked, typed);
  const ready = questions.every((q) => answers[q.question]?.length);

  async function send(body: { decision: "allow" | "deny"; answers?: Record<string, string[]> }) {
    if (!sessionId || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${CHATS_API}/${sessionId}/permissions/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 404) onGone();
    } finally {
      setSubmitting(false);
    }
  }

  function pick(index: number, label: string) {
    const q = questions[index];
    if (instant) {
      void send({ decision: "allow", answers: { [q.question]: [label] } });
      return;
    }
    setPicked((current) => {
      const now = current[index] ?? [];
      const next = q.multiSelect ? (now.includes(label) ? now.filter((l) => l !== label) : [...now, label]) : [label];
      return { ...current, [index]: next };
    });
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "Escape") {
        event.preventDefault();
        void send({ decision: "deny" });
        return;
      }
      if (questions.length !== 1) return;
      const n = Number(event.key);
      const options = questions[0].options;
      if (Number.isInteger(n) && n >= 1 && n <= options.length) {
        event.preventDefault();
        pick(0, options[n - 1].label);
      } else if (n === options.length + 1) {
        event.preventDefault();
        firstOtherRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, submitting, picked, instant]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5 rounded-[var(--redesign-chat-bubble-radius)] border border-border bg-sidebar p-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-chat font-medium text-foreground">
          {questions.length === 1 ? questions[0].header?.trim() || t("chat.question.title") : t("chat.question.titleMany", { count: questions.length })}
        </p>
        <button
          type="button"
          aria-label={t("chat.question.skip")}
          disabled={submitting}
          onClick={() => void send({ decision: "deny" })}
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover-2/50 hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      {/* Above the compose box, outside the scrolling chat: a long set of questions scrolls in here. */}
      <div className="flex max-h-[min(24rem,45vh)] flex-col gap-3 overflow-y-auto">
        {questions.map((q, index) => (
          <div key={index} className="flex flex-col gap-1">
            {questions.length > 1 && q.header?.trim() && <p className="px-1 text-chat-meta text-muted-foreground">{q.header}</p>}
            <p className="px-1 pb-1 text-chat text-foreground [overflow-wrap:anywhere]">{q.question}</p>
            {q.options.map((option, n) => {
              const on = picked[index]?.includes(option.label) ?? false;
              return (
                <button
                  key={option.label}
                  type="button"
                  disabled={submitting}
                  aria-pressed={instant ? undefined : on}
                  onClick={() => pick(index, option.label)}
                  className={`flex min-w-0 items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-chat text-foreground transition-colors hover:bg-hover-2/50 disabled:opacity-50 ${on ? "border-foreground/40 bg-hover-2/40" : "border-border"}`}
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-hover-2/50 text-ui-2xs font-semibold text-muted-foreground">
                    {on ? <CheckIcon className="size-3" /> : questions.length === 1 ? n + 1 : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="[overflow-wrap:anywhere]">{option.label}</span>
                    {option.description?.trim() && option.description.trim() !== option.label.trim() && (
                      <span className="text-chat-meta text-muted-foreground [overflow-wrap:anywhere]">{option.description}</span>
                    )}
                  </span>
                </button>
              );
            })}
            <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
              {questions.length === 1 && (
                <span className="flex size-4 shrink-0 items-center justify-center rounded bg-hover-2/50 text-ui-2xs font-semibold text-muted-foreground">
                  {q.options.length + 1}
                </span>
              )}
              <input
                ref={index === 0 ? firstOtherRef : undefined}
                value={typed[index] ?? ""}
                disabled={submitting}
                onChange={(event) => setTyped((current) => ({ ...current, [index]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  if (instant && typed[index]?.trim()) void send({ decision: "allow", answers: { [q.question]: [typed[index].trim()] } });
                  else if (!instant && ready) void send({ decision: "allow", answers });
                }}
                placeholder={t("chat.question.other")}
                className="min-w-0 flex-1 bg-transparent text-chat text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-1">
        <p className="min-w-0 flex-1 text-chat-meta text-muted-foreground">{t("chat.question.escToSkip")}</p>
        {!instant && (
          <button
            type="button"
            disabled={!ready || submitting}
            onClick={() => void send({ decision: "allow", answers })}
            className="rounded-lg bg-foreground px-3 py-1 text-chat text-background transition-opacity disabled:opacity-40"
          >
            {t("chat.question.send")}
          </button>
        )}
      </div>
    </div>
  );
}
