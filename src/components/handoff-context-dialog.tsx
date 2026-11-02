import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// #502: "Continued in a fresh session" opens to show exactly what the next agent was given about
// the chat before it -- the checkpoint, the live task list, recent work -- so a handoff is never a
// black box. Before the fresh session's first message it's a preview of what it will get.
export function HandoffNotice({ sessionId, eventId, text }: { sessionId: string; eventId: number; text: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<{ context: string | null; preview: boolean } | "error" | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDetails(null);
    fetch(`/sessions/${sessionId}/handoffs/${eventId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { context: string | null; preview: boolean }) => !cancelled && setDetails(data))
      .catch(() => !cancelled && setDetails("error"));
    return () => {
      cancelled = true;
    };
  }, [open, sessionId, eventId]);

  let body: string;
  if (details === null) body = t("chat.handoff.loading");
  else if (details === "error") body = t("chat.handoff.error");
  else body = details.context ?? t("chat.handoff.notKept");

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
          <pre className="max-h-[60vh] min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-mono text-xs text-foreground">
            {body}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
