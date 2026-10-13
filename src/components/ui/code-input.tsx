import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
};

/**
 * One-time code entry drawn as a row of joined boxes, one digit each. A
 * single real input sits invisibly on top, so typing, pasting, deleting and
 * the browser's one-time-code autofill all behave like a normal text field;
 * the boxes only show its value, and the box the next digit goes into.
 */
export function CodeInput({ value, onChange, length = 6, id, autoFocus, disabled, invalid, ...aria }: CodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  // The box being typed into: the first empty one, or the last once all are full.
  const active = Math.min(value.length, length - 1);

  // Keeps the cursor at the end, so typing always fills the next box.
  const toEnd = () => {
    const input = inputRef.current;
    if (input) input.setSelectionRange(input.value.length, input.value.length);
  };

  return (
    <div className={cn("relative inline-flex", disabled && "opacity-60")}>
      <div
        className={cn(
          "flex overflow-hidden rounded-lg border bg-background transition-colors",
          invalid ? "border-destructive" : "border-[var(--redesign-sidebar-border)]",
        )}
      >
        {Array.from({ length }, (_, index) => {
          const char = value[index];
          const isActive = focused && index === active;
          return (
            <div
              key={index}
              className={cn(
                "relative grid size-11 place-items-center text-[18px] font-medium tabular-nums text-foreground transition-shadow",
                index > 0 && (invalid ? "border-l border-destructive" : "border-l border-[var(--redesign-sidebar-border)]"),
                isActive && "z-10 shadow-[inset_0_0_0_1px_var(--foreground)]",
              )}
            >
              {char}
              {isActive && !char && (
                <span aria-hidden="true" className="h-5 w-px bg-foreground animate-[caret-blink_1.2s_ease-out_infinite] motion-reduce:animate-none" />
              )}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, length))}
        onFocus={() => {
          setFocused(true);
          toEnd();
        }}
        onBlur={() => setFocused(false)}
        onSelect={toEnd}
        autoFocus={autoFocus}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        aria-invalid={invalid || undefined}
        aria-describedby={aria["aria-describedby"]}
        className="absolute inset-0 size-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent disabled:cursor-not-allowed"
      />
    </div>
  );
}
