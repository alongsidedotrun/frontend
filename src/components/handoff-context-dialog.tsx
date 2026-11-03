import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StreamingText } from "@/components/streaming-text";
import tr from "@/components/thinking-reasoning.module.css";
import { checkpointText, parseConversation, parseHandoff, parseWorkState, type HandoffSection, type WorkBlock } from "@/lib/handoff-context";

// #502: "Continued in a fresh session" opens to show exactly what the next agent was given about
// the chat before it -- the checkpoint, the live task list, recent work -- so a handoff is never a
// black box. Before the fresh session's first message it's a preview of what it will get.
//
// The text is shown in readable parts: the summary as formatted text, where the work stands as
// lists, the latest messages as messages. The exact text the agent got is one click away.
export function HandoffNotice({ sessionId, eventId, text }: { sessionId: string; eventId: number; text: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(false);
  const [details, setDetails] = useState<{ context: string | null; preview: boolean } | "error" | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDetails(null);
    setRaw(false);
    fetch(`/sessions/${sessionId}/handoffs/${eventId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { context: string | null; preview: boolean }) => !cancelled && setDetails(data))
      .catch(() => !cancelled && setDetails("error"));
    return () => {
      cancelled = true;
    };
  }, [open, sessionId, eventId]);

  const context = details !== null && details !== "error" ? details.context : null;
  const sections = useMemo(() => (context ? parseHandoff(context) : null), [context]);

  let message: string | null = null;
  if (details === null) message = t("chat.handoff.loading");
  else if (details === "error") message = t("chat.handoff.error");
  else if (!context) message = t("chat.handoff.notKept");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-chat-meta text-muted-foreground/70 underline decoration-dotted underline-offset-4 hover:text-foreground"
      >
        {text}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{t("chat.handoff.title")}</DialogTitle>
            <DialogDescription>
              {details !== null && details !== "error" && details.preview ? t("chat.handoff.preview") : t("chat.handoff.description")}
            </DialogDescription>
          </DialogHeader>
          {message ? (
            <p className="text-ui-sm text-muted-foreground">{message}</p>
          ) : raw || !sections ? (
            <pre className="max-h-[65vh] min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-mono text-ui-xs text-foreground">{context}</pre>
          ) : (
            <div className="-mx-1 max-h-[65vh] min-w-0 space-y-2 overflow-y-auto px-1">
              <Sections sections={sections} />
            </div>
          )}
          {context && sections && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setRaw((r) => !r)} className="text-ui-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground">
                {raw ? t("chat.handoff.showSections") : t("chat.handoff.showExact")}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Sections({ sections }: { sections: HandoffSection[] }) {
  const { t } = useTranslation();
  const find = (tag: string) => sections.filter((s) => s.tag === tag);
  const checkpoint = find("checkpoint")[0];
  const workState = find("work_state")[0];
  const conversation = find("conversation")[0];
  const files = find("file");
  const toolOutput = [...find("recent_tool_output"), ...find("their_tool_output")];
  const turns = conversation ? parseConversation(conversation.body) : [];
  const toolsUsed = find("tools_used")[0];
  return (
    <>
      {checkpoint && (
        <Section title={t("chat.handoff.summary")} open>
          <StreamingText text={checkpointText(checkpoint.body)} animate={false} />
        </Section>
      )}
      {workState && (
        <Section title={t("chat.handoff.workState")} open={!checkpoint}>
          <WorkState blocks={parseWorkState(workState.body)} />
        </Section>
      )}
      {turns.length > 0 && (
        <Section title={t("chat.handoff.conversation")} count={turns.filter((turn) => turn.text).length}>
          <div className="space-y-3">
            {turns.map((turn, i) => (
              <div key={i} className="min-w-0">
                <div className="mb-1 text-ui-xs font-medium text-muted-foreground">{turn.speaker}</div>
                {turn.text ? (
                  <div className="min-w-0 break-words">
                    <StreamingText text={turn.text} animate={false} />
                  </div>
                ) : (
                  <Disclosure summary={<span className="text-ui-xs text-muted-foreground">{t("chat.handoff.toolCalls", { count: turn.tools.length })}</span>}>
                    <ul className="mt-1 space-y-1">
                      {turn.tools.map((tool, j) => (
                        <li key={j} className="truncate font-mono text-ui-2xs text-muted-foreground" title={tool}>
                          {tool}
                        </li>
                      ))}
                    </ul>
                  </Disclosure>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
      {toolOutput.length > 0 && (
        <Section title={t("chat.handoff.toolOutput")}>
          {toolOutput.map((s, i) => (
            <Mono key={i}>{s.body}</Mono>
          ))}
        </Section>
      )}
      {files.length > 0 && (
        <Section title={t("chat.handoff.files")} count={files.length}>
          <div className="space-y-2">
            {files.map((f, i) => (
              <Disclosure key={i} summary={<span className="min-w-0 truncate text-ui-sm" title={f.path}><FileName path={f.path ?? ""} /></span>}>
                <Mono>{f.body}</Mono>
              </Disclosure>
            ))}
          </div>
        </Section>
      )}
      {find("repository").map((s, i) => (
        <Section key={i} title={t("chat.handoff.repository")}>
          <Mono>{s.body}</Mono>
        </Section>
      ))}
      {toolsUsed && (
        <Section title={t("chat.handoff.toolsUsed")}>
          <p className="text-ui-sm text-muted-foreground">{toolsUsed.body}</p>
        </Section>
      )}
      {find("instructions").map((s, i) => (
        <Section key={i} title={t("chat.handoff.instructions")}>
          <p className="whitespace-pre-wrap text-ui-sm text-muted-foreground">{s.body}</p>
        </Section>
      ))}
    </>
  );
}

// The same opening and closing as the Working/thinking block (thinking-reasoning.module.css): its
// chevron, and its grid-rows height and fade transition.
function Disclosure({ summary, open: initiallyOpen = false, className = "", children }: { summary: ReactNode; open?: boolean; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className="min-w-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`flex w-full min-w-0 items-center gap-2 text-left hover:text-foreground ${className}`}>
        <svg className={tr.trChevron} style={open ? { transform: "rotate(180deg)" } : undefined} viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
          <path d="m4.5 15.75 7.5-7.5 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {summary}
      </button>
      <div className={tr.trCollapsible + (open ? "" : " " + tr.isCollapsed)} aria-hidden={!open}>
        <div className={tr.trInner}>{children}</div>
      </div>
    </div>
  );
}

function Section({ title, count, open, children }: { title: string; count?: number; open?: boolean; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background">
      <Disclosure
        open={open}
        className="px-3 py-2"
        summary={
          <>
            <span className="text-ui-sm font-medium">{title}</span>
            {count !== undefined && <span className="text-ui-xs text-muted-foreground">{count}</span>}
          </>
        }
      >
        <div className="min-w-0 border-t border-border px-3 py-3">{children}</div>
      </Disclosure>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <pre className="mt-1 max-h-80 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 font-mono text-ui-2xs text-foreground">{children}</pre>;
}

function FileName({ path }: { path: string }) {
  const cut = path.lastIndexOf("/");
  return (
    <>
      <span>{path.slice(cut + 1)}</span>
      {cut > 0 && <span className="ml-2 text-ui-xs text-muted-foreground">{path.slice(0, cut)}</span>}
    </>
  );
}

function WorkState({ blocks }: { blocks: WorkBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const files = /^Files changed/.test(block.label);
        const commands = /^(Commands run|Latest commands)/.test(block.label);
        const problems = /^Open problems|^The last turn ended/.test(block.label);
        const tasks = /^Task list/.test(block.label);
        return (
          <div key={i} className="min-w-0">
            {block.label && <div className="mb-1 text-ui-xs font-medium text-muted-foreground">{block.label}</div>}
            {block.value && (problems ? <Mono>{block.value}</Mono> : <p className="whitespace-pre-wrap break-words text-ui-sm">{block.value}</p>)}
            {block.items.length > 0 && (
              <ul className="space-y-1">
                {block.items.map((item, j) => {
                  if (tasks) {
                    const done = item.text.startsWith("[x]");
                    const label = item.text.replace(/^\[[^\]]*\]\s*/, "");
                    return (
                      <li key={j} className={`flex gap-2 text-ui-sm ${done ? "text-muted-foreground line-through" : ""}`}>
                        <span aria-hidden>{done ? "☑" : "☐"}</span>
                        <span className="min-w-0 break-words">{label}</span>
                      </li>
                    );
                  }
                  if (files) {
                    return (
                      <li key={j} className="truncate text-ui-sm" title={item.text}>
                        <FileName path={item.text} />
                      </li>
                    );
                  }
                  if (commands) {
                    const [first, ...rest] = item.text.split("\n");
                    const mark = <span className={item.failed ? "text-destructive" : "text-emerald-600"}>{item.failed ? "✕" : "✓"}</span>;
                    // A one-line command is shown whole (wrapped); only longer ones open.
                    if (rest.length === 0) {
                      return (
                        <li key={j} className="flex min-w-0 gap-2 font-mono text-ui-2xs">
                          {mark}
                          <span className="min-w-0 break-all">{first}</span>
                        </li>
                      );
                    }
                    return (
                      <li key={j} className="min-w-0">
                        <Disclosure
                          summary={
                            <span className="flex min-w-0 gap-2 font-mono text-ui-2xs">
                              {mark}
                              <span className="min-w-0 truncate" title={first}>
                                {first} …
                              </span>
                            </span>
                          }
                        >
                          <Mono>{item.text}</Mono>
                        </Disclosure>
                      </li>
                    );
                  }
                  const [first, ...rest] = item.text.split("\n");
                  return (
                    <li key={j} className="min-w-0 text-ui-sm">
                      <div className="break-words">{first}</div>
                      {rest.length > 0 && <Mono>{rest.join("\n")}</Mono>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
