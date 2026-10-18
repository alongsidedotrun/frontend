import { describe, expect, it } from "vitest";
import { parseSkillFile } from "@/lib/skills";

describe("parseSkillFile", () => {
  it("reads a SKILL.md's name, description and instructions", () => {
    const file = `---\nname: meeting-prep\ndescription: "Writes a one-page brief before each call."\n---\n\n# Meeting prep\n\nRead the related docs first.\n`;
    expect(parseSkillFile(file)).toEqual({
      name: "meeting-prep",
      description: "Writes a one-page brief before each call.",
      instructions: "# Meeting prep\n\nRead the related docs first.",
    });
  });

  it("refuses a file without front matter, a name or a description", () => {
    expect(parseSkillFile("# Just notes")).toBeNull();
    expect(parseSkillFile("---\nname: x\n---\nbody")).toBeNull();
    expect(parseSkillFile("---\ndescription: y\n---\nbody")).toBeNull();
  });
});
