import assert from "node:assert/strict";
import test from "node:test";
import { decideRiskAction } from "../src/payment_risk_policy.js";

test("a bounce holds a low-risk payment instead of releasing it", () => {
  const decision = decideRiskAction({ amountCents: 4_250, riskScore: 18 }, "bounced");
  assert.deepEqual(decision, {
    action: "hold",
    reason: "payment notice bounced",
  });
});

test("an open remains an audit signal and does not authorize release", () => {
  const decision = decideRiskAction({ amountCents: 4_250, riskScore: 18 }, "opened");
  assert.equal(decision.action, "manual_review");
});
