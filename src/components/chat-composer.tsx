"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { InputMessage, type QueuedMessage } from "@/components/ui/input-message";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { FileThumbnail } from "@/components/ui/file-thumbnail";
import {
  QueuedStack,
  collapsedStackHeight,
  useQueueCardHeight,
} from "@/components/queued-stack";
import { useIcons } from "@/lib/icon-context";
import { useShape } from "@/lib/shape-context";
import { spring } from "@/lib/springs";

interface Message {
  id: string;
  from: "user" | "assistant";
  text: string;
  files: File[];
}

export function ChatComposer() {
  const shape = useShape();
  const icons = useIcons();
  const PlusIcon = icons.plus;
  const ChevronDownIcon = icons["chevron-down"];
  const cardH = useQueueCardHeight();
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: "seed", from: "user", text: "Make my input box feel less stiff", files: [] },
  ]);
  const [files, setFiles] = useState<File[]>([]);
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "streaming">("idle");

  // The id of the message currently playing its queued→sent morph. The
  // morph props are applied ONLY to this one, ONLY for the brief
  // transition — then cleared, so a settled bubble never re-animates its
  // layout when the transcript reflows underneath it.
  const [morphingId, setMorphingId] = useState<string | null>(null);
  const morphTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
    },
    []
  );

  // Fake reply — swap for your backend. The streaming → idle edge is what
  // auto-dispatches the next queued message through onSend.
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    },
    []
  );
  const respond = (text: string) => {
    setStatus("streaming");
    replyTimerRef.current = setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          from: "assistant",
          text: `Replying to “${text}” — swap this stub for your backend.`,
          files: [],
        },
      ]);
      setStatus("idle");
    }, 2600);
  };

  // Float the composer over the transcript: measure it to reserve scroll
  // padding (plus the collapsed queue stack) and to position the stack, and
  // keep the transcript pinned to the latest message.
  const inputRef = useRef<HTMLDivElement>(null);
  const [inputH, setInputH] = useState(0);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setInputH(el.offsetHeight));
    ro.observe(el);
    setInputH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    // `queue` is a dep: enqueuing grows the reserved bottom padding,
    // which must re-pin the scroll too.
  }, [messages, inputH, queue]);

  // Double-click a queued card (or its ✎) to pull it back into the composer.
  const editQueued = (item: QueuedMessage) => {
    setValue(item.text);
    setFiles(item.files);
    setQueue((q) => q.filter((x) => x.id !== item.id));
    requestAnimationFrame(() => {
      const el = inputRef.current?.querySelector("textarea");
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  };

  // Height of the collapsed queue pile — reserved under the transcript
  // alongside the composer.
  const collapsedStackH = collapsedStackHeight(queue.length, cardH);

  return (
    <div className="relative w-full self-stretch">
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto scrollbar-hide">
        <div
          className="flex min-h-full flex-col justify-start gap-2"
          style={{ paddingBottom: inputH + 8 + (queue.length > 0 ? collapsedStackH + 8 : 0) }}
        >
          {messages.map((m) =>
            m.from === "assistant" ? (
              <div
                key={m.id}
                className="max-w-[80%] self-start whitespace-pre-wrap break-words py-2 text-[14px] text-foreground"
              >
                {m.text}
              </div>
            ) : m.id === morphingId ? (
              // Mid-morph: shares a layoutId with the front stack card; the
              // inner span is layout-corrected so the text doesn't stretch.
              <motion.div
                key={m.id}
                layoutId={`qm-${m.id}`}
                layout
                initial={false}
                transition={spring.moderate}
                style={{ transformOrigin: "bottom right" }}
                className={`max-w-[80%] self-end whitespace-pre-wrap break-words px-3.5 py-2 text-[14px] text-pretty bg-[color-mix(in_oklab,var(--accent),var(--background)_45%)] text-foreground ${shape.bg}`}
              >
                <motion.span layout className="inline-block align-top">
                  {m.text}
                </motion.span>
              </motion.div>
            ) : (
              <div key={m.id} className="flex max-w-[80%] flex-col items-end gap-1.5 self-end">
                {m.files.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {m.files.map((file, fi) => (
                      <FileThumbnail key={`${file.name}-${fi}`} file={file} size={64} />
                    ))}
                  </div>
                )}
                {m.text !== "" && (
                  <div
                    className={`whitespace-pre-wrap break-words px-3.5 py-2 text-[14px] text-pretty bg-[color-mix(in_oklab,var(--accent),var(--background)_45%)] text-foreground ${shape.bg}`}
                  >
                    {m.text}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Queued messages — Sonner-style stack floated just above the
          composer (front card = next to dispatch). */}
      <QueuedStack
        queue={queue}
        onQueueChange={setQueue}
        onEdit={editQueued}
        onRemove={(item) => setQueue((q) => q.filter((x) => x.id !== item.id))}
        bottom={inputH + 8}
        morphLayoutId={(item) => `qm-${item.id}`}
      />

      <InputMessage
        ref={inputRef}
        className="absolute inset-x-0 bottom-0"
        value={value}
        onValueChange={setValue}
        onSend={(text, sent, meta) => {
          if (text || sent.length) {
            const id = meta?.queuedId ?? crypto.randomUUID();
            setMessages((m) => [...m, { id, from: "user", text, files: sent }]);
            if (text) respond(text);
            // A dispatched (from-queue) text message morphs from its stack
            // card; attachment cards fade instead (their layouts differ).
            if (meta?.queuedId && sent.length === 0) {
              setMorphingId(meta.queuedId);
              if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
              morphTimerRef.current = setTimeout(() => setMorphingId(null), 450);
            }
          }
          // Only clear the composer for an actual user submit — a queued
          // dispatch must leave any in-progress draft untouched.
          if (!meta?.queuedId) {
            setValue("");
            setFiles([]);
          }
        }}
        // ArrowUp recalls sent messages, ArrowDown walks back to the draft.
        history={messages.filter((m) => m.from === "user").map((m) => m.text).filter(Boolean)}
        minRows={2}
        files={files}
        onFilesChange={setFiles}
        leftSlot={({ openFilePicker }) => (
          <Tooltip content="Attach" side="top">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Attach files"
              onClick={() => openFilePicker()}
            >
              <PlusIcon />
            </Button>
          </Tooltip>
        )}
        rightSlot={
          <Button variant="ghost" size="sm" trailingIcon={ChevronDownIcon}>
            Sonnet 5
          </Button>
        }
        // While streaming, submits enqueue; flipping back to idle
        // dispatches the head of the queue through onSend.
        status={status}
        queue={queue}
        onQueueChange={setQueue}
        onStop={() => {
          if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
          setStatus("idle");
        }}
        // The built-in queue rows are replaced by the stacked cards above.
        showQueue={false}
      />
    </div>
  );
}
