import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Check, ChevronDown, Plus, SearchMd, Stars02 } from "@untitledui/icons";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShapeProvider } from "@/lib/shape-context";
import { ShellDialog, ShellField, SHELL_FIELD_INPUT, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";
import { SKILLS_SH, useSkills } from "@/lib/skills";
import {
  compactCount,
  installedIdFor,
  loadSkillsShDetail,
  loadSkillsShList,
  searchSkillsSh,
  SkillsShError,
  useAddRemoteSkill,
  type RemoteSkill,
  type RemoteSkillDetail,
  type SkillsShView,
} from "@/lib/skills-sh";
import { cn } from "@/lib/utils";

// Same pill segmented control as Invite members.
const TAB_CLASS = "h-[22px] px-2.5 [&>span]:!text-[12px] [&>span]:!leading-none";
const VIEWS: readonly { view: SkillsShView; labelKey: string }[] = [
  { view: "all-time", labelKey: "skills.view.allTime" },
  { view: "trending", labelKey: "skills.view.trending" },
  { view: "hot", labelKey: "skills.view.hot" },
];

type Listing = { state: "loading" } | { state: "error"; busy: boolean } | { state: "done"; skills: RemoteSkill[] };

/**
 * Browse skills: skills.sh's All time, Trending and Hot lists, as on the site,
 * or its search once two letters are typed. A result opens to its description
 * (from its SKILL.md) and can be added to your skills.
 */
export function SkillsBrowserDialog({
  open,
  onOpenChange,
  initialView = "all-time",
  initialQuery = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: SkillsShView;
  initialQuery?: string;
}) {
  const { t } = useTranslation();
  const skills = useSkills();
  const addRemote = useAddRemoteSkill();
  const searchId = useId();
  const [view, setView] = useState<SkillsShView>(initialView);
  const [query, setQuery] = useState(initialQuery);
  const [listing, setListing] = useState<Listing>({ state: "loading" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, RemoteSkillDetail | "loading" | "error">>({});

  useEffect(() => {
    if (!open) return;
    setView(initialView);
    setQuery(initialQuery);
  }, [open, initialView, initialQuery]);

  // The chosen list, or (two letters or more) skills.sh's search a moment after typing stops.
  const needle = query.trim();
  useEffect(() => {
    if (!open) return;
    setOpenId(null);
    setListing({ state: "loading" });
    const controller = new AbortController();
    const fail = (error: unknown) => !controller.signal.aborted && setListing({ state: "error", busy: error instanceof SkillsShError && error.busy });
    const timer = setTimeout(
      () => {
        const request = needle.length >= 2 ? searchSkillsSh(needle, controller.signal) : loadSkillsShList(view);
        void request.then((found) => !controller.signal.aborted && setListing({ state: "done", skills: found })).catch(fail);
      },
      needle.length >= 2 ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, view, needle]);

  function toggle(skill: RemoteSkill) {
    const opening = openId !== skill.id;
    setOpenId(opening ? skill.id : null);
    if (!opening || details[skill.id]) return;
    setDetails((current) => ({ ...current, [skill.id]: "loading" }));
    void loadSkillsShDetail(skill)
      .then((detail) => setDetails((current) => ({ ...current, [skill.id]: detail })))
      .catch(() => setDetails((current) => ({ ...current, [skill.id]: "error" })));
  }

  return (
    <ShellDialog
      open={open}
      onOpenChange={onOpenChange}
      top={
        <ShapeProvider defaultShape="pill">
          <Tabs size="compact" value={view} onValueChange={(value) => { setView(value as SkillsShView); setQuery(""); }} className="self-center">
            <TabsList className="[&>div:first-child]:!bg-background [&>div:first-child]:!shadow-[0_1px_2px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.08)] dark:[&>div:first-child]:!bg-white/12">
              {VIEWS.map(({ view: value, labelKey }) => (
                <TabItem key={value} value={value} label={t(labelKey)} className={TAB_CLASS} />
              ))}
            </TabsList>
          </Tabs>
        </ShapeProvider>
      }
      icon={<span className={cn("grid size-8 place-items-center", SHELL_RADIUS, SHELL_SURFACE)}><Stars02 aria-hidden="true" className="size-4 text-foreground" /></span>}
      title={t("skills.empty.browse")}
      description={t("skills.browse.description")}
    >
      <ShellField label={t("skills.search")} htmlFor={searchId} trailing={<SearchMd aria-hidden="true" className="mr-2.5 size-3.5 shrink-0 text-muted-foreground" />}>
        <input id={searchId} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("skills.browse.placeholder")} className={SHELL_FIELD_INPUT} />
      </ShellField>

      {listing.state === "loading" ? (
        <p className="px-1 text-[12px] text-muted-foreground">{t("skills.browse.loading")}</p>
      ) : listing.state === "error" ? (
        <p className="px-1 text-[12px] text-destructive">{t(listing.busy ? "skills.browse.busy" : "skills.browse.error")}</p>
      ) : listing.skills.length === 0 ? (
        <p className="px-1 text-[12px] text-muted-foreground">{t("skills.browse.none", { query: needle })}</p>
      ) : (
        <ScrollArea className={cn("flex max-h-[320px] min-h-0 flex-col", SHELL_RADIUS, SHELL_SURFACE)} viewportClassName="min-h-0 flex-1 [&>div[style]]:!block [&>div[style]]:!min-w-0">
          <ol className="divide-y divide-border">
            {listing.skills.slice(0, 100).map((skill, index) => {
              const added = skills.isInstalled(installedIdFor(skill));
              const expanded = openId === skill.id;
              const detail = details[skill.id];
              const adding = addRemote.state[skill.id];
              return (
                <li key={skill.id}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button type="button" aria-expanded={expanded} onClick={() => toggle(skill)} className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none">
                      {needle.length < 2 && <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{index + 1}</span>}
                      <ChevronDown aria-hidden="true" className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-150", expanded && "rotate-180")} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] text-foreground">{skill.name}</span>
                          {skill.isOfficial && <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{t("skills.official")}</span>}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {skill.source} · {t("skills.browse.installs", { formatted: compactCount(skill.installs) })}
                        </span>
                      </span>
                    </button>
                    <a href={`${SKILLS_SH}/${skill.id}`} target="_blank" rel="noreferrer" aria-label={t("skills.browse.open")} title={t("skills.browse.open")} className={cn("grid size-6 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-hover hover:text-foreground", SHELL_RADIUS)}>
                      <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </a>
                    <button
                      type="button"
                      disabled={added || adding === "adding"}
                      title={adding === "error" ? t("skills.addFailed") : undefined}
                      onClick={() => void addRemote.add(skill)}
                      className={cn(
                        "flex h-6 shrink-0 items-center gap-1 border px-2 text-[12px] transition-colors disabled:cursor-default",
                        SHELL_RADIUS,
                        added ? "border-transparent bg-foreground text-background" : adding === "error" ? "border-destructive/50 text-destructive" : "border-border text-foreground hover:bg-hover",
                      )}
                    >
                      {added ? <Check aria-hidden="true" className="size-3" /> : <Plus aria-hidden="true" className={cn("size-3", adding === "adding" && "animate-spin")} />}
                      {added ? t("skills.browse.added") : t("skills.browse.add")}
                    </button>
                  </div>
                  {expanded && (
                    <p className={cn("px-3 pb-2.5 text-[12px] leading-[1.5] text-muted-foreground", needle.length < 2 ? "pl-[66px]" : "pl-[34px]")}>
                      {detail === "loading" || detail === undefined
                        ? t("skills.browse.loading")
                        : detail === "error"
                          ? t("skills.browse.noDetail")
                          : detail.description || "—"}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </ScrollArea>
      )}
    </ShellDialog>
  );
}
