import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Check, ChevronDown, Plus, SearchMd, Stars02 } from "@untitledui/icons";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShapeProvider } from "@/lib/shape-context";
import { ShellDialog, ShellField, SHELL_FIELD_INPUT, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";
import { SKILLS_SH, useSkills } from "@/lib/skills";
import { cn } from "@/lib/utils";

type Result = { id: string; source: string; skill_id: string; name: string; installs: number };
type Detail = { name: string; description: string; instructions: string };

// Same pill segmented control as Invite members.
const TAB_CLASS = "h-[22px] px-2.5 [&>span]:!text-[12px] [&>span]:!leading-none";
// Topics to start from before anything is typed (skills.sh search needs two letters).
const SUGGESTIONS = ["React", "Design", "Testing", "Docs", "Python", "Marketing"];

const compactCount = (count: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(count);

/**
 * Browse skills: search skills.sh (through the backend's /skills-sh routes),
 * sorted by installs or relevance; a result opens to its description and
 * can be added to your skills.
 */
export function SkillsBrowserDialog({ open, onOpenChange, initialQuery = "" }: { open: boolean; onOpenChange: (open: boolean) => void; initialQuery?: string }) {
  const { t } = useTranslation();
  const skills = useSkills();
  const searchId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [order, setOrder] = useState<"installs" | "relevance">("installs");
  const [results, setResults] = useState<Result[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "busy" | "error">("idle");
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail | "loading" | "error">>({});
  const [adding, setAdding] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  // Searches a moment after typing stops; a reply to an older query is dropped.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setResults([]);
      setState("idle");
      return;
    }
    const request = ++latest.current;
    setState("loading");
    const timer = setTimeout(() => {
      void fetch(`/skills-sh/search?q=${encodeURIComponent(q)}`)
        .then(async (response) => {
          if (request !== latest.current) return;
          if (!response.ok) {
            setState(response.status === 429 ? "busy" : "error");
            return;
          }
          setResults((await response.json()) as Result[]);
          setState("done");
          setOpenId(null);
        })
        .catch(() => request === latest.current && setState("error"));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query]);

  async function loadDetail(result: Result): Promise<Detail | null> {
    const cached = details[result.id];
    if (cached && cached !== "loading" && cached !== "error") return cached;
    setDetails((current) => ({ ...current, [result.id]: "loading" }));
    try {
      const response = await fetch(`/skills-sh/skills/${result.id.split("/").map(encodeURIComponent).join("/")}`);
      if (!response.ok) throw new Error();
      const detail = (await response.json()) as Detail;
      setDetails((current) => ({ ...current, [result.id]: detail }));
      return detail;
    } catch {
      setDetails((current) => ({ ...current, [result.id]: "error" }));
      return null;
    }
  }

  async function add(result: Result) {
    setAdding(result.id);
    const detail = await loadDetail(result);
    setAdding(null);
    if (!detail) return;
    skills.addCustom({
      id: `skills-sh/${result.id}`,
      name: detail.name || result.name,
      description: detail.description,
      instructions: detail.instructions,
      publisher: { name: result.source.split("/")[0] },
    });
  }

  const shown = order === "installs" ? [...results].sort((a, b) => b.installs - a.installs) : results;

  return (
    <ShellDialog
      open={open}
      onOpenChange={onOpenChange}
      top={
        <ShapeProvider defaultShape="pill">
          <Tabs size="compact" value={order} onValueChange={(value) => setOrder(value as "installs" | "relevance")} className="self-center">
            <TabsList className="[&>div:first-child]:!bg-background [&>div:first-child]:!shadow-[0_1px_2px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.08)] dark:[&>div:first-child]:!bg-white/12">
              <TabItem value="installs" label={t("skills.group.popular")} className={TAB_CLASS} />
              <TabItem value="relevance" label={t("skills.browse.relevant")} className={TAB_CLASS} />
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

      {state === "idle" ? (
        <div className="flex flex-wrap items-center gap-1.5 px-1 text-[12px] text-muted-foreground">
          <span>{t("skills.browse.suggestions")}</span>
          {SUGGESTIONS.map((topic) => (
            <button key={topic} type="button" onClick={() => setQuery(topic)} className={cn("h-6 px-2 text-foreground transition-colors hover:bg-hover", SHELL_RADIUS, SHELL_SURFACE)}>
              {topic}
            </button>
          ))}
        </div>
      ) : state === "loading" && results.length === 0 ? (
        <p className="px-1 text-[12px] text-muted-foreground">{t("skills.browse.loading")}</p>
      ) : state === "busy" || state === "error" ? (
        <p className="px-1 text-[12px] text-destructive">{t(state === "busy" ? "skills.browse.busy" : "skills.browse.error")}</p>
      ) : shown.length === 0 ? (
        <p className="px-1 text-[12px] text-muted-foreground">{t("skills.browse.none", { query: query.trim() })}</p>
      ) : (
        <ScrollArea className={cn("flex max-h-[300px] min-h-0 flex-col", SHELL_RADIUS, SHELL_SURFACE)} viewportClassName="min-h-0 flex-1 [&>div[style]]:!block [&>div[style]]:!min-w-0">
          <ul className="divide-y divide-border">
            {shown.map((result) => {
              const added = skills.isInstalled(`skills-sh/${result.id}`);
              const expanded = openId === result.id;
              const detail = details[result.id];
              return (
                <li key={result.id}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => {
                        setOpenId(expanded ? null : result.id);
                        if (!expanded) void loadDetail(result);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
                    >
                      <ChevronDown aria-hidden="true" className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-150", expanded && "rotate-180")} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-foreground">{result.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {result.source} · {t("skills.browse.installs", { count: result.installs, formatted: compactCount(result.installs) })}
                        </span>
                      </span>
                    </button>
                    <a href={`${SKILLS_SH}/${result.id}`} target="_blank" rel="noreferrer" aria-label={t("skills.browse.open")} title={t("skills.browse.open")} className={cn("grid size-6 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-hover hover:text-foreground", SHELL_RADIUS)}>
                      <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </a>
                    <button
                      type="button"
                      disabled={added || adding === result.id}
                      onClick={() => void add(result)}
                      className={cn(
                        "flex h-6 shrink-0 items-center gap-1 border px-2 text-[12px] transition-colors disabled:cursor-default",
                        SHELL_RADIUS,
                        added ? "border-transparent bg-foreground text-background" : "border-border text-foreground hover:bg-hover",
                      )}
                    >
                      {added ? <Check aria-hidden="true" className="size-3" /> : <Plus aria-hidden="true" className="size-3" />}
                      {added ? t("skills.browse.added") : t("skills.browse.add")}
                    </button>
                  </div>
                  {expanded && (
                    <p className="px-3 pb-2.5 pl-[34px] text-[12px] leading-[1.5] text-muted-foreground">
                      {detail === "loading" || detail === undefined
                        ? t("skills.browse.loading")
                        : detail === "error"
                          ? t("skills.browse.error")
                          : detail.description || "—"}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </ShellDialog>
  );
}
