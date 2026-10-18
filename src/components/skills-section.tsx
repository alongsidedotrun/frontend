import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Check, File02, FilterLines, Plus, SearchMd, Stars02, SwitchVertical01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabItem, Tabs, TabsList } from "@/components/ui/tabs";
import { DropdownMenu, DropdownTrigger, DropdownContent } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import { ShapeProvider } from "@/lib/shape-context";
import { ShellDialog, ShellDialogActions, ShellField, SHELL_FIELD_INPUT, SHELL_RADIUS, SHELL_SURFACE } from "@/components/design-system/shell-dialog";
import { readSkillFile, SKILLS_SH, useSkills, type Skill } from "@/lib/skills";
import { cachedSkillsShSearch, compactCount, installedIdFor, loadSkillsShList, loadSkillsShOfficial, searchSkillsSh, skillOwner, useAddRemoteSkill, type OfficialCompany, type RemoteSkill, type SkillsShView } from "@/lib/skills-sh";
import { cn } from "@/lib/utils";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";

// Discover's sections after Official, from skills.sh's own lists (and its pages, for See all).
const SECTIONS: readonly { view: SkillsShView; titleKey: string; page: string }[] = [
  { view: "all-time", titleKey: "skills.group.popular", page: "" },
  { view: "hot", titleKey: "skills.view.hot", page: "hot" },
  { view: "trending", titleKey: "skills.view.trending", page: "trending" },
];
const SECTION_SIZE = 6;
// Same pill segmented control as Invite members.
const TAB_CLASS = "h-[22px] px-2.5 [&>span]:!text-[12px] [&>span]:!leading-none";

type Sort = "featured" | "installs" | "name";
type Loaded<T> = T | "loading" | "error";

function sortSkills<T extends { name: string; installs?: number }>(skills: readonly T[], sort: Sort): T[] {
  if (sort === "name") return [...skills].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "installs") return [...skills].sort((a, b) => (b.installs ?? 0) - (a.installs ?? 0));
  return [...skills];
}

/**
 * Settings > Skills. Discover is skills.sh: its official companies, then its
 * Most installed, Hot and Trending lists, or its search; Installed is what
 * you've added. Browse more opens skills.sh; Add skill takes your own .md file.
 */
export function SkillsSection() {
  const { t } = useTranslation();
  const skills = useSkills();
  const addRemote = useAddRemoteSkill();
  const [tab, setTab] = useState<"installed" | "discover">("discover");
  const [query, setQuery] = useState("");
  const [officialOnly, setOfficialOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("featured");
  const [lists, setLists] = useState<Record<SkillsShView, Loaded<RemoteSkill[]>>>({ trending: "loading", hot: "loading", "all-time": "loading" });
  const [results, setResults] = useState<Loaded<RemoteSkill[]> | null>(null);
  // A search is on its way; the results on screen stay until it lands.
  const [searching, setSearching] = useState(false);
  const [official, setOfficial] = useState<Loaded<OfficialCompany[]>>("loading");
  // Add skill: pick a Markdown file, then name and describe it in the dialog.
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState(false);
  const [draft, setDraft] = useState<{ fileName: string; name: string; description: string; instructions: string } | null>(null);

  useEffect(() => {
    void loadSkillsShOfficial().then(setOfficial).catch(() => setOfficial("error"));
    for (const { view } of SECTIONS) {
      void loadSkillsShList(view)
        .then((list) => setLists((current) => ({ ...current, [view]: list })))
        .catch(() => setLists((current) => ({ ...current, [view]: "error" })));
    }
  }, []);

  // Discover's search goes to skills.sh, a moment after typing stops.
  const needle = query.trim();
  useEffect(() => {
    if (tab !== "discover" || needle.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    // Made before this session: straight away, no wait.
    const cached = cachedSkillsShSearch(needle);
    if (cached) {
      setResults(cached);
      setSearching(false);
      return;
    }
    // Otherwise the current results stay on screen (narrowed to what's typed, below) while
    // skills.sh answers; placeholders only when there's nothing to show yet.
    setSearching(true);
    setResults((current) => (Array.isArray(current) ? current : "loading"));
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchSkillsSh(needle, controller.signal)
        .then((found) => {
          setResults(found);
          setSearching(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults("error");
          setSearching(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tab, needle]);

  const keep = (skill: RemoteSkill) => !officialOnly || skill.isOfficial;
  // While a search is on its way, the results on screen narrow to what's typed at once.
  const lowerNeedle = needle.toLowerCase();
  const shownResults = Array.isArray(results)
    ? (searching ? results.filter((skill) => `${skill.name} ${skill.source}`.toLowerCase().includes(lowerNeedle)) : results).filter(keep)
    : results;
  const installed = sortSkills(
    skills.installed.filter((skill) => !needle || `${skill.name} ${skill.description} ${skill.publisher.name}`.toLowerCase().includes(needle.toLowerCase())),
    sort === "installs" ? "featured" : sort,
  );
  const remoteCard = (skill: RemoteSkill) => (
    <RemoteSkillCard
      key={skill.id}
      skill={skill}
      added={skills.isInstalled(installedIdFor(skill))}
      state={addRemote.state[skill.id]}
      onAdd={() => void addRemote.add(skill)}
      onRemove={() => skills.remove(installedIdFor(skill))}
    />
  );

  return (
    <div className="@container flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-foreground">{t("settings.nav.skills")}</h2>
          <p className="mt-0.5 text-[13px] font-normal text-muted-foreground">{t("settings.nav.subtitle.skills")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".md"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              // Markdown only, even when the system picker is switched to All files.
              if (!/\.md$/i.test(file.name)) {
                setFileError(true);
                return;
              }
              setFileError(false);
              void file.text().then((text) => setDraft({ fileName: file.name, ...readSkillFile(text, file.name) }));
            }}
          />
          {/* skills.sh itself, searching for whatever is typed here. */}
          <Button size="compact" variant="tertiary" trailingIcon={ArrowUpRight} asChild>
            <a href={needle.length >= 2 ? `${SKILLS_SH}/search?q=${encodeURIComponent(needle)}` : SKILLS_SH} target="_blank" rel="noreferrer">{t("skills.browseMore")}</a>
          </Button>
          <Button size="compact" variant="primary" leadingIcon={Plus} onClick={() => fileRef.current?.click()}>{t("skills.add")}</Button>
        </div>
      </div>

      {fileError && <p className="mt-2 text-[12px] text-destructive">{t("skills.mdOnly")}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <ShapeProvider defaultShape="pill">
          <Tabs size="compact" value={tab} onValueChange={(value) => setTab(value as "installed" | "discover")}>
            <TabsList className="[&>div:first-child]:!bg-background [&>div:first-child]:!shadow-[0_1px_2px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.08)] dark:[&>div:first-child]:!bg-white/12">
              <TabItem value="installed" label={t("skills.tabs.installed")} className={TAB_CLASS} />
              <TabItem value="discover" label={t("skills.tabs.discover")} className={TAB_CLASS} />
            </TabsList>
          </Tabs>
        </ShapeProvider>
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative w-48 min-w-0">
            {/* Fades out while a search is on its way, back in when it lands. */}
            <SearchMd
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground transition-opacity duration-200 ease-in-out motion-reduce:transition-none",
                searching && "opacity-0",
              )}
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === "discover" ? t("skills.browse.placeholder") : t("skills.search")}
              aria-label={t("skills.search")}
              className="h-7 border border-border pl-8 text-[length:var(--redesign-chat-meta)] shadow-none dark:border-border"
            />
          </div>
          {tab === "discover" && (
            <DropdownMenu size="compact">
              <DropdownTrigger render={<Button size="compact" variant="tertiary" leadingIcon={FilterLines} active={officialOnly}>{officialOnly ? t("skills.official") : t("skills.filter")}</Button>} />
              <DropdownContent align="end" className="w-44 min-w-0">
                <MenuItem index={0} label={t("skills.filter.everything")} checked={!officialOnly} onSelect={() => setOfficialOnly(false)} />
                <MenuItem index={1} label={t("skills.official")} checked={officialOnly} onSelect={() => setOfficialOnly(true)} />
              </DropdownContent>
            </DropdownMenu>
          )}
          <DropdownMenu size="compact">
            <DropdownTrigger render={<Button size="compact" variant="tertiary" leadingIcon={SwitchVertical01}>{t("skills.sort")}</Button>} />
            <DropdownContent align="end" className="w-40 min-w-0">
              <MenuItem index={0} label={t("skills.sort.featured")} checked={sort === "featured"} onSelect={() => setSort("featured")} />
              {tab === "discover" && <MenuItem index={1} label={t("skills.group.popular")} checked={sort === "installs"} onSelect={() => setSort("installs")} />}
              <MenuItem index={2} label={t("skills.sort.name")} checked={sort === "name"} onSelect={() => setSort("name")} />
            </DropdownContent>
          </DropdownMenu>
        </div>
      </div>

      {tab === "installed" ? (
        installed.length > 0 ? (
          <section className="mt-8">
            <SkillGrid>
              {installed.map((skill) => (
                <InstalledSkillCard key={skill.id} skill={skill} onRemove={() => skills.remove(skill.id)} />
              ))}
            </SkillGrid>
          </section>
        ) : (
          <EmptyState>
            {needle ? t("skills.empty.search") : t("skills.empty.installed")}
            {!needle && <Button size="compact" variant="tertiary" onClick={() => setTab("discover")}>{t("skills.empty.browse")}</Button>}
          </EmptyState>
        )
      ) : results !== null ? (
        <section className="mt-8">
          <h3 className="mb-2.5 text-[length:var(--redesign-font-size-compact)] text-muted-foreground">{t("skills.results")}</h3>
          {shownResults === "error" ? (
            <EmptyState>{t("skills.browse.error")}</EmptyState>
          ) : !searching && Array.isArray(shownResults) && shownResults.length === 0 ? (
            <EmptyState>{t("skills.browse.none", { query: needle })}</EmptyState>
          ) : (
            <SkeletonReveal loading={shownResults === "loading" || !shownResults || (searching && shownResults.length === 0)} skeleton={<SkeletonGrid count={6} />}>
              {Array.isArray(shownResults) && (
                <div className={cn("transition-opacity duration-150", searching && "opacity-70")}>
                  <SkillGrid>{sortSkills(shownResults, sort).map(remoteCard)}</SkillGrid>
                </div>
              )}
            </SkeletonReveal>
          )}
        </section>
      ) : (
        <>
        <section className="mt-8">
          <SectionHeader title={t("skills.official")} page="official" />
          {official === "error" ? (
            <EmptyState>{t("skills.browse.error")}</EmptyState>
          ) : (
            <SkeletonReveal loading={official === "loading"} skeleton={<SkeletonGrid count={6} official />}>
            {official !== "loading" && (
            <SkillGrid>
              {official.map((company) => (
                <OfficialCompanyCard
                  key={company.owner}
                  company={company}
                  isAdded={(skill) => skills.isInstalled(installedIdFor(skill))}
                  state={addRemote.state}
                  onAdd={(skill) => void addRemote.add(skill)}
                  onRemove={(skill) => skills.remove(installedIdFor(skill))}
                />
              ))}
            </SkillGrid>
            )}
            </SkeletonReveal>
          )}
        </section>
        {SECTIONS.map(({ view, titleKey, page }) => {
          const list = lists[view];
          return (
            <section key={view} className="mt-8">
              <SectionHeader title={t(titleKey)} page={page} />
              {list === "error" ? (
                <EmptyState>{t("skills.browse.error")}</EmptyState>
              ) : (
                <SkeletonReveal loading={list === "loading"} skeleton={<SkeletonGrid count={SECTION_SIZE} />}>
                  {list !== "loading" && <SkillGrid>{sortSkills(list.filter(keep), sort).slice(0, SECTION_SIZE).map(remoteCard)}</SkillGrid>}
                </SkeletonReveal>
              )}
            </section>
          );
        })}
        </>
      )}

      <AddSkillDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onAdd={(skill) => { skills.addCustom(skill); setDraft(null); setTab("installed"); }}
      />
    </div>
  );
}

/** A section's title, and See all: its page on skills.sh. */
function SectionHeader({ title, page }: { title: string; page: string }) {
  const { t } = useTranslation();
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="text-[length:var(--redesign-font-size-compact)] text-muted-foreground">{title}</h3>
      <a href={`${SKILLS_SH}/${page}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[length:var(--redesign-font-size-compact)] text-muted-foreground transition-colors hover:text-foreground">
        {t("skills.seeAll")}
        <ArrowUpRight aria-hidden="true" className="size-3" />
      </a>
    </div>
  );
}

/** An official company: its avatar and name, its main repo, and that repo's top three skills, each addable. */
function OfficialCompanyCard({
  company,
  isAdded,
  state,
  onAdd,
  onRemove,
}: {
  company: OfficialCompany;
  isAdded: (skill: RemoteSkill) => boolean;
  state: Record<string, "adding" | "error">;
  onAdd: (skill: RemoteSkill) => void;
  onRemove: (skill: RemoteSkill) => void;
}) {
  const { t } = useTranslation();
  return (
    <article className={CARD}>
      <div className="flex items-center gap-2">
        <OwnerMark source={company.repo} size="md" />
        <a href={`${SKILLS_SH}/${company.owner}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[length:var(--redesign-chat-text)] font-medium text-foreground hover:underline">
          {company.owner}
        </a>
        <span className="shrink-0 text-[length:var(--redesign-chat-meta)] text-muted-foreground">{t("skills.browse.installs", { formatted: compactCount(company.totalInstalls) })}</span>
      </div>
      <a href={`${SKILLS_SH}/${company.repo}`} target="_blank" rel="noreferrer" className="mt-1 truncate text-[length:var(--redesign-chat-meta)] text-muted-foreground hover:underline">
        {company.repo}
      </a>
      <ul className="mt-2 flex flex-col gap-1">
        {company.skills.map((skill) => (
          <li key={skill.id} className="flex items-center gap-2">
            <Stars02 aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
            <a href={`${SKILLS_SH}/${skill.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[length:var(--redesign-chat-meta)] text-foreground hover:underline">
              {skill.name}
            </a>
            <span className="shrink-0 text-[length:var(--redesign-chat-meta)] text-muted-foreground">{compactCount(skill.installs)}</span>
            <AddToggle name={skill.name} added={isAdded(skill)} busy={state[skill.id] === "adding"} failed={state[skill.id] === "error"} onAdd={() => onAdd(skill)} onRemove={() => onRemove(skill)} />
          </li>
        ))}
      </ul>
    </article>
  );
}

function SkillGrid({ children }: { children: React.ReactNode }) {
  // Three across in the settings column; two, then one, as it narrows.
  return <div className="grid grid-cols-1 gap-3 @[440px]:grid-cols-2 @[640px]:grid-cols-3">{children}</div>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-10 text-center text-[length:var(--redesign-chat-text)] text-muted-foreground">
      {children}
    </div>
  );
}

const CARD = "flex min-h-[124px] flex-col rounded-xl border border-border bg-card p-3.5";

/** Skeleton cards shaped like the real ones (a skill card, or an official company's), for SkeletonReveal. */
function SkeletonGrid({ count, official = false }: { count: number; official?: boolean }) {
  const bar = "rounded bg-muted";
  return (
    <SkillGrid>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={CARD}>
          <div className="flex items-center gap-2">
            <span className={cn(bar, official ? "size-5" : "size-3.5")} />
            <span className={cn(bar, "h-3 w-2/5")} />
            <span className={cn(bar, "ml-auto h-3", official ? "w-14" : "size-6")} />
          </div>
          <span className={cn(bar, "mt-2.5 h-2.5 w-1/2")} />
          {official ? (
            <div className="mt-3 flex flex-col gap-2.5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-2">
                  <span className={cn(bar, "size-3")} />
                  <span className={cn(bar, "h-2.5 w-2/5")} />
                  <span className={cn(bar, "ml-auto h-2.5 w-8")} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-auto flex items-center gap-1.5 pt-2.5">
              <span className={cn(bar, "size-3.5")} />
              <span className={cn(bar, "h-2.5 w-1/4")} />
              <span className={cn(bar, "ml-auto h-2.5 w-1/5")} />
            </div>
          )}
        </div>
      ))}
    </SkillGrid>
  );
}

/** + adds; once added it's a check, which removes it again. */
function AddToggle({ name, added, busy, failed, onAdd, onRemove }: { name: string; added: boolean; busy?: boolean; failed?: boolean; onAdd: () => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const label = failed ? t("skills.addFailed") : t(added ? "skills.remove" : "skills.install", { name });
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={added ? onRemove : onAdd}
      className={cn(
        "grid size-6 shrink-0 place-items-center border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        SHELL_RADIUS,
        added
          ? "border-transparent bg-foreground text-background hover:opacity-85"
          : failed
            ? "border-destructive/50 text-destructive"
            : "border-border text-muted-foreground hover:bg-hover hover:text-foreground",
      )}
    >
      {added ? <Check aria-hidden="true" className="size-3" /> : <Plus aria-hidden="true" className={cn("size-3", busy && "animate-spin")} />}
    </button>
  );
}

function RemoteSkillCard({ skill, added, state, onAdd, onRemove }: { skill: RemoteSkill; added: boolean; state?: "adding" | "error"; onAdd: () => void; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <article className={CARD}>
      <div className="flex items-center gap-2">
        <Stars02 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <a href={`${SKILLS_SH}/${skill.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[length:var(--redesign-chat-text)] font-medium text-foreground hover:underline">
          {skill.name}
        </a>
        {skill.isOfficial && <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{t("skills.official")}</span>}
        <AddToggle name={skill.name} added={added} busy={state === "adding"} failed={state === "error"} onAdd={onAdd} onRemove={onRemove} />
      </div>
      <p className="mt-1.5 truncate text-[length:var(--redesign-chat-meta)] text-muted-foreground">{skill.source}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-2.5 text-[length:var(--redesign-chat-meta)]">
        <span className="text-muted-foreground">{t("skills.by")}</span>
        <OwnerMark source={skill.source} />
        <span className="min-w-0 truncate text-foreground">{skillOwner(skill)}</span>
        <span className="ml-auto shrink-0 text-muted-foreground">{t("skills.browse.installs", { formatted: compactCount(skill.installs) })}</span>
      </div>
    </article>
  );
}

function InstalledSkillCard({ skill, onRemove }: { skill: Skill; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <article className={CARD}>
      <div className="flex items-center gap-2">
        <Stars02 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <h4 className="min-w-0 flex-1 truncate text-[length:var(--redesign-chat-text)] font-medium text-foreground">{skill.name}</h4>
        <AddToggle name={skill.name} added onAdd={() => {}} onRemove={onRemove} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-[length:var(--redesign-chat-meta)] leading-[1.5] text-muted-foreground">{skill.description}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-2.5 text-[length:var(--redesign-chat-meta)]">
        <span className="text-muted-foreground">{t("skills.by")}</span>
        {skill.source ? <OwnerMark source={skill.source} /> : <LetterMark name={skill.publisher.name} />}
        <span className="truncate text-foreground">{skill.publisher.name}</span>
      </div>
    </article>
  );
}

/** A skills.sh owner's GitHub avatar (owner/repo sources), or their first letter. Loaded lazily. */
function OwnerMark({ source, size = "sm" }: { source: string; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const owner = skillOwner({ source });
  if (!source.includes("/") || failed) return <LetterMark name={owner} size={size} />;
  return (
    <img
      src={`https://github.com/${encodeURIComponent(owner)}.png?size=${size === "md" ? 64 : 40}`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-cover", size === "md" ? "size-5 rounded-[5px]" : "size-3.5 rounded-[3px]")}
    />
  );
}

function LetterMark({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span aria-hidden="true" className={cn("grid shrink-0 place-items-center bg-muted font-medium text-foreground", size === "md" ? "size-5 rounded-[5px] text-[11px]" : "size-3.5 rounded-[3px] text-[9px]")}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Add skill, once a file is picked: the name from its # heading (editable), a
 * description to write, and the file itself as the instructions.
 */
function AddSkillDialog({
  draft,
  onClose,
  onAdd,
}: {
  draft: { fileName: string; name: string; description: string; instructions: string } | null;
  onClose: () => void;
  onAdd: (skill: { name: string; description: string; instructions: string }) => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // Fresh fields for each picked file.
  useEffect(() => {
    if (!draft) return;
    setName(draft.name);
    setDescription(draft.description);
  }, [draft]);
  const ready = Boolean(name.trim() && description.trim());

  return (
    <ShellDialog
      centered
      open={draft !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
      icon={<span className={cn("grid size-8 place-items-center", SHELL_RADIUS, SHELL_SURFACE)}><Stars02 aria-hidden="true" className="size-4 text-foreground" /></span>}
      title={t("skills.add")}
      description={t("skills.dialog.description")}
      actions={
        <ShellDialogActions
          cancelLabel={t("common.cancel")}
          onCancel={onClose}
          primary={{ label: t("skills.add"), type: "submit", form: formId, disabled: !ready }}
        />
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready || !draft) return;
          onAdd({ name: name.trim(), description: description.trim(), instructions: draft.instructions });
        }}
      >
        <ShellField label={t("workspace.fields.name")} htmlFor={nameId}>
          <input id={nameId} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("skills.fields.namePlaceholder")} maxLength={60} className={SHELL_FIELD_INPUT} />
        </ShellField>
        {/* Description: a white card like the fields, its label on top (as in workspaces). */}
        <section className={cn("flex flex-col gap-1 px-3 pt-2 pb-1", SHELL_RADIUS, SHELL_SURFACE)}>
          <label htmlFor={descriptionId} className="text-[12px] text-muted-foreground">{t("skills.fields.description")}</label>
          <textarea
            id={descriptionId}
            autoFocus
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("skills.fields.descriptionPlaceholder")}
            maxLength={160}
            rows={2}
            className="resize-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </section>
        {/* The picked file, which becomes the instructions. */}
        <div className={cn("flex h-8 items-center gap-2 px-3 text-[12px] text-muted-foreground", SHELL_RADIUS, SHELL_SURFACE)}>
          <File02 aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate text-foreground">{draft?.fileName}</span>
          <span className="ml-auto shrink-0">{t("skills.fields.instructions")}</span>
        </div>
      </form>
    </ShellDialog>
  );
}
