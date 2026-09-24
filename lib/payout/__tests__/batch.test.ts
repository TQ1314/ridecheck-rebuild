import { describe, expect, it } from "vitest";
import { validateBatchChildren } from "../batch";

describe("validateBatchChildren", () => {
  it("fails when a child is missing", () => {
    expect(validateBatchChildren([{ id: "a", status: "approved" }], 2)).toBeTruthy();
  });
  it("fails when any child is not approved", () => {
    expect(validateBatchChildren([
      { id: "a", status: "approved" },
      { id: "b", status: "paid" },
    ], 2)).toBeTruthy();
  });
  it("allows exactly all approved children", () => {
    expect(validateBatchChildren([
      { id: "a", status: "approved" },
      { id: "b", status: "approved" },
    ], 2)).toBeNull();
  });
});