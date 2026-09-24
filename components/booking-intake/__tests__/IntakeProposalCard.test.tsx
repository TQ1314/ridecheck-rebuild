import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { IntakeProposalCard } from "../IntakeProposalCard";

const actions = {
  onChange: () => undefined,
  onConfirm: () => undefined,
  onManual: () => undefined,
};

describe("Intake confirmation card", () => {
  it("does not display a confirmation card when extraction has no proposed fields", () => {
    expect(renderToStaticMarkup(<IntakeProposalCard proposal={{}} {...actions} />)).toBe("");
    expect(renderToStaticMarkup(
      <IntakeProposalCard proposal={{ make: { value: null }, model: { value: "" } }} {...actions} />,
    )).toBe("");
  });

  it("displays only actual fields from a partial extraction", () => {
    const html = renderToStaticMarkup(
      <IntakeProposalCard
        proposal={{ make: { value: "Toyota" }, year: { value: 2015 }, model: { value: null }, trim: { value: "" } }}
        {...actions}
      />,
    );

    expect(html).toContain('data-testid="card-intake-proposal"');
    expect(html).toContain('data-testid="input-intake-proposal-make"');
    expect(html).toContain('data-testid="input-intake-proposal-year"');
    expect(html).not.toContain('data-testid="input-intake-proposal-model"');
    expect(html).not.toContain('data-testid="input-intake-proposal-trim"');
    expect(html).toContain('data-testid="button-confirm-intake"');
  });
});