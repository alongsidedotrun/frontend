import { useMemo, useState, type ReactElement } from "react";
import { DropdownMenu as BaseDropdownMenu, DropdownTrigger as BaseDropdownTrigger, DropdownContent as BaseDropdownContent } from "@/components/ui/dropdown";
import { MenuItem as BaseMenuItem } from "@/components/ui/menu-item";
import { ChevronRightIcon } from "@/components/icons/untitled-ui";
import { LANGUAGE_OPTIONS, type LanguageValue } from "@/lib/language";
import { listTimezoneGroups } from "@/lib/timezones";

// Settings' Language and Timezone dropdowns, shared with the sign-up step (sign-in-dialog.tsx).
// Each caller brings its own trigger (the button the menu opens from), given the current label.

export function LanguageDropdown({ value, onChange, trigger, align = "end" }: { value: LanguageValue; onChange: (value: LanguageValue) => void; trigger: (label: string) => ReactElement; align?: "start" | "end" }) {
  const entry = LANGUAGE_OPTIONS.find((l) => l.value === value) ?? LANGUAGE_OPTIONS[0];
  return (
    <BaseDropdownMenu size="compact">
      <BaseDropdownTrigger render={trigger(entry.label)} />
      <BaseDropdownContent align={align} className="min-w-52 whitespace-nowrap" checkedIndex={LANGUAGE_OPTIONS.findIndex((l) => l.value === value)}>
        {LANGUAGE_OPTIONS.map((l, i) => (
          <BaseMenuItem key={l.value} index={i} label={l.label} checked={value === l.value} onSelect={() => onChange(l.value)} />
        ))}
      </BaseDropdownContent>
    </BaseDropdownMenu>
  );
}

export function TimezoneDropdown({ value, onChange, trigger, align = "end" }: { value: string; onChange: (value: string) => void; trigger: (label: string) => ReactElement; align?: "start" | "end" }) {
  const groups = useMemo(listTimezoneGroups, []);
  const flatValues = useMemo(() => groups.flatMap((g) => g.zones.map((z) => z.value)), [groups]);
  const currentLabel = groups.flatMap((g) => g.zones).find((z) => z.value === value)?.label ?? value;

  // Collapsed by default, per explicit request ("so it doesn't load
  // everything") -- 417 real zones (confirmed directly via
  // Intl.supportedValuesOf) rendered flat, even scrollable, is still a lot to
  // mount at once. Only the current value's own region (and, for America,
  // its own subregion too) starts expanded -- computed once via useState's
  // own lazy initializer, not recalculated if the timezone changes later, so
  // picking a zone in a different region doesn't yank other regions open
  // underneath the user. Subregion keys are namespaced "America/North
  // America" (not just "North America") so this one Set can track both
  // levels without a region and a same-named subregion ever colliding.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const group of groups) {
      if (group.zones.some((z) => z.value === value)) initial.add(group.region);
      for (const sub of group.subregions ?? []) {
        if (sub.zones.some((z) => z.value === value)) {
          initial.add(group.region);
          initial.add(`${group.region}/${sub.name}`);
        }
      }
    }
    return initial;
  });

  function toggleKey(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <BaseDropdownMenu size="compact">
      <BaseDropdownTrigger render={trigger(currentLabel)} />
      {/* max-h-72 overflow-y-auto -- same cap-then-scroll treatment as the
          compose box's own model dropdown. checkedIndex/each row's own index
          count against flatValues (every zone across every group, in the
          same order rendered below, collapsed or not), not per-group --
          BaseMenuItem's keyboard nav and highlight both need one continuous
          index across the whole popup. */}
      <BaseDropdownContent align={align} className="max-h-72 overflow-y-auto" checkedIndex={flatValues.indexOf(value)}>
        {groups.map((group) => {
          const expanded = expandedKeys.has(group.region);
          return (
            <div key={group.region}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleKey(group.region);
                }}
                className="flex w-full items-center justify-between px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
              >
                <span>{group.region}</span>
                <ChevronRightIcon className={`size-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
              </button>
              {expanded && group.subregions
                ? group.subregions.map((sub) => {
                    const subKey = `${group.region}/${sub.name}`;
                    const subExpanded = expandedKeys.has(subKey);
                    return (
                      <div key={subKey}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleKey(subKey);
                          }}
                          className="flex w-full items-center justify-between py-1.5 pr-2.5 pl-5 text-[12px] text-muted-foreground hover:text-foreground"
                        >
                          <span>{sub.name}</span>
                          <ChevronRightIcon className={`size-3 shrink-0 transition-transform ${subExpanded ? "rotate-90" : ""}`} />
                        </button>
                        {subExpanded &&
                          sub.zones.map((zone) => (
                            <BaseMenuItem key={zone.value} index={flatValues.indexOf(zone.value)} label={zone.label} checked={value === zone.value} onSelect={() => onChange(zone.value)} />
                          ))}
                      </div>
                    );
                  })
                : expanded &&
                  group.zones.map((zone) => (
                    <BaseMenuItem key={zone.value} index={flatValues.indexOf(zone.value)} label={zone.label} checked={value === zone.value} onSelect={() => onChange(zone.value)} />
                  ))}
            </div>
          );
        })}
      </BaseDropdownContent>
    </BaseDropdownMenu>
  );
}
