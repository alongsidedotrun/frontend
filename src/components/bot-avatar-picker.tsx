import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Shuffle01, Upload01 } from "@untitledui/icons";
import { XIcon } from "@/components/icons/untitled-ui";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { BOT_COLORS, BOT_EYES, BotFace, botGradient, randomBotAvatar, type BotAvatar, type BotEyes } from "@/components/bot-face";
import { resizeImageFile } from "@/lib/resize-image";
import { cn } from "@/lib/utils";
import { ICON_PRESS, PRESS_EFFECT } from "@/lib/press-effect";

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
            onClick={() => onChange({ kind: "bot", color, eyes: value.kind === "bot" ? value.eyes : undefined })}
            className={cn(
              "grid size-20 place-items-center rounded-2xl transition-shadow",
              value.kind === "bot" ? "ring-2 ring-foreground/25" : "hover:ring-2 hover:ring-foreground/10",
            )}
          >
            <BotFace avatar={{ kind: "bot", color }} className="size-14" />
          </button>
          <BotSwatches value={value} onChange={onChange} ringOffset="ring-offset-[var(--redesign-sidebar-overlay-surface)]" />
          <BotEyesPicker value={value} onChange={onChange} compact ringOffset="ring-offset-[var(--redesign-sidebar-overlay-surface)]" />
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
          <p className="text-center text-ui-sm text-muted-foreground">{error ? t("bots.avatar.uploadFailed") : t("bots.avatar.uploadHint")}</p>
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

// Sized with the window, like the chat text: 22px narrow to 30px wide.
const SWATCH_SIZE = { "--swatch": "clamp(1.375rem, calc(0.875rem + 0.9vw), 1.875rem)" } as React.CSSProperties;

/**
 * The resting faces to choose from (#504), each the bot in its own colour with its eyes set that way. One
 * row of seven, under the colours. `compact`: the picker panel's smaller size.
 */
export function BotEyesPicker({
  value,
  onChange,
  compact = false,
  ringOffset = "ring-offset-background",
}: {
  value: BotAvatar;
  onChange: (avatar: BotAvatar) => void;
  compact?: boolean;
  ringOffset?: string;
}) {
  const { t } = useTranslation();
  if (value.kind !== "bot") return null;
  const current: BotEyes = value.eyes ?? "classic";
  return (
    <div
      // Each face with its name under it; the columns fit the longest name.
      className="grid grid-cols-7 gap-x-[calc(var(--swatch)*0.2)]"
      style={compact ? ({ "--swatch": "1.375rem" } as React.CSSProperties) : SWATCH_SIZE}
      role="radiogroup"
      aria-label={t("bots.eyes.label")}
    >
      {BOT_EYES.map((eyes) => (
        <button
          key={eyes}
          type="button"
          role="radio"
          aria-checked={eyes === current}
          aria-label={t(`bots.eyes.${eyes}`)}
          onClick={() => onChange({ ...value, eyes })}
          className="group/eyes flex min-w-0 flex-col items-center gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn(
              "grid size-[calc(var(--swatch)+4px)] place-items-center rounded-full transition-[box-shadow,scale] duration-150 group-hover/eyes:scale-105",
              eyes === current && cn("ring-2 ring-foreground/40 ring-offset-2", ringOffset),
            )}
          >
            <BotFace avatar={{ ...value, eyes }} className="size-[calc(var(--swatch)+4px)]" />
          </span>
          <span
            className={cn(
              "whitespace-nowrap px-0.5 leading-none transition-colors",
              compact ? "text-ui-2xs" : "text-chat-meta",
              eyes === current ? "text-foreground" : "text-muted-foreground group-hover/eyes:text-foreground",
            )}
          >
            {t(`bots.eyes.${eyes}`)}
          </span>
        </button>
      ))}
    </div>
  );
}

// Upload and Randomise follow the app's icon controls: the compose box's tiles' surface (the theme's border,
// white / surface-4, a soft shadow) and the shared press feedback (hover fades, press dips; no recolouring
// or growing). 4px over the colours so they fill their slot: an outlined circle reads smaller than a solid one.
const ACTION_CIRCLE = "grid size-[calc(var(--swatch)+4px)] place-items-center rounded-full border border-border bg-white text-muted-foreground shadow-[0_1px_2px_rgb(0_0_0_/_0.06)] dark:bg-[var(--surface-4)]";
const ACTION_PRESS = cn(PRESS_EFFECT, ICON_PRESS);

/**
 * The colours to choose from, each shaded like the Alongside logo; `withUpload` adds an image as the last
 * choice (the New bot page, which shows them under the bot instead of in the picker).
 */
export function BotSwatches({
  value,
  onChange,
  ringOffset = "ring-offset-background",
  withUpload = false,
}: {
  value: BotAvatar;
  onChange: (avatar: BotAvatar) => void;
  /** The background the selected ring sits on. */
  ringOffset?: string;
  withUpload?: boolean;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(false);
  const swatchClass = (selected: boolean, grows = true) => cn(
    "grid size-[calc(var(--swatch)+4px)] place-items-center rounded-full transition-[box-shadow,scale] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    grows && "hover:scale-105",
    selected && cn("ring-2 ring-foreground/40 ring-offset-2", ringOffset),
  );
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Two even rows: the colours alone (six each), or with Upload and Randomise (seven each). */}
      {/* Sized with the window, like the chat text: 22px narrow to 30px wide, the gaps with them. Every
          circle, Upload included, is the same size. */}
      <div
        className={cn("grid gap-[calc(var(--swatch)*0.36)]", withUpload ? "grid-cols-7" : "grid-cols-6")}
        style={SWATCH_SIZE}
        role="radiogroup"
        aria-label={t("bots.avatar.color")}
      >
        {BOT_COLORS.map((swatch) => {
          const selected = value.kind === "bot" && value.color === swatch;
          return (
            <button key={swatch} type="button" role="radio" aria-checked={selected} aria-label={swatch} onClick={() => onChange({ kind: "bot", color: swatch, eyes: value.kind === "bot" ? value.eyes : undefined })} className={swatchClass(selected)}>
              <span className="size-[var(--swatch)] rounded-full" style={{ background: botGradient(swatch) }} />
            </button>
          );
        })}
        {withUpload && (
          // A random colour (never the one it has) and resting face, before Upload, which comes last. The
          // shuffle turned so its arrows point up.
          <button
            type="button"
            aria-label={t("bots.avatar.randomise")}
            title={t("bots.avatar.randomise")}
            onClick={() => {
              onChange(randomBotAvatar(value.kind === "bot" ? value.color : undefined));
            }}
            className={cn(swatchClass(false, false), ACTION_PRESS)}
          >
            <span className={ACTION_CIRCLE}>
              <Shuffle01 aria-hidden="true" className="size-[calc(var(--swatch)*0.6)] -rotate-90" />
            </span>
          </button>
        )}
        {withUpload && (
          <button type="button" role="radio" aria-checked={value.kind === "image"} aria-label={t("bots.avatar.upload")} onClick={() => fileRef.current?.click()} className={cn(swatchClass(value.kind === "image", false), ACTION_PRESS)}>
            {value.kind === "image" ? (
              <BotFace avatar={value} className="size-[var(--swatch)]" />
            ) : (
              <span className={ACTION_CIRCLE}>
                <Upload01 aria-hidden="true" className="size-[calc(var(--swatch)*0.6)]" />
              </span>
            )}
          </button>
        )}
      </div>
      {withUpload && error && <p className="text-ui-sm text-destructive">{t("bots.avatar.uploadFailed")}</p>}
      {withUpload && (
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
      )}
    </div>
  );
}
