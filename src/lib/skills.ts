import { useSyncExternalStore } from "react";

// Skills: reusable instructions an agent can be given. Discover and Browse
// skills come from skills.sh (src/lib/skills-sh.ts); the skills you add (from
// skills.sh, or your own .md files) live in this browser until skills have a
// backend. Settings > Skills manages them; the composer's + menu offers them.

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
}

// skills.sh, Vercel's open directory of agent skills.
export const SKILLS_SH = "https://www.skills.sh";

const YOU: SkillPublisher = { name: "You" };

interface SkillsState {
  /** Ids from the old placeholder catalog; no longer read. */
  installed: string[];
  custom: Skill[];
}

const STORAGE_KEY = "alongside_skills";
const listeners = new Set<() => void>();
let state: SkillsState | null = null;

function read(): SkillsState {
  if (state) return state;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as SkillsState | null;
    state = parsed && Array.isArray(parsed.installed) && Array.isArray(parsed.custom) ? parsed : { installed: [], custom: [] };
  } catch {
    state = { installed: [], custom: [] };
  }
  return state;
}

function write(next: SkillsState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: kept for this session only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The skills you've added, kept in step everywhere they show. */
export function useSkills() {
  const current = useSyncExternalStore(subscribe, read);
  return {
    installed: current.custom,
    isInstalled: (id: string) => current.custom.some((skill) => skill.id === id),
    remove: (id: string) => {
      const now = read();
      write({ ...now, custom: now.custom.filter((skill) => skill.id !== id) });
    },
    /** Your own skill, or one from skills.sh (its own id, publisher and source; added once). */
    addCustom: (skill: { name: string; description: string; instructions: string; id?: string; publisher?: SkillPublisher; source?: string }) => {
      const now = read();
      if (skill.id && now.custom.some((item) => item.id === skill.id)) return;
      write({ ...now, custom: [...now.custom, { ...skill, id: skill.id ?? `custom-${crypto.randomUUID()}`, publisher: skill.publisher ?? YOU }] });
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
