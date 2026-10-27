import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

// A bot's look (#504): Alongside's bot face in a colour, or an uploaded image.
export type BotAvatar = { kind: "bot"; color: string; eyes?: BotEyes } | { kind: "image"; src: string };

// The face a bot rests with: its pill eyes, set its own way, so bots don't all look alike. Its states
// (sleeping, excited, thinking, happy) are the same for every bot.
// Pill variations, and three of the sprite's own faces (public/bot-faces) to rest with.
export type BotEyes = "classic" | "small" | "close" | "curious" | "sleeping" | "thinking" | "happy";
export const BOT_EYES: readonly BotEyes[] = ["classic", "small", "close", "curious", "sleeping", "thinking", "happy"];

// The faces in public/bot-faces/alongside-bots-sprite.svg. The default is the bot at rest; the others are
// its states (thinking while it works, happy when it's done...).
export type BotExpression = "default" | "happy" | "thinking" | "sleeping" | "excited" | "curious" | "sad";

/**
 * What a bot is doing, as its face shows it (after OpenBot's avatar moods): at rest; excited while the
 * person types to it; curious while it waits (on a provider, or for the person); thinking; working
 * (attentive, breathing); pleased with a fresh reply, before settling back; sad when a turn failed.
 */
export type BotMood = "idle" | "typing" | "waiting" | "thinking" | "working" | "responded" | "failed";

/** The face for a mood, and whether it breathes (a busy mood keeps moving). */
export function moodFace(mood: BotMood): { expression: BotExpression; breathe: boolean } {
  switch (mood) {
    case "typing":
      return { expression: "excited", breathe: false };
    case "waiting":
      return { expression: "curious", breathe: false };
    case "thinking":
      return { expression: "thinking", breathe: true };
    case "working":
      return { expression: "default", breathe: true };
    case "responded":
      return { expression: "happy", breathe: false };
    case "failed":
      return { expression: "sad", breathe: false };
    default:
      return { expression: "default", breathe: false };
  }
}

// The face colours a bot can have, in the picker's order; the last (grey) is the default.
export const BOT_COLORS = [
  "#000000",
  "#FFFFFF",
  "#EADBC0",
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

/** A random colour (never `notColor`) and resting face: how a new bot starts, and what Randomise picks. */
export function randomBotAvatar(notColor?: string): BotAvatar {
  const colors = BOT_COLORS.filter((color) => color !== notColor);
  return { kind: "bot", color: colors[Math.floor(Math.random() * colors.length)], eyes: BOT_EYES[Math.floor(Math.random() * BOT_EYES.length)] };
}

// Each colour is shaded like the Alongside logo's blue (public/favicon.svg): lighter at the top, deeper at
// the bottom (#3A8CFF to #0566F5 there), with a soft white sheen over the top half.
function mix(hex: string, toward: number, amount: number) {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `#${channels.map((c) => Math.round(c + (toward - c) * amount).toString(16).padStart(2, "0")).join("")}`;
}

// Black and white are a plain, solid fill: no shading, no sheen.
const SOLID = new Set(["#000000", "#FFFFFF"]);
export function isSolidBotColor(color: string) {
  return SOLID.has(color.toUpperCase());
}

// The white face is drawn in --bot-face-white (index.css): the sidebar's grey in light mode, white in dark.
function solidFill(color: string) {
  return color.toUpperCase() === "#FFFFFF" ? "var(--bot-face-white)" : color;
}

export function botShades(color: string) {
  if (isSolidBotColor(color)) return { top: solidFill(color), bottom: solidFill(color) };
  return { top: mix(color, 255, 0.18), bottom: mix(color, 0, 0.12) };
}

/** A colour's gradient as a CSS background, for its swatch. */
export function botGradient(color: string) {
  if (isSolidBotColor(color)) return solidFill(color);
  const { top, bottom } = botShades(color);
  return `linear-gradient(to bottom, rgb(255 255 255 / 0.14), rgb(255 255 255 / 0) 50%), linear-gradient(to bottom, ${top}, ${bottom})`;
}

// White eyes; the white and cream faces' are dark, or they'd vanish into it (cream's white eyes were
// hard to make out at sidebar size).
const EYE = "#FFFFFF";
const EYE_ON_LIGHT = "#111111";
const LIGHT_BOT_COLORS = new Set(["#FFFFFF", "#EADBC0"]);
function isLightBotColor(color: string) {
  return LIGHT_BOT_COLORS.has(color.toUpperCase());
}
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
  // One eye a little smaller, as if tilting its head.
  curious: (
    <>
      <rect x="38" y="39" width="12" height="30" rx="6" />
      <rect x="78" y="45" width="12" height="20" rx="6" />
    </>
  ),
  // Shorter eyes, their tops tipped in.
  sad: (
    <>
      <rect x="38" y="46" width="12" height="22" rx="6" transform="rotate(-18 44 57)" />
      <rect x="78" y="46" width="12" height="22" rx="6" transform="rotate(18 84 57)" />
    </>
  ),
};

// Each resting face: pill eyes set a few ways (the sprite's default is "classic"), or one of its faces.
const pill = (x: number, y: number, height: number) => <rect x={x} y={y} width="12" height={height} rx="6" />;
const RESTING: Record<BotEyes, ReactNode> = {
  classic: EYES.default,
  small: <>{pill(38, 46, 16)}{pill(78, 46, 16)}</>,
  close: <>{pill(44, 39, 30)}{pill(72, 39, 30)}</>,
  curious: <>{pill(38, 39, 30)}{pill(78, 45, 20)}</>,
  sleeping: EYES.sleeping,
  thinking: EYES.thinking,
  happy: EYES.happy,
};

// A blink: the eyes squash shut quickly and open a little slower. Changing face swaps them while shut.
const CLOSE_MS = 110;
const OPEN_MS = 180;
const SHUT_MS = 40;
// A glance: the eyes slide to one side and back.
const GLANCE_MS = 220;
const GLANCE_X = 7;
// Following the cursor: how far the eyes go (sideways, up and down), how quickly they settle, and how
// long after the cursor stops they drift back to idling.
const GAZE_X = 8;
// Further down than up: what it's looking at (its form, the colours) is mostly below it.
const GAZE_DOWN = 12;
const GAZE_UP = 6;
const GAZE_MS = 120;
const GAZE_IDLE_MS = 2500;
// Changing face: the old eyes shrink away as the new ones grow in, overlapping a little (a glide, not
// a blink). A face holds at least HOLD_MS, so a turn flicking between thinking and working (each
// tool call) reads as one calm change rather than a twitch; the latest face asked for wins.
const FACE_OUT = { duration: 0.18, ease: [0.4, 0, 1, 1] as const };
const FACE_IN = { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] as const, delay: 0.08 };
const HOLD_MS = 900;
// Breathing: a slow swell while busy; stopping, it eases back instead of jumping to rest.
const BREATHE = { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const };
const BREATHE_STOP = { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] as const };

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A bot's face: the bot in its colour (no edge: cleaner), or its uploaded image.
 * `animated`: it blinks into a new expression instead of jumping; at rest it blinks and glances around
 * now and then, follows the cursor while it moves, and waking up it looks to both sides.
 */
export function BotFace({
  avatar = DEFAULT_BOT_AVATAR,
  expression = "default",
  animated = false,
  breathe = false,
  className,
}: {
  avatar?: BotAvatar;
  expression?: BotExpression;
  animated?: boolean;
  /** A busy bot (thinking, working): it swells and settles slowly, like breathing. */
  breathe?: boolean;
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
  const reduceMotion = prefersReducedMotion();
  const moving = animated && !reduceMotion;

  // A new expression: it glides in (below), looking ahead, once the current one has held long enough.
  const changedAt = useRef(0);
  useEffect(() => {
    if (expression === shown) return;
    const wait = reduceMotion ? 0 : Math.max(0, changedAt.current + HOLD_MS - Date.now());
    const swap = window.setTimeout(() => {
      changedAt.current = Date.now();
      setLook(0);
      setWoke(shown === "sleeping" && expression === "default");
      setShown(expression);
    }, wait);
    return () => window.clearTimeout(swap);
  }, [expression, shown, reduceMotion]);

  // At rest: just woken, a look to each side; then every 3 to 4 seconds a blink or a glance.
  useEffect(() => {
    if (!moving || shown !== "default") return;
    const timers: number[] = [];
    const after = (ms: number, step: () => void) => timers.push(window.setTimeout(step, ms));
    const glance = (sides: readonly (-1 | 1)[]) => {
      let at = 0;
      for (const side of sides) {
        after(at, () => setLook(side));
        at += GLANCE_MS + 520;
      }
      after(at, () => setLook(0));
      return at + GLANCE_MS;
    };
    // Every 3 to 4 seconds (counted from the start of the last one), a blink or a glance, at random.
    // While it follows the cursor it never glances away, it only blinks.
    const act = () => {
      after(3000 + Math.random() * 1000, act);
      if (following.current || Math.random() < 0.5) {
        setShut(true);
        after(CLOSE_MS + SHUT_MS, () => setShut(false));
      } else {
        glance([Math.random() < 0.5 ? -1 : 1]);
      }
    };
    const rest = (delay: number) => after(delay, act);
    if (woke && !following.current) {
      setWoke(false);
      after(OPEN_MS + 250, () => rest(glance([-1, 1]) + 2000 + Math.random() * 1000));
    } else {
      setWoke(false);
      rest(3000 + Math.random() * 1000);
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
        setGaze({ x: (dx / distance) * GAZE_X * reach, y: (dy / distance) * (dy > 0 ? GAZE_DOWN : GAZE_UP) * reach });
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
    <svg
      ref={svgRef}
      viewBox="0 0 128 128"
      aria-hidden="true"
      className={cn("shrink-0 overflow-visible", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="4" x2="0" y2="124" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: top }} />
          <stop offset="1" style={{ stopColor: bottom }} />
        </linearGradient>
        <linearGradient id={`${gradientId}-sheen`} x1="0" y1="4" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.14" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: "center" } as CSSProperties}
        initial={false}
        animate={breathe && !reduceMotion ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={breathe && !reduceMotion ? BREATHE : BREATHE_STOP}
      >
      <circle cx="64" cy="64" r="60" fill={`url(#${gradientId})`} />
      {!isSolidBotColor(avatar.color) && <circle cx="64" cy="64" r="60" fill={`url(#${gradientId}-sheen)`} />}
      <g
        style={{
          transform: gaze ? `translate(${gaze.x}px, ${gaze.y}px)` : `translateX(${look * GLANCE_X}px)`,
          // Always eased (not only while it moves): a face that stops being the live one glides home.
          transition: reduceMotion ? undefined : `transform ${gaze ? GAZE_MS : GLANCE_MS}ms ${gaze ? "cubic-bezier(0, 0, 0.2, 1)" : "cubic-bezier(0.4, 0, 0.2, 1)"}`,
        }}
      >
      <g
        fill="currentColor"
        color={isLightBotColor(avatar.color) ? EYE_ON_LIGHT : EYE}
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          transform: shut ? "scaleY(0.1)" : "scaleY(1)",
          transition: reduceMotion ? undefined : `transform ${shut ? CLOSE_MS : OPEN_MS}ms ${shut ? "cubic-bezier(0.4, 0, 1, 1)" : "cubic-bezier(0, 0, 0.2, 1)"}`,
        } as CSSProperties}
      >
        <AnimatePresence initial={false}>
          <motion.g
            key={shown}
            style={{ transformBox: "fill-box", transformOrigin: "center" } as CSSProperties}
            initial={{ opacity: 0, scaleY: 0.3 }}
            animate={{ opacity: 1, scaleY: 1, transition: reduceMotion ? { duration: 0 } : FACE_IN }}
            exit={{ opacity: 0, scaleY: 0.3, transition: reduceMotion ? { duration: 0 } : FACE_OUT }}
          >
            {shown === "default" ? RESTING[avatar.eyes as BotEyes] ?? RESTING.classic : EYES[shown]}
          </motion.g>
        </AnimatePresence>
      </g>
      </g>
      </motion.g>
    </svg>
  );
}

// How long a reaction lasts after the last keystroke.
const REACTION_MS = 1600;

/**
 * The New bot page's bot (#504): at rest with its own face from the start (awake: starting asleep read
 * as if it weren't ready); `react` shows a face for a moment (happy while you name and describe it),
 * then it's back at rest.
 */
export function useBotMood(): [BotExpression, (face: BotExpression) => void] {
  const [mood, setMood] = useState<BotExpression>("default");
  const settle = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(settle.current), []);
  const react = useCallback((face: BotExpression) => {
    setMood(face);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => setMood("default"), REACTION_MS);
  }, []);
  return [mood, react];
}
