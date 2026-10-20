import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// How many levels the wave keeps (newest on the right) and how often it takes one.
const SLOTS = 28;
const SAMPLE_MS = 70;
// Below this a slot stays a dot: room noise, not speech.
const QUIET = 0.06;
// The RMS of loud speech, drawn at full height.
const LOUD_RMS = 0.15;

/**
 * The compose box's dictation wave: the mic's level over the last couple of
 * seconds, a dot for each quiet moment and a bar for each spoken one, scrolling
 * left as new levels come in. Without a stream (no mic permission yet, or none
 * at all) it stays a dotted line.
 */
export function DictationWave({ stream, className }: { stream: MediaStream | null; className?: string }) {
  const [levels, setLevels] = useState<number[]>(() => Array(SLOTS).fill(0));

  useEffect(() => {
    if (!stream) return;
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    // The loudest moment since the last slot, so a short syllable between samples still shows.
    let peak = 0;
    let frame = 0;
    const read = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const centred = (sample - 128) / 128;
        sum += centred * centred;
      }
      peak = Math.max(peak, Math.sqrt(sum / samples.length));
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
    const timer = window.setInterval(() => {
      const level = Math.min(1, peak / LOUD_RMS);
      peak = 0;
      setLevels((current) => [...current.slice(1), level]);
    }, SAMPLE_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      void context.close();
    };
  }, [stream]);

  return (
    <span aria-hidden="true" className={cn("flex h-4 shrink-0 items-center gap-[2px]", className)}>
      {levels.map((level, index) => (
        <span
          key={index}
          className={cn(
            "w-[2px] rounded-full transition-[height,background-color] duration-75",
            level < QUIET ? "bg-muted-foreground/50" : "bg-foreground",
          )}
          style={{ height: level < QUIET ? 2 : Math.max(4, Math.round(level * 16)) }}
        />
      ))}
    </span>
  );
}
