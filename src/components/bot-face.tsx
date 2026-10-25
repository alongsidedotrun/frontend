import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// A bot's look (#504): Alongside's bot face in a colour, or an uploaded image.
export type BotAvatar = { kind: "bot"; color: string } | { kind: "image"; src: string };

// The faces in public/bot-faces/alongside-bots-sprite.svg. The default is the bot at rest; the others are
// its states (thinking while it works, happy when it's done...).
export type BotExpression = "default" | "happy" | "thinking" | "sleeping" | "excited";

// The face colours a bot can have, in the picker's order; the last (grey) is the default.
export const BOT_COLORS = [
  "#1C1C1C",
  "#FFFFFF",
  "#8B5E3C",
  "#D93B3B",
  "#F07A2C",
  "#F5A13A",
  "#3F9A5A",
  "#45A396",
  "#2F77DE",
  "#7E57DE",
  "#D6448B",
  "#7A7A7A",
] as const;

export const DEFAULT_BOT_AVATAR: BotAvatar = { kind: "bot", color: "#7A7A7A" };

// Each colour is shaded like the Alongside logo's blue (public/favicon.svg): lighter at the top, deeper at
// the bottom (#3A8CFF to #0566F5 there), with a soft white sheen over the top half.
function mix(hex: string, toward: number, amount: number) {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `#${channels.map((c) => Math.round(c + (toward - c) * amount).toString(16).padStart(2, "0")).join("")}`;
}

export function botShades(color: string) {
  return { top: mix(color, 255, 0.18), bottom: mix(color, 0, 0.12) };
}

/** Whether a colour is dark enough to need light eyes (black). */
export function isDarkBotColor(color: string) {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 60;
}

/** A colour's gradient as a CSS background, for its swatch (with backgroundOrigin: border-box, or the
 *  gradient repeats under the border and its light top shows along the bottom edge). */
export function botGradient(color: string) {
  const { top, bottom } = botShades(color);
  return `linear-gradient(to bottom, rgb(255 255 255 / 0.14), rgb(255 255 255 / 0) 50%), linear-gradient(to bottom, ${top}, ${bottom})`;
}

const EYE = "#111111";
// Arcs draw in the eyes' colour, whatever face they're on.
const arc = (d: string) => <path d={d} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />;

// Each face's eyes, as drawn in the sprite (only the eyes change between faces). Drawn here rather than
// through <use>, so they can blink between faces.
const EYES: Record<BotExpression, ReactNode> = {
  default: (
    <>
      <rect x="38" y="39" width="12" height="30" rx="6" />
      <rect x="78" y="39" width="12" height="30" rx="6" />
    </>
  ),
  happy: (
    <>
      {arc("M34 57 C34 42 54 42 54 57")}
      {arc("M74 57 C74 42 94 42 94 57")}
    </>
  ),
  thinking: (
    <>
      <rect x="33" y="51" width="25" height="8" rx="4" />
      <rect x="70" y="51" width="25" height="8" rx="4" />
    </>
  ),
  sleeping: (
    <>
      {arc("M34 49 C34 64 54 64 54 49")}
      {arc("M74 49 C74 64 94 64 94 49")}
    </>
  ),
  excited: (
    <>
      <circle cx="44" cy="54" r="10" />
      <circle cx="84" cy="54" r="10" />
    </>
  ),
};

// A blink: the eyes squash shut quickly and open a little slower. Changing face swaps them while shut.
const CLOSE_MS = 90;
const OPEN_MS = 150;
const SHUT_MS = 40;
// A glance: the eyes slide to one side and back.
const GLANCE_MS = 220;
const GLANCE_X = 7;
// Following the cursor: how far the eyes go (sideways, up and down), how quickly they settle, and how
// long after the cursor stops they drift back to idling.
const GAZE_X = 7;
const GAZE_Y = 5;
const GAZE_MS = 120;
const GAZE_IDLE_MS = 2500;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A bot's face: the bot in its colour (a hairline ring keeps a white one visible), or its uploaded image.
 * `animated`: it blinks into a new expression instead of jumping; at rest it blinks and glances around
 * now and then, follows the cursor while it moves, and waking up it looks to both sides.
 */
export function BotFace({
  avatar = DEFAULT_BOT_AVATAR,
  expression = "default",
  animated = false,
  className,
}: {
  avatar?: BotAvatar;
  expression?: BotExpression;
  animated?: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState(expression);
  const [shut, setShut] = useState(false);
  const [look, setLook] = useState<-1 | 0 | 1>(0);
  // Where the eyes look while following the cursor (null: not following).
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null);
  const following = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const gradientId = `bot-face-${useId().replace(/:/g, "")}`;
  // Woken up (sleeping, then at rest): it looks around once its eyes are open.
  const [woke, setWoke] = useState(false);
  const moving = animated && !prefersReducedMotion();

  // A new expression: blink into it, looking ahead.
  useEffect(() => {
    if (expression === shown) return;
    if (!moving) {
      setShown(expression);
      return;
    }
    setShut(true);
    setLook(0);
    const swap = window.setTimeout(() => {
      setWoke(shown === "sleeping" && expression === "default");
      setShown(expression);
      setShut(false);
    }, CLOSE_MS + SHUT_MS);
    return () => window.clearTimeout(swap);
  }, [expression, shown, moving]);

  // At rest: just woken, a look to each side; then every 3 to 6 seconds a blink or a glance.
  useEffect(() => {
    if (!moving || shown !== "default") return;
    const timers: number[] = [];
    const after = (ms: number, step: () => void) => timers.push(window.setTimeout(step, ms));
    const glance = (sides: readonly (-1 | 1)[], then: () => void) => {
      let at = 0;
      for (const side of sides) {
        after(at, () => setLook(side));
        at += GLANCE_MS + 520;
      }
      after(at, () => setLook(0));
      after(at + GLANCE_MS, then);
    };
    const idle = () => after(3000 + Math.random() * 3000, () => {
      // Following the cursor, it doesn't glance away on its own.
      if (following.current) {
        idle();
        return;
      }
      if (Math.random() < 0.6) {
        setShut(true);
        after(CLOSE_MS + SHUT_MS, () => {
          setShut(false);
          idle();
        });
      } else {
        glance([Math.random() < 0.5 ? -1 : 1], idle);
      }
    });
    if (woke) {
      setWoke(false);
      after(OPEN_MS + 250, () => glance([-1, 1], idle));
    } else {
      idle();
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // `woke` is read once as the rest begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, shown]);

  // At rest, its eyes follow the cursor, further the further away it is, and settle back once it stops.
  useEffect(() => {
    if (!moving || shown !== "default") return;
    let frame = 0;
    let settle: number | undefined;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = svgRef.current?.getBoundingClientRect();
        if (!box) return;
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height / 2);
        const distance = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, distance / (box.width * 2));
        following.current = true;
        setLook(0);
        setGaze({ x: (dx / distance) * GAZE_X * reach, y: (dy / distance) * GAZE_Y * reach });
      });
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        following.current = false;
        setGaze(null);
      }, GAZE_IDLE_MS);
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      following.current = false;
      setGaze(null);
    };
  }, [moving, shown]);

  if (avatar.kind === "image") {
    return <img src={avatar.src} alt="" aria-hidden="true" className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  const { top, bottom } = botShades(avatar.color);
  return (
    <svg ref={svgRef} viewBox="0 0 128 128" aria-hidden="true" className={cn("shrink-0 overflow-visible", className)}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="4" x2="0" y2="124" gradientUnits="userSpaceOnUse">
          <stop stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <linearGradient id={`${gradientId}-sheen`} x1="0" y1="4" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.14" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r="60" fill={`url(#${gradientId})`} />
      <circle cx="64" cy="64" r="60" fill={`url(#${gradientId}-sheen)`} />
      <g
        style={{
          transform: gaze ? `translate(${gaze.x}px, ${gaze.y}px)` : `translateX(${look * GLANCE_X}px)`,
          transition: moving ? `transform ${gaze ? GAZE_MS : GLANCE_MS}ms ${gaze ? "cubic-bezier(0, 0, 0.2, 1)" : "cubic-bezier(0.4, 0, 0.2, 1)"}` : undefined,
        }}
      >
      <g
        fill="currentColor"
        color={isDarkBotColor(avatar.color) ? "#F2F2F2" : EYE}
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          transform: shut ? "scaleY(0.1)" : "scaleY(1)",
          transition: moving ? `transform ${shut ? CLOSE_MS : OPEN_MS}ms ${shut ? "cubic-bezier(0.4, 0, 1, 1)" : "cubic-bezier(0, 0, 0.2, 1)"}` : undefined,
        } as CSSProperties}
      >
        {EYES[shown]}
      </g>
      </g>
      {/* A dark hairline edge (a light one would read as a shine along the deeper bottom); black's is light. */}
      <circle cx="64" cy="64" r="60" fill="none" className={isDarkBotColor(avatar.color) ? "stroke-white/15" : "stroke-black/10"} strokeWidth="2" />
    </svg>
  );
}

// How long a reaction lasts after the last keystroke, and how long the bot sleeps before waking.
const REACTION_MS = 1600;
const WAKE_MS = 2500;

/**
 * The New bot page's bot (#504): asleep at first, then awake; `react` shows a face for a moment (excited
 * while you name it, thinking while you write what it does), then it's back at rest.
 */
export function useBotMood(): [BotExpression, (face: BotExpression) => void] {
  const [mood, setMood] = useState<BotExpression>("sleeping");
  const settle = useRef<number | undefined>(undefined);
  useEffect(() => {
    const wake = window.setTimeout(() => setMood((current) => (current === "sleeping" ? "default" : current)), WAKE_MS);
    return () => {
      window.clearTimeout(wake);
      window.clearTimeout(settle.current);
    };
  }, []);
  const react = useCallback((face: BotExpression) => {
    setMood(face);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => setMood("default"), REACTION_MS);
  }, []);
  return [mood, react];
}
