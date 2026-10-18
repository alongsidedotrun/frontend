import { useSyncExternalStore } from "react";

// Skills: reusable instructions an agent can be given. There is no backend for
// them yet, so the catalog below is placeholder content (English only, like
// content from a server would be) and installed skills live in this browser.
// Settings > Skills manages them; the composer's + menu offers the installed ones.

export type SkillGroup = "recommended" | "new" | "popular";

export interface SkillPublisher {
  name: string;
  /** A logo under /public; without one the card shows the name's first letter. */
  icon?: string;
  invertInDark?: boolean;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  publisher: SkillPublisher;
  /** Catalog skills only. */
  group?: SkillGroup;
  /** Added or imported here: its own instructions. */
  instructions?: string;
}

// skills.sh, Vercel's open directory of agent skills. Browse skills searches it
// through the backend (skills_sh.rs); its pages are linked from results.
export const SKILLS_SH = "https://www.skills.sh";


const ALONGSIDE: SkillPublisher = { name: "Alongside", icon: "/alongside-mark.svg" };
const YOU: SkillPublisher = { name: "You" };

export const SKILL_CATALOG: readonly Skill[] = [
  { id: "code-review", group: "recommended", name: "Code review", description: "Reviews each change before it lands, flagging risky diffs, missing tests and unclear naming.", publisher: { name: "GitHub", icon: "/icons/providers/github.svg", invertInDark: true } },
  { id: "meeting-prep", group: "recommended", name: "Meeting prep", description: "Before each call, reads the related docs, notes and past chats and writes a one-page brief.", publisher: { name: "Claude", icon: "/icons/providers/claude.svg" } },
  { id: "weekly-summary", group: "recommended", name: "Weekly summary", description: "Every Friday, sums up what each chat and project moved forward, with links back to them.", publisher: ALONGSIDE },
  { id: "translation", group: "new", name: "Translation", description: "Translates docs and replies across 12 languages, keeping your tone and your terms.", publisher: { name: "Mistral", icon: "/icons/providers/mistral.svg" } },
  { id: "research-brief", group: "new", name: "Research brief", description: "Researches a topic on the web and returns sources, key numbers and open questions.", publisher: { name: "Perplexity", icon: "/icons/providers/perplexity.svg" } },
  { id: "sheet-cleanup", group: "new", name: "Sheet cleanup", description: "Tidies a spreadsheet: fixes column types, removes duplicates and adds a summary tab.", publisher: { name: "Google Sheets", icon: "/icons/google-sheets.svg" } },
  { id: "release-notes", group: "popular", name: "Release notes", description: "Turns merged changes into release notes grouped by feature, fix and breaking change.", publisher: { name: "OpenAI", icon: "/icons/providers/chatgpt.svg", invertInDark: true } },
  { id: "doc-drafts", group: "popular", name: "Doc drafts", description: "Drafts a document from the chat so far, with headings, decisions and next steps.", publisher: { name: "Google Docs", icon: "/icons/google-docs.svg" } },
  { id: "bug-triage", group: "popular", name: "Bug triage", description: "Reproduces a reported bug, finds the likely cause and proposes a fix with a test.", publisher: { name: "Codex", icon: "/icons/providers/codex.svg", invertInDark: true } },
];

interface SkillsState {
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

/** Installed skills (catalog ones, then your own), kept in step everywhere they show. */
export function useSkills() {
  const current = useSyncExternalStore(subscribe, read);
  const installed = [
    ...SKILL_CATALOG.filter((skill) => current.installed.includes(skill.id)),
    ...current.custom,
  ];
  return {
    installed,
    isInstalled: (id: string) => current.installed.includes(id) || current.custom.some((skill) => skill.id === id),
    install: (id: string) => {
      const now = read();
      if (!now.installed.includes(id)) write({ ...now, installed: [...now.installed, id] });
    },
    remove: (id: string) => {
      const now = read();
      write({ installed: now.installed.filter((item) => item !== id), custom: now.custom.filter((skill) => skill.id !== id) });
    },
    /** Your own skill, or one from skills.sh (its own id and publisher; added once). */
    addCustom: (skill: { name: string; description: string; instructions: string; id?: string; publisher?: SkillPublisher }) => {
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
