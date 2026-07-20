export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

export async function readJson(request, maxBytes = 48 * 1024) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new HttpError(413, "请求内容过大");
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "请求不是有效 JSON");
  }
}

export class HttpError extends Error {
  constructor(status, message, code = "BAD_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  console.error("[api] unexpected error", error);
  return json({ error: "御前驿站暂时繁忙，请稍后再试", code: "INTERNAL_ERROR" }, 500);
}
