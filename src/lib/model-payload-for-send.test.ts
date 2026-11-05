import { describe, expect, it } from "vitest";
import { modelPayloadForSend } from "./model-payload-for-send";

describe("modelPayloadForSend", () => {
  it("omits the model when the picker matches the server session", () => {
    expect(modelPayloadForSend("grok-4.5", "grok-4.5")).toBeUndefined();
  });

  it("sends the picker model only when it differs from the server session", () => {
    expect(modelPayloadForSend("grok-4.5", "gpt-5.6-sol")).toBe("grok-4.5");
  });

  it("omits a stale picker value when the server model is not known yet", () => {
    expect(modelPayloadForSend("gpt-5.6-sol", null)).toBeUndefined();
    expect(modelPayloadForSend("gpt-5.6-sol", undefined)).toBeUndefined();
    expect(modelPayloadForSend("gpt-5.6-sol", "")).toBeUndefined();
  });

  it("omits an empty picker selection", () => {
    expect(modelPayloadForSend(undefined, "grok-4.5")).toBeUndefined();
    expect(modelPayloadForSend("", "grok-4.5")).toBeUndefined();
  });
});
