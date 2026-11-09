import { describe, expect, it } from "vitest";
import { translations } from "@/i18n/translations";

describe("bot names", () => {
  // A bot isn't called by "@name", so messages about one name it plainly (#566).
  it("show without an @ in every language", () => {
    for (const key of ["settings.bots.imported", "settings.bots.importedMissing"] as const) {
      for (const text of Object.values(translations[key])) expect(text).not.toContain("@");
    }
  });
});
