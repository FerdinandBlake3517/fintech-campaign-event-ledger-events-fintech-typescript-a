import { campaignRequestSchema, refreshCampaign, startPaymentCampaign } from "../src/payment_campaign.js";

const customerEmail = process.env.DEMO_EMAIL_TO;
if (!customerEmail) throw new Error("DEMO_EMAIL_TO is required");

const input = campaignRequestSchema.parse({
  paymentId: `demo-${Date.now()}`,
  customerEmail,
  amountCents: 4_250,
  currency: "USD",
  riskScore: 18,
});

const started = await startPaymentCampaign(input);
console.log("Campaign started:", { messageId: started.messageId, audit: started.audit });

const refreshed = await refreshCampaign(started.messageId);
console.log("Campaign refreshed:", refreshed);
