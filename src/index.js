// CRUD Hello World: a Cloudflare Worker that serves the page and a small JSON API
// backed by a Supabase table (public.messages). The browser never talks to Supabase
// directly; the Supabase URL and key live in Worker secrets (SUPABASE_URL, SUPABASE_KEY).
import html from "./index.html";

const MAX_LEN = 40;
const MAX_BODY_BYTES = 2048;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

const page = () =>
  new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    },
  });

// Count characters the same way Postgres char_length() does (code points).
const charLength = (s) => [...s].length;

async function readContent(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    return { error: "Send JSON: {\"content\": \"...\"}", status: 415 };
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { error: "Request too large", status: 413 };
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: "Invalid JSON", status: 400 };
  }
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const len = charLength(content);
  if (len < 1) return { error: "Message can't be empty", status: 400 };
  if (len > MAX_LEN) return { error: `Message must be ${MAX_LEN} characters or fewer`, status: 400 };
  return { content };
}

function supabase(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_KEY,
      "content-type": "application/json",
      accept: "application/json",
      prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
}

async function fromSupabase(res, okStatus = 200) {
  if (!res.ok) {
    console.error("Supabase error", res.status, await res.text());
    return json({ error: "Database error, please try again" }, 502);
  }
  return json(await res.json(), okStatus);
}

const COLUMNS = "select=id,content,created_at";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (pathname === "/" || pathname === "/index.html") {
      if (method !== "GET" && method !== "HEAD") return json({ error: "Method not allowed" }, 405);
      return page();
    }

    if (!pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);

    if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
      return json({ error: "Server is missing its database settings" }, 500);
    }

    if (pathname === "/api/messages") {
      if (method === "GET") {
        const res = await supabase(env, `messages?${COLUMNS}&order=created_at.desc,id.desc&limit=100`);
        return fromSupabase(res);
      }
      if (method === "POST") {
        const { content, error, status } = await readContent(request);
        if (error) return json({ error }, status);
        const res = await supabase(env, `messages?${COLUMNS}`, {
          method: "POST",
          body: JSON.stringify({ content }),
        });
        if (!res.ok) return fromSupabase(res);
        const rows = await res.json();
        return json(rows[0], 201);
      }
      return json({ error: "Method not allowed" }, 405);
    }

    const match = pathname.match(/^\/api\/messages\/(\d{1,18})$/);
    if (match) {
      const id = match[1];
      if (method === "PUT" || method === "PATCH") {
        const { content, error, status } = await readContent(request);
        if (error) return json({ error }, status);
        const res = await supabase(env, `messages?id=eq.${id}&${COLUMNS}`, {
          method: "PATCH",
          body: JSON.stringify({ content }),
        });
        if (!res.ok) return fromSupabase(res);
        const rows = await res.json();
        return rows.length ? json(rows[0]) : json({ error: "Message not found" }, 404);
      }
      if (method === "DELETE") {
        const res = await supabase(env, `messages?id=eq.${id}&${COLUMNS}`, { method: "DELETE" });
        if (!res.ok) return fromSupabase(res);
        const rows = await res.json();
        return rows.length ? json({ deleted: rows[0].id }) : json({ error: "Message not found" }, 404);
      }
      if (method === "GET") {
        const res = await supabase(env, `messages?id=eq.${id}&${COLUMNS}`);
        if (!res.ok) return fromSupabase(res);
        const rows = await res.json();
        return rows.length ? json(rows[0]) : json({ error: "Message not found" }, 404);
      }
      return json({ error: "Method not allowed" }, 405);
    }

    return json({ error: "Not found" }, 404);
  },
};
