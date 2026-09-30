export type DeliverySignal = "pending" | "delivered" | "opened" | "bounced";
export type RiskAction = "hold" | "manual_review" | "eligible_for_release";

export type PaymentContext = {
  amountCents: number;
  riskScore: number;
};

export type RiskDecision = {
  action: RiskAction;
  reason: string;
};

export function decideRiskAction(
  payment: PaymentContext,
  delivery: DeliverySignal,
): RiskDecision {
  if (delivery === "bounced") {
    return { action: "hold", reason: "payment notice bounced" };
  }
  if (payment.riskScore >= 70 || payment.amountCents >= 100_000) {
    return { action: "manual_review", reason: "payment exceeds the automatic release threshold" };
  }
  if (delivery === "delivered") {
    return { action: "eligible_for_release", reason: "low-risk payment notice was delivered" };
  }
  return {
    action: "manual_review",
    reason: delivery === "opened" ? "an open is an audit signal, not authorization" : "delivery is pending",
  };
}
