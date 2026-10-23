import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload01 } from "@untitledui/icons";
import { XIcon } from "@/components/icons/untitled-ui";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { BOT_COLORS, BotFace, type BotAvatar } from "@/components/bot-face";
import { resizeImageFile } from "@/lib/resize-image";
import { cn } from "@/lib/utils";

/**
 * Choosing a bot's look (#504), as Grok's bot editor does: the Bot tab is Alongside's bot face in one of
 * the colours; Upload uses an image instead. The close button is at the top right.
 */
export function BotAvatarPicker({ value, onChange, onClose }: { value: BotAvatar; onChange: (avatar: BotAvatar) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"bot" | "upload">(value.kind === "image" ? "upload" : "bot");
  const [error, setError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const color = value.kind === "bot" ? value.color : BOT_COLORS[BOT_COLORS.length - 1];

  return (
    <div className="flex w-[300px] flex-col overflow-hidden rounded-2xl border border-[var(--redesign-sidebar-elevated-border)] bg-[var(--redesign-sidebar-overlay-surface)] shadow-[var(--redesign-sidebar-elevated-shadow)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-2">
        <Tabs size="compact" value={tab} onValueChange={(next) => setTab(next as "bot" | "upload")}>
          <TabsList>
            <TabItem value="bot" label={t("bots.avatar.bot")} />
            <TabItem value="upload" label={t("bots.avatar.upload")} />
          </TabsList>
        </Tabs>
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={onClose}
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon aria-hidden="true" className="size-4" />
        </button>
      </div>

      {tab === "bot" ? (
        <div className="flex flex-col items-center gap-4 p-4">
          <button
            type="button"
            aria-label={t("bots.avatar.bot")}
            onClick={() => onChange({ kind: "bot", color })}
            className={cn(
              "grid size-20 place-items-center rounded-2xl transition-shadow",
              value.kind === "bot" ? "ring-2 ring-foreground/25" : "hover:ring-2 hover:ring-foreground/10",
            )}
          >
            <BotFace avatar={{ kind: "bot", color }} className="size-14" />
          </button>
          <div className="grid grid-cols-6 gap-2.5" role="radiogroup" aria-label={t("bots.avatar.color")}>
            {BOT_COLORS.map((swatch) => {
              const selected = value.kind === "bot" && value.color === swatch;
              return (
                <button
                  key={swatch}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={swatch}
                  onClick={() => onChange({ kind: "bot", color: swatch })}
                  className={cn(
                    "grid size-8 place-items-center rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "ring-2 ring-foreground/40 ring-offset-2 ring-offset-[var(--redesign-sidebar-overlay-surface)]",
                  )}
                >
                  <span className="size-7 rounded-full border border-foreground/10" style={{ backgroundColor: swatch }} />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 p-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="grid size-20 place-items-center overflow-hidden rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:bg-hover-2 hover:text-foreground"
          >
            {value.kind === "image" ? <BotFace avatar={value} className="size-20" /> : <Upload01 aria-hidden="true" className="size-5" />}
          </button>
          <p className="text-center text-[12px] text-muted-foreground">{error ? t("bots.avatar.uploadFailed") : t("bots.avatar.uploadHint")}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                onChange({ kind: "image", src: await resizeImageFile(file, 256) });
                setError(false);
              } catch {
                setError(true);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
