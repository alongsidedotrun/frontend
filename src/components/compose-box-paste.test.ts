import { describe, expect, it } from "vitest";
import { pastedImageFiles } from "./compose-box";

const png = new File(["x"], "shot.png", { type: "image/png" });
const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
const item = (file: File | null, kind = "file") => ({ kind, getAsFile: () => file }) as unknown as DataTransferItem;
const clip = (files: File[], items: DataTransferItem[]) =>
  ({ files: files as unknown as FileList, items: items as unknown as DataTransferItemList });

describe("pastedImageFiles", () => {
  it("takes images from files", () => {
    expect(pastedImageFiles(clip([png, pdf], []))).toEqual([png]);
  });
  it("falls back to items when files is empty (a copied screenshot)", () => {
    expect(pastedImageFiles(clip([], [item(png), item(null, "string")]))).toEqual([png]);
  });
  it("finds nothing in a text-only paste", () => {
    expect(pastedImageFiles(clip([], [item(null, "string")]))).toEqual([]);
  });
});
