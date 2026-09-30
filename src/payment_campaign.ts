import { z } from "zod";
import { infrai } from "./infrai_email.js";
import { decideRiskAction, type DeliverySignal } from "./payment_risk_policy.js";

export type CampaignRequest = {
  paymentId: string;
  customerEmail: string;
  amountCents: number;
  currency: string;
  riskScore: number;
};

export const campaignRequestSchema = z.object({
  paymentId: z.string().min(1).max(100),
  customerEmail: z.string().email(),
  amountCents: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  riskScore: z.number().int().min(0).max(100),
}).strict() as z.ZodType<CampaignRequest>;

export type AuditEntry = {
  at: string;
  signal: DeliverySignal;
  action: ReturnType<typeof decideRiskAction>["action"];
  reason: string;
};

export type CampaignRecord = CampaignRequest & {
  messageId: string;
  audit: AuditEntry[];
};

const records = new Map<string, CampaignRecord>();

function money(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amountCents / 100);
}

function eventNames(value: unknown): string[] {
  if (typeof value === "string") return [value.toLowerCase()];
  if (Array.isArray(value)) return value.flatMap(eventNames);
  if (value && typeof value === "object") return Object.values(value).flatMap(eventNames);
  return [];
}

export function deliverySignal(events: unknown): DeliverySignal {
  const names = eventNames(events);
  if (names.some((name) => name.includes("bounce"))) return "bounced";
  if (names.some((name) => name.includes("open"))) return "opened";
  if (names.some((name) => name.includes("deliver"))) return "delivered";
  return "pending";
}

export async function startPaymentCampaign(input: CampaignRequest): Promise<CampaignRecord> {
  const subject = `Payment notice ${input.paymentId}`;
  const html = `<h1>Payment received</h1><p>We recorded ${money(input.amountCents, input.currency)}.</p><p>Reference: ${input.paymentId}</p>`;
  const { data } = await infrai.email.send(
    { to: input.customerEmail, subject, html },
    `payment-notice:${input.paymentId}`,
  );
  const decision = decideRiskAction(input, "pending");
  const record: CampaignRecord = {
    ...input,
    messageId: data.message_id,
    audit: [{ at: new Date().toISOString(), signal: "pending", ...decision }],
  };
  records.set(record.messageId, record);
  return record;
}

export async function refreshCampaign(messageId: string): Promise<CampaignRecord | undefined> {
  const record = records.get(messageId);
  if (!record) return undefined;
  const { data } = await infrai.email.event.list(messageId);
  const signal = deliverySignal(data);
  const decision = decideRiskAction(record, signal);
  const last = record.audit.at(-1);
  if (!last || last.signal !== signal || last.action !== decision.action) {
    record.audit.push({ at: new Date().toISOString(), signal, ...decision });
  }
  return record;
}
