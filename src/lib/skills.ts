import { useSyncExternalStore } from "react";

// Skills: reusable instructions an agent can be given. Discover and Browse
// skills come from skills.sh (src/lib/skills-sh.ts); the skills you add (from
// skills.sh, or your own .md files) are kept by the backend for your account
// (#540, GET/POST/DELETE /skills), so a bot can be given them (Settings > Bots)
// and "/skill <name>" sends their instructions with a message. Settings > Skills
// manages them; the composer's + menu offers them.

export interface SkillPublisher {
  name: string;
  /** A logo; without one the card shows the name's first letter. */
  icon?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  publisher: SkillPublisher;
  instructions?: string;
  /** Added from skills.sh: source/skillId, its page there. */
  source?: string;
  /** skills.sh marks it official (from the company itself). Not recorded for skills added before this field existed. */
  official?: boolean;
}

// skills.sh, Vercel's open directory of agent skills.
export const SKILLS_SH = "https://www.skills.sh";

const YOU: SkillPublisher = { name: "You" };

// Where skills were kept before the backend had them; moved over once, then removed.
const OLD_STORAGE_KEY = "alongside_skills";
const listeners = new Set<() => void>();
const EMPTY: Skill[] = [];
let skills: Skill[] = EMPTY;
let loading: Promise<void> | null = null;

function emit(next: Skill[]) {
  skills = next;
  listeners.forEach((listener) => listener());
}

type StoredSkill = Omit<Skill, "publisher" | "source" | "official"> & { publisher?: SkillPublisher | null; source?: string | null; official?: boolean | null };

function fromServer(row: StoredSkill): Skill {
  return { ...row, publisher: row.publisher ?? YOU, source: row.source ?? undefined, official: row.official ?? undefined };
}

async function post(skill: Skill): Promise<boolean> {
  const response = await fetch("/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(skill) }).catch(() => null);
  return Boolean(response?.ok);
}

// Skills this browser kept before #540 go to the account the first time the list loads.
async function moveOldSkills() {
  let old: Skill[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) ?? "null") as { custom?: Skill[] } | null;
    old = Array.isArray(parsed?.custom) ? parsed.custom : [];
  } catch {
    return;
  }
  if (old.length === 0) return;
  const results = await Promise.all(old.map(post));
  if (results.every(Boolean)) localStorage.removeItem(OLD_STORAGE_KEY);
}

/** Loads the account's skills again (after signing in or out, or a change elsewhere). */
export function reloadSkills(): Promise<void> {
  loading = (async () => {
    await moveOldSkills();
    const response = await fetch("/skills").catch(() => null);
    if (!response?.ok) return;
    emit(((await response.json()) as StoredSkill[]).map(fromServer));
  })();
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loading) void reloadSkills();
  return () => listeners.delete(listener);
}

/** The skills you've added, kept in step everywhere they show. */
export function useSkills() {
  const current = useSyncExternalStore(subscribe, () => skills);
  return {
    installed: current,
    isInstalled: (id: string) => current.some((skill) => skill.id === id),
    remove: (id: string) => {
      emit(skills.filter((skill) => skill.id !== id));
      void fetch(`/skills?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    },
    /** Your own skill, or one from skills.sh (its own id, publisher and source; added once). */
    addCustom: (skill: { name: string; description: string; instructions: string; id?: string; publisher?: SkillPublisher; source?: string; official?: boolean }) => {
      if (skill.id && skills.some((item) => item.id === skill.id)) return;
      const added: Skill = { ...skill, id: skill.id ?? `custom-${crypto.randomUUID()}`, publisher: skill.publisher ?? YOU };
      emit([...skills, added]);
      void post(added).then((ok) => {
        if (!ok) emit(skills.filter((item) => item.id !== added.id));
      });
    },
  };
}

/**
 * A skill file (.md) for Add skill: its name is the first "# " heading
 * (or the front matter's name, or the file name), its description the front
 * matter's if it has one (the person adds it otherwise), and the rest of the
 * file is the instructions.
 */
export function readSkillFile(text: string, fileName: string): { name: string; description: string; instructions: string } {
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text.trimStart());
  const field = (key: string) => {
    const line = frontMatter && new RegExp(`^${key}:\\s*(.+)$`, "m").exec(frontMatter[1]);
    return line ? line[1].trim().replace(/^["']|["']$/g, "") : "";
  };
  const body = (frontMatter ? text.trimStart().slice(frontMatter[0].length) : text).trim();
  const heading = /^#\s+(.+?)\s*#*\s*$/m.exec(body);
  const name = heading?.[1] ?? (field("name") || fileName.replace(/\.md$/i, ""));
  return { name, description: field("description"), instructions: body };
}
