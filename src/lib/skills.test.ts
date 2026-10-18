import { describe, expect, it } from "vitest";
import { readSkillFile } from "@/lib/skills";

describe("readSkillFile", () => {
  it("names the skill after its # heading and keeps the file as instructions", () => {
    expect(readSkillFile("# Meeting prep\n\nRead the related docs first.\n", "notes.md")).toEqual({
      name: "Meeting prep",
      description: "",
      instructions: "# Meeting prep\n\nRead the related docs first.",
    });
  });

  it("takes a description from front matter, which isn't part of the instructions", () => {
    const file = `---\nname: meeting-prep\ndescription: "Writes a brief before each call."\n---\n# Meeting prep\nSteps.`;
    expect(readSkillFile(file, "SKILL.md")).toEqual({ name: "Meeting prep", description: "Writes a brief before each call.", instructions: "# Meeting prep\nSteps." });
  });

  it("falls back to the front matter's name, then the file name", () => {
    expect(readSkillFile("---\nname: triage\n---\nSteps.", "x.md").name).toBe("triage");
    expect(readSkillFile("Just steps.", "Bug triage.md").name).toBe("Bug triage");
  });
});
