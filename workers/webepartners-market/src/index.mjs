/**
 * NAPRAWNIK MARKET — WebePartners datafeed adapter.
 * Isolated Worker; do not bind to production billing databases or secrets.
 *
 * Required bindings:
 *   DB: dedicated D1 database for the market catalog
 *   MARKET_ADMIN_TOKEN: Worker secret used by POST /admin/sync and /admin/status
 *   FEED_CONFIG: Worker secret JSON array:
 *     [{"program":"Strefa Motocykli","url":"https://...","category":"motocykle"}]
 *
 * Public API:
 *   GET /health
 *   GET /products?q=&category=&limit=&cursor=
 *   GET /categories
 * Admin API:
 *   POST /admin/sync (Authorization: Bearer ...)
 *   GET /admin/status (Authorization: Bearer ...)
 */
const CORS = {
  "Access-Control-Allow-Origin": "https://localhost",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Vary": "Origin"
};
const MAX_FEEDS = 50;
const MAX_PRODUCTS_PER_FEED = 20000;
const MAX_QUERY = 100;
const MAX_LIMIT = 60;
function allowedFeedHosts(env) {
  return new Set(String(env.FEED_ALLOWED_HOSTS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function safeText(value, max = 500) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function xmlTag(block, names) {
  for (const name of names) {
    const re = new RegExp("<(?:[\\w.-]+:)?"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?"+name+"\\s*>", "i");
    const match = block.match(re);
    if (match) return safeText(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"), 2000);
  }
  return "";
}
function parseFeed(body, feed, contentType) {
  const trimmedBody = body.trimStart();
  if (/json/i.test(contentType) || trimmedBody.startsWith("{") || trimmedBody.startsWith("[")) {
    let parsed;
    try { parsed = JSON.parse(body); } catch { throw new Error("Feed declares JSON but could not be parsed"); }
    const rows = Array.isArray(parsed) ? parsed :
      (parsed.products || parsed.items || parsed.data || parsed.offers || []);
    if (!Array.isArray(rows)) throw new Error("Unrecognized JSON feed structure");
    return rows.slice(0, MAX_PRODUCTS_PER_FEED).map((p, i) => {
      const pick = (...keys) => {
        for (const key of keys) if (p?.[key] != null && p[key] !== "") return p[key];
        return "";
      };
      const title = safeText(pick("name","title","product_name"),300);
      const url = safeText(pick("aw_deep_link","deeplink","link","url","product_url"),2000);
      const image = safeText(pick("aw_image_url","image_link","image","image_url"),2000);
      const priceRaw = pick("search_price","price","sale_price","amount");
      const price = Number(String(priceRaw).replace(",",".").replace(/[^0-9.]/g,""));
      if (!title || !/^https:\/\//i.test(url)) return null;
      return {
        external_id:safeText(pick("aw_product_id","id","product_id","sku") || url || title,180) || String(i),
        title, description:safeText(pick("description","product_description"),2000),
        brand:safeText(pick("brand","manufacturer"),200),
        category:safeText(feed.category || pick("category","product_type") || "inne",100),
        price:Number.isFinite(price)&&price>0?price:null,
        currency:safeText(pick("currency","currency_code") || "PLN",3).toUpperCase(),
        product_url:url,image_url:/^https:\/\//i.test(image)?image:null,
        program:safeText(feed.program,120)
      };
    }).filter(Boolean);
  }
  const items = body.match(/<(?:[\w.-]+:)?(?:product|item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w.-]+:)?(?:product|item|entry)\s*>/gi) || [];
  return items.slice(0, MAX_PRODUCTS_PER_FEED).map((block, i) => {
    const get = (...names) => xmlTag(block, names);
    const title = get("name", "title", "product_name");
    const url = get("aw_deep_link", "deeplink", "link", "url", "product_url");
    const image = get("aw_image_url", "image_link", "image", "image_url");
    const id = get("aw_product_id", "id", "product_id", "sku") || url || title;
    const priceRaw = get("search_price", "price", "sale_price", "amount");
    const price = Number(String(priceRaw).replace(",", ".").replace(/[^0-9.]/g, ""));
    if (!title || !url || !/^https:\/\//i.test(url)) return null;
    return {
      external_id: safeText(id, 180) || String(i),
      title: safeText(title, 300),
      description: get("description", "product_description"),
      brand: get("brand", "manufacturer"),
      category: safeText(feed.category || get("category", "product_type") || "inne", 100),
      price: Number.isFinite(price) && price > 0 ? price : null,
      currency: safeText(get("currency", "currency_code") || "PLN", 3).toUpperCase(),
      product_url: url,
      image_url: /^https:\/\//i.test(image) ? image : null,
      program: safeText(feed.program, 120)
    };
  }).filter(Boolean);
}
async function feedConfig(env) {
  let feeds;
  try { feeds = JSON.parse(env.FEED_CONFIG || "[]"); } catch { throw new Error("FEED_CONFIG is not valid JSON"); }
  if (!Array.isArray(feeds) || feeds.length > MAX_FEEDS) throw new Error("FEED_CONFIG must be an array of up to 50 feeds");
  const allowed = allowedFeedHosts(env);
  if (feeds.length && !allowed.size) throw new Error("FEED_ALLOWED_HOSTS must list exact approved feed hostnames");
  for (const f of feeds) {
    let u;
    try { u = new URL(f.url); } catch { throw new Error("Each feed requires a valid HTTPS URL"); }
    if (u.protocol !== "https:" || u.username || u.password || u.hash || (u.port && u.port !== "443") || !allowed.has(u.hostname.toLowerCase())) {
      throw new Error("Feed URL must use an allowlisted HTTPS hostname without credentials or custom ports");
    }
  }
  return feeds;
}
async function authorized(request, env) {
  const expected = env.MARKET_ADMIN_TOKEN;
  const supplied = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || !supplied || supplied.length !== expected.length) return false;
  const a = new TextEncoder().encode(supplied), b = new TextEncoder().encode(expected);
  let diff = 0; for (let i=0;i<a.length;i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function syncFeeds(env) {
  const feeds = await feedConfig(env);
  const results = [];
  for (const feed of feeds) {
    const started = Date.now();
    try {
      const response = await fetch(feed.url, { headers: { "Accept": "application/xml,text/xml,application/json" }, redirect: "manual", signal: AbortSignal.timeout(25000) });
      if (response.status >= 300 && response.status < 400) throw new Error("Feed redirects are blocked; use the final HTTPS feed URL from WebePartners");
      if (!response.ok) throw new Error("Feed HTTP " + response.status);
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > 25 * 1024 * 1024) throw new Error("Feed exceeds 25 MB limit");
      const body = await response.text();
      if (body.length > 25 * 1024 * 1024) throw new Error("Feed exceeds 25 MB limit");
      const products = parseFeed(body, feed, response.headers.get("content-type") || "");
      let imported = 0;
      for (let i=0;i<products.length;i+=50) {
        const batch = products.slice(i,i+50);
        const stmts = batch.map(p => env.DB.prepare(`INSERT INTO market_products
          (program, external_id, title, description, brand, category, price, currency, product_url, image_url, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(program, external_id) DO UPDATE SET
          title=excluded.title, description=excluded.description, brand=excluded.brand,
          category=excluded.category, price=excluded.price, currency=excluded.currency,
          product_url=excluded.product_url, image_url=excluded.image_url, updated_at=datetime('now')`)
          .bind(p.program,p.external_id,p.title,p.description,p.brand,p.category,p.price,p.currency,p.product_url,p.image_url));
        await env.DB.batch(stmts);
        imported += batch.length;
      }
      await env.DB.prepare(`INSERT INTO market_sync_runs(program,status,product_count,duration_ms,message)
        VALUES (?, 'ok', ?, ?, ?)`).bind(feed.program, imported, Date.now()-started, "Feed synchronized").run();
      results.push({ program: feed.program, status: "ok", imported });
    } catch (e) {
      const message = safeText(e?.message || "Unknown error", 300);
      await env.DB.prepare(`INSERT INTO market_sync_runs(program,status,product_count,duration_ms,message)
        VALUES (?, 'error', 0, ?, ?)`).bind(safeText(feed.program,120), Date.now()-started, message).run();
      results.push({ program: feed.program, status: "error", message });
    }
  }
  return results;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/health" && request.method === "GET") return json({ ok: true, service: "naprawnik-market", version: 1 });
    if (url.pathname === "/products" && request.method === "GET") {
      const q = safeText(url.searchParams.get("q"), MAX_QUERY);
      const category = safeText(url.searchParams.get("category"), 100);
      const limit = Math.max(1, Math.min(MAX_LIMIT, Number(url.searchParams.get("limit")) || 30));
      const cursor = Math.max(0, Number(url.searchParams.get("cursor")) || 0);
      const where = [], values = [];
      if (q) { where.push("(title LIKE ? OR brand LIKE ? OR description LIKE ?)"); values.push("%"+q+"%","%"+q+"%","%"+q+"%"); }
      if (category) { where.push("category = ?"); values.push(category); }
      const sql = "SELECT id,program,external_id,title,description,brand,category,price,currency,product_url,image_url,updated_at FROM market_products "+(where.length?"WHERE "+where.join(" AND "):"")+" ORDER BY title COLLATE NOCASE LIMIT ? OFFSET ?";
      const rows = await env.DB.prepare(sql).bind(...values,limit,cursor).all();
      return json({ items: rows.results || [], next_cursor: (rows.results || []).length === limit ? cursor+limit : null });
    }
    if (url.pathname === "/categories" && request.method === "GET") {
      const rows = await env.DB.prepare("SELECT category, COUNT(*) AS count FROM market_products GROUP BY category ORDER BY category").all();
      return json({ categories: rows.results || [] });
    }
    if (url.pathname.startsWith("/admin/")) {
      if (!(await authorized(request, env))) return json({ error: "Unauthorized" }, 401);
      if (url.pathname === "/admin/sync" && request.method === "POST") return json({ results: await syncFeeds(env) });
      if (url.pathname === "/admin/status" && request.method === "GET") {
        const [products, runs] = await Promise.all([
          env.DB.prepare("SELECT COUNT(*) AS count FROM market_products").first(),
          env.DB.prepare("SELECT program,status,product_count,duration_ms,message,created_at FROM market_sync_runs ORDER BY id DESC LIMIT 20").all()
        ]);
        return json({ product_count: products?.count || 0, recent_runs: runs.results || [] });
      }
    }
    return json({ error: "Not found" }, 404);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(syncFeeds(env));
  }
};

export { parseFeed, feedConfig };
