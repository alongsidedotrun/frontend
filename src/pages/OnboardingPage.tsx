import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AlongsideLogo } from "@/components/icons/alongside-logo";

const INTRO_WORDS = [
  { text: "Multiplayer", delay: "350ms" },
  { text: "AI", delay: "530ms" },
  { text: "available", delay: "1170ms" },
  { text: "for", delay: "1350ms" },
  { text: "everyone", delay: "1530ms" },
];

const wordStyle = (delay: string): CSSProperties => ({
  animation: "onboarding-word-in 560ms cubic-bezier(0.22, 1, 0.36, 1) both",
  animationDelay: delay,
});

export function OnboardingPage() {
  const navigate = useNavigate();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    };
  }, []);

  function continueToApp() {
    if (isTransitioning) return;
    setIsTransitioning(true);
    transitionTimer.current = window.setTimeout(() => navigate("/", { replace: true }), 700);
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <section className="flex min-h-dvh w-full items-center justify-center border border-border bg-background px-6 text-center sm:px-12">
        <div className="w-full max-w-[440px]">
          <div
            className="mx-auto mb-8 flex items-center justify-center opacity-0"
            style={{ animation: "onboarding-fade-in 700ms ease-out 2.4s forwards" }}
          >
            <AlongsideLogo className="size-7 text-foreground" />
          </div>
          <h1 className="text-2xl font-medium tracking-[0] text-foreground sm:text-3xl" style={{ fontFamily: '"Geist", var(--font-sans)' }}>
            <span className="block">
              {INTRO_WORDS.slice(0, 2).map((word) => (
                <span key={word.text} className="mr-[0.25em] inline-block" style={wordStyle(word.delay)}>
                  {word.text}
                </span>
              ))}
            </span>
            <span className="mt-2 block text-foreground">
              {INTRO_WORDS.slice(2).map((word) => (
                <span key={word.text} className="mr-[0.2em] inline-block" style={wordStyle(word.delay)}>
                  {word.text}
                </span>
              ))}
            </span>
          </h1>
          <button
            type="button"
            onClick={continueToApp}
            disabled={isTransitioning}
            className="mt-8 inline-flex min-h-10 items-center justify-center rounded-full bg-foreground px-6 text-xs font-medium text-background opacity-0 transition hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{ animation: "onboarding-fade-in 700ms ease-out 3.25s forwards" }}
          >
            Continue
          </button>
          <span className="sr-only">Multiplayer AI available for everyone.</span>
        </div>
      </section>
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-[100] bg-background transition-opacity duration-700 ease-in-out ${isTransitioning ? "opacity-100" : "opacity-0"}`}
      />
    </main>
  );
}
