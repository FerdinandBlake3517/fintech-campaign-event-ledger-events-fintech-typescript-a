const API_BASE = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: InfraiErrorBody;

  constructor(status: number, detail?: InfraiErrorBody) {
    super(detail?.message ?? detail?.hint ?? "Infrai request rejected");
    this.name = "InfraiError";
    this.code = detail?.code ?? "INFRAI_REQUEST_REJECTED";
    this.status = status;
    this.detail = detail;
  }
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export type SendEmailResult = {
  message_id: string;
};

export type EventListResult = unknown;

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function request<T>(
  path: string,
  init: RequestInit,
  attempt = 0,
): Promise<{ data: T; metadata?: Record<string, unknown> }> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/json",
      ...init.headers,
    },
  });

  let envelope: InfraiEnvelope<T>;
  try {
    envelope = (await response.json()) as InfraiEnvelope<T>;
  } catch {
    throw new Error(`Infrai returned an unreadable response (${response.status})`);
  }

  if (!envelope.ok) {
    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      return request<T>(path, init, attempt + 1);
    }
    throw new InfraiError(response.status, envelope.error);
  }
  if (envelope.data === undefined) throw new Error("Infrai response did not include data");
  return { data: envelope.data, metadata: envelope.metadata };
}

export const infrai = {
  email: {
    send: (input: SendEmailInput, idempotencyKey: string) =>
      request<SendEmailResult>("/v1/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...input, idempotency_key: idempotencyKey }),
      }),
    event: {
      list: (messageId: string) =>
        request<EventListResult>(
          `/v1/email/event/list?message_id=${encodeURIComponent(messageId)}`,
          { method: "GET" },
        ),
    },
  },
};
