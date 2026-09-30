import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_email.js";
import { campaignRequestSchema, refreshCampaign, startPaymentCampaign } from "./payment_campaign.js";

const port = Number(process.env.PORT ?? 3000);

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (request.method === "POST" && url.pathname === "/payment-campaigns") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const input = campaignRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      json(response, 201, await startPaymentCampaign(input));
      return;
    }

    const match = url.pathname.match(/^\/payment-campaigns\/([^/]+)\/refresh$/);
    if (request.method === "POST" && match) {
      const record = await refreshCampaign(decodeURIComponent(match[1]));
      json(response, record ? 200 : 404, record ?? { error: "campaign not found" });
      return;
    }
    json(response, 404, { error: "route not found" });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "invalid request body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    console.error(error);
    json(response, 500, { error: "internal error" });
  }
});

server.listen(port, () => {
  console.log(`Payment campaign service listening on http://localhost:${port}`);
});
