import { MAX_BATCH_BYTES } from "./contract";

export class AnalyticsHttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

// Enforce the actual byte count even without (or with a forged) Content-Length.
export async function readAnalyticsJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-encoding") && request.headers.get("content-encoding") !== "identity") throw new AnalyticsHttpError(415, "unsupported_encoding");
  const type = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (type !== "application/json") throw new AnalyticsHttpError(415, "unsupported_media_type");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BATCH_BYTES)) throw new AnalyticsHttpError(413, "payload_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new AnalyticsHttpError(400, "invalid_json");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const read = async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BATCH_BYTES) throw new AnalyticsHttpError(413, "payload_too_large");
        chunks.push(value);
      }
      const body = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown; }
      catch { throw new AnalyticsHttpError(400, "invalid_json"); }
    };
    return await Promise.race([read(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new AnalyticsHttpError(408, "body_timeout")), 5000); })]);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}
