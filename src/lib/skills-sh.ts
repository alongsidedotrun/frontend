import { useState } from "react";
import { useSkills } from "@/lib/skills";

// skills.sh data for Settings > Skills (Discover) and Browse skills, through the
// backend's /skills-sh routes (backend/src/skills_sh.rs): its ranked lists,
// search, and a skill's SKILL.md when it's added.

export type SkillsShView = "all-time" | "trending" | "hot";

export interface RemoteSkill {
  /** source/skillId, which is also its page on skills.sh. */
  id: string;
  source: string;
  skillId: string;
  name: string;
  installs: number;
  isOfficial?: boolean;
}

export interface RemoteSkillDetail {
  name: string;
  description: string;
  instructions: string;
}

type Wire = { source: string; skill_id: string; name: string; installs: number; is_official?: boolean };

const fromWire = (skill: Wire): RemoteSkill => ({
  id: `${skill.source}/${skill.skill_id}`,
  source: skill.source,
  skillId: skill.skill_id,
  name: skill.name,
  installs: skill.installs,
  isOfficial: skill.is_official,
});

export class SkillsShError extends Error {
  readonly busy: boolean;
  constructor(busy: boolean) {
    super(busy ? "skills.sh is busy" : "skills.sh unavailable");
    this.busy = busy;
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new SkillsShError(response.status === 429);
  return (await response.json()) as T;
}

// The lists change slowly (the backend caches them for ten minutes too), so a
// view is fetched once per app session and shared by the page and the dialog.
const lists = new Map<SkillsShView, Promise<RemoteSkill[]>>();

export function loadSkillsShList(view: SkillsShView): Promise<RemoteSkill[]> {
  let list = lists.get(view);
  if (!list) {
    list = getJson<Wire[]>(`/skills-sh/leaderboard?view=${view}`).then((skills) => skills.map(fromWire));
    // A failure isn't kept: the next open tries again.
    list.catch(() => lists.delete(view));
    lists.set(view, list);
  }
  return list;
}

/** skills.sh search; it needs at least two characters. */
export async function searchSkillsSh(query: string, signal?: AbortSignal): Promise<RemoteSkill[]> {
  const results = await getJson<Wire[]>(`/skills-sh/search?q=${encodeURIComponent(query)}`, signal);
  return results.map(fromWire);
}

const details = new Map<string, Promise<RemoteSkillDetail>>();

/** A skill's SKILL.md (name, description, instructions). Only GitHub-hosted skills (owner/repo) have one to read. */
export function loadSkillsShDetail(skill: RemoteSkill): Promise<RemoteSkillDetail> {
  let detail = details.get(skill.id);
  if (!detail) {
    const parts = [...skill.source.split("/"), skill.skillId];
    detail =
      parts.length === 3
        ? getJson<RemoteSkillDetail>(`/skills-sh/skills/${parts.map(encodeURIComponent).join("/")}`)
        : Promise.reject(new SkillsShError(false));
    detail.catch(() => details.delete(skill.id));
    details.set(skill.id, detail);
  }
  return detail;
}

/** The id an added skills.sh skill is kept under in your skills. */
export const installedIdFor = (skill: RemoteSkill) => `skills-sh/${skill.id}`;

/** A skill's owner: the GitHub account in owner/repo, or the source itself. */
export const skillOwner = (skill: { source: string }) => skill.source.split("/")[0];

export const compactCount = (count: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(count);

/**
 * Adds a skills.sh skill to your skills: reads its SKILL.md first, so it comes
 * with its description and instructions. `state` tracks each skill being added
 * or that couldn't be (e.g. a skill not hosted on GitHub has no SKILL.md to read).
 */
export function useAddRemoteSkill() {
  const skills = useSkills();
  const [state, setState] = useState<Record<string, "adding" | "error">>({});
  async function add(skill: RemoteSkill) {
    setState((current) => ({ ...current, [skill.id]: "adding" }));
    try {
      const detail = await loadSkillsShDetail(skill);
      const owner = skillOwner(skill);
      skills.addCustom({
        id: installedIdFor(skill),
        name: detail.name || skill.name,
        description: detail.description,
        instructions: detail.instructions,
        publisher: { name: owner },
        source: skill.source,
      });
      setState(({ [skill.id]: _done, ...rest }) => rest);
    } catch {
      setState((current) => ({ ...current, [skill.id]: "error" }));
    }
  }
  return { add, state };
}
