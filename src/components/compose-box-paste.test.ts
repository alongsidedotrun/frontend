import { describe, expect, it } from "vitest";
import { pasteAttachesFiles, pastedImageFiles } from "./compose-box";

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

const withText = (files: File[], text: Record<string, string>) =>
  ({ ...clip(files, []), getData: (type: string) => text[type] ?? "" });

describe("pasteAttachesFiles", () => {
  it("attaches a screenshot (an image and no text)", () => {
    expect(pasteAttachesFiles(withText([png], {}))).toBe(true);
  });
  it("attaches a file copied in Finder (the file, and its name as plain text)", () => {
    expect(pasteAttachesFiles(withText([pdf], { "text/plain": "doc.pdf" }))).toBe(true);
  });
  it("pastes a document copy as text, even with a picture of it", () => {
    expect(pasteAttachesFiles(withText([png], { "text/plain": "Hello", "text/html": "<p>Hello</p>" }))).toBe(false);
  });
  it("attaches an image copied from a web page (formatted, but no text)", () => {
    expect(pasteAttachesFiles(withText([png], { "text/html": "<img src=x>" }))).toBe(true);
  });
  it("does nothing for plain text", () => {
    expect(pasteAttachesFiles(withText([], { "text/plain": "hi" }))).toBe(false);
  });
});
