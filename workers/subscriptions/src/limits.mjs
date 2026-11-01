// NAPRAWNIK — limity planów AMATOR / PRO / WARSZTAT i atomowe liczniki zużycia (D1).
// Limity "stock" (pojazdy, przypomnienia, pomiary...) dotyczą liczby elementów; limity "monthly"
// odnawiają się z okresem rozliczeniowym użytkownika i nie przechodzą na kolejny okres.

export const GB = 1024 * 1024 * 1024;

// null = brak funkcji (0 dostępnych), Infinity = bez limitu (tylko właściciel/ADMIN).
export const PLAN_LIMITS = Object.freeze({
  amator: Object.freeze({
    vehicles: 1, reminders: 5, measurements: 20, customers: 0, customer_vehicles: 0,
    parts_searches: 10, photos_local: 10, photos: 0, photo_bytes: 0, ai_analyses: 0,
    new_orders: 0, archived_orders: 0, cloud_backup: 0
  }),
  pro: Object.freeze({
    vehicles: 3, reminders: 15, measurements: 150, customers: 0, customer_vehicles: 0,
    parts_searches: 50, photos_local: 0, photos: 50, photo_bytes: 1 * GB, ai_analyses: 5,
    new_orders: 0, archived_orders: 0, cloud_backup: 1
  }),
  warsztat: Object.freeze({
    vehicles: 500, reminders: 200, measurements: 5000, customers: 2000, customer_vehicles: 500,
    parts_searches: 300, photos_local: 0, photos: 300, photo_bytes: 10 * GB, ai_analyses: 30,
    new_orders: 30, archived_orders: 500, cloud_backup: 1
  })
});

// Metryki rozliczane miesięcznie (okres rozliczeniowy) — egzekwowane atomowo w D1.
export const MONTHLY_METRICS = Object.freeze(["parts_searches", "photos", "ai_analyses", "new_orders"]);
// Metryki łączne (stan) wymagające licznika po stronie serwera (zajętość zdjęć).
export const STOCK_BYTES_METRIC = "photo_bytes";
// Metryki "stock" sprawdzane przy zapisie kopii w chmurze.
export const BACKUP_STOCK_METRICS = Object.freeze({
  vehicles: "naprawnik_vehicles",
  reminders: "naprawnik_reminders",
  measurements: "naprawnik_measurements",
  customers: "naprawnik_customers",
  archived_orders: "naprawnik_orders_archived"
});

export function limitsForTier(tier, isAdmin = false) {
  if (isAdmin) return null; // brak limitów dla właściciela
  return PLAN_LIMITS[tier] || PLAN_LIMITS.amator;
}

function addMonthsUtc(seconds, months) {
  const d = new Date(seconds * 1000);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1,
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const lastDay = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, lastDay));
  return Math.floor(t.getTime() / 1000);
}

// Okres miesięczny zakotwiczony do końca okresu rozliczeniowego (anchorEnd). Bez kotwicy: miesiąc kalendarzowy UTC.
export function monthlyWindow(now, anchorEnd = null) {
  if (Number.isFinite(anchorEnd) && anchorEnd > 0) {
    let k = 0;
    // Najmniejsze k, dla którego początek okna <= now.
    while (addMonthsUtc(anchorEnd, -k) > now && k < 400) k += 1;
    const start = addMonthsUtc(anchorEnd, -k);
    const end = k === 0 ? Math.max(anchorEnd, now + 1) : addMonthsUtc(anchorEnd, -(k - 1));
    if (start <= now && now < end) return { start, end };
  }
  const d = new Date(now * 1000);
  const start = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
  const end = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000);
  return { start, end };
}

// Kotwica okresu: koniec okresu aktywnej płatnej subskrypcji (najwyższy plan), inaczej brak (miesiąc UTC).
export async function billingAnchor(env, userId, now) {
  const { results = [] } = await env.DB.prepare(
    "SELECT tier, status, current_period_end, grace_until FROM subscriptions WHERE user_id = ?"
  ).bind(userId).all();
  const rank = t => (t === "warsztat" ? 2 : t === "pro" ? 1 : 0);
  const active = results.filter(s =>
    (["active", "trialing"].includes(s.status) && Number(s.current_period_end) > now));
  active.sort((a, b) => rank(b.tier) - rank(a.tier) || Number(b.current_period_end) - Number(a.current_period_end));
  return active.length ? Number(active[0].current_period_end) : null;
}

export async function getPeriod(env, userId, now) {
  const anchor = await billingAnchor(env, userId, now);
  const w = monthlyWindow(now, anchor);
  return { ...w, key: "p" + w.start };
}

async function readUsed(env, userId, metric, periodKey) {
  const row = await env.DB.prepare(
    "SELECT used FROM usage_counters WHERE user_id = ? AND metric = ? AND period_key = ?"
  ).bind(userId, metric, periodKey).first();
  return Number(row?.used || 0);
}

// Odczyt pełnego stanu zużycia (do UI i do /api/me).
export async function readUsage(env, userId, tier, isAdmin, now) {
  const limits = limitsForTier(tier, isAdmin);
  const period = await getPeriod(env, userId, now);
  const usage = {};
  for (const m of MONTHLY_METRICS) usage[m] = await readUsed(env, userId, m, period.key);
  usage[STOCK_BYTES_METRIC] = await readUsed(env, userId, STOCK_BYTES_METRIC, "total");
  return {
    tier, unlimited: !limits,
    limits: limits ? Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, v])) : null,
    usage,
    period: { start: period.start, renewsAt: period.end }
  };
}

// Atomowe zużycie jednostki. Idempotentne po kluczu zdarzenia (to samo zdarzenie nie liczy się dwa razy).
export async function consumeUsage(env, { userId, tier, isAdmin, metric, amount = 1, key, bytes = 0, now }) {
  const limits = limitsForTier(tier, isAdmin);
  const isMonthly = MONTHLY_METRICS.includes(metric);
  if (!isMonthly) return { ok: false, status: 400, error: "Nieznana metryka limitu." };
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10) return { ok: false, status: 400, error: "Nieprawidłowa ilość." };
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 25 * 1024 * 1024) return { ok: false, status: 400, error: "Nieprawidłowy rozmiar." };
  if (typeof key !== "string" || !/^[A-Za-z0-9_.:-]{8,100}$/.test(key)) return { ok: false, status: 400, error: "Brak lub nieprawidłowy klucz zdarzenia." };
  const period = await getPeriod(env, userId, now);
  const limit = limits ? limits[metric] : Infinity;
  const bytesLimit = limits ? limits[STOCK_BYTES_METRIC] : Infinity;
  const renewsAt = period.end;

  const prior = await env.DB.prepare(
    "SELECT metric, amount FROM usage_events WHERE user_id = ? AND idem_key = ?"
  ).bind(userId, key).first();
  if (prior) {
    if (prior.metric !== metric) return { ok: false, status: 409, error: "Klucz zdarzenia użyty dla innej operacji." };
    return { ok: true, duplicate: true, used: await readUsed(env, userId, metric, period.key), limit, renewsAt };
  }
  if (!(limit > 0)) {
    return { ok: false, status: 403, code: "LIMIT_EXCEEDED", metric, limit: 0, used: 0, renewsAt,
      error: "Ta funkcja nie jest dostępna w Twoim planie." };
  }
  const bytesAddition = metric === "photos" ? bytes : 0;
  const nowMs = now;
  const stmts = [
    env.DB.prepare("INSERT OR IGNORE INTO usage_counters (user_id, metric, period_key, used, updated_at) VALUES (?, ?, ?, 0, ?)")
      .bind(userId, metric, period.key, nowMs),
    env.DB.prepare("INSERT OR IGNORE INTO usage_counters (user_id, metric, period_key, used, updated_at) VALUES (?, ?, 'total', 0, ?)")
      .bind(userId, STOCK_BYTES_METRIC, nowMs),
    // Zdarzenie powstaje tylko, gdy mieści się w limicie (jedna instrukcja = atomowe sprawdzenie).
    env.DB.prepare(`INSERT INTO usage_events (user_id, idem_key, metric, amount, bytes, period_key, created_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
      WHERE (SELECT used FROM usage_counters WHERE user_id = ?1 AND metric = ?3 AND period_key = ?6) + ?4 <= ?8
        AND (SELECT used FROM usage_counters WHERE user_id = ?1 AND metric = ?9 AND period_key = 'total') + ?5 <= ?10
      ON CONFLICT(user_id, idem_key) DO NOTHING`)
      .bind(userId, key, metric, amount, bytesAddition, period.key, nowMs, limit, STOCK_BYTES_METRIC, bytesLimit),
    env.DB.prepare(`UPDATE usage_counters SET used = used + ?1, updated_at = ?2
      WHERE user_id = ?3 AND metric = ?4 AND period_key = ?5
        AND EXISTS (SELECT 1 FROM usage_events WHERE user_id = ?3 AND idem_key = ?6 AND applied = 0)`)
      .bind(amount, nowMs, userId, metric, period.key, key),
    env.DB.prepare(`UPDATE usage_counters SET used = used + ?1, updated_at = ?2
      WHERE user_id = ?3 AND metric = ?4 AND period_key = 'total' AND ?1 > 0
        AND EXISTS (SELECT 1 FROM usage_events WHERE user_id = ?3 AND idem_key = ?5 AND applied = 0)`)
      .bind(bytesAddition, nowMs, userId, STOCK_BYTES_METRIC, key),
    env.DB.prepare("UPDATE usage_events SET applied = 1 WHERE user_id = ? AND idem_key = ? AND applied = 0").bind(userId, key)
  ];
  await env.DB.batch(stmts);
  const stored = await env.DB.prepare("SELECT 1 AS x FROM usage_events WHERE user_id = ? AND idem_key = ?").bind(userId, key).first();
  const used = await readUsed(env, userId, metric, period.key);
  if (!stored) {
    const bytesUsed = await readUsed(env, userId, STOCK_BYTES_METRIC, "total");
    const byBytes = metric === "photos" && bytesUsed + bytesAddition > bytesLimit && used < limit;
    return { ok: false, status: 403, code: "LIMIT_EXCEEDED", metric: byBytes ? STOCK_BYTES_METRIC : metric,
      limit: byBytes ? bytesLimit : limit, used: byBytes ? bytesUsed : used, renewsAt,
      error: byBytes ? "Wykorzystano przestrzeń na zdjęcia w Twoim planie." : "Wykorzystano miesięczny limit w Twoim planie." };
  }
  return { ok: true, duplicate: false, used, limit, renewsAt };
}

// Cofnięcie zdarzenia (np. nieudana analiza AI) albo zwolnienie przestrzeni po usunięciu zdjęcia.
export async function refundUsage(env, { userId, key, now }) {
  const ev = await env.DB.prepare(
    "SELECT metric, amount, bytes, period_key FROM usage_events WHERE user_id = ? AND idem_key = ?"
  ).bind(userId, key).first();
  if (!ev) return { ok: true, refunded: false };
  await env.DB.batch([
    env.DB.prepare("DELETE FROM usage_events WHERE user_id = ? AND idem_key = ?").bind(userId, key),
    env.DB.prepare("UPDATE usage_counters SET used = MAX(0, used - ?1), updated_at = ?2 WHERE user_id = ?3 AND metric = ?4 AND period_key = ?5")
      .bind(Number(ev.amount), now, userId, ev.metric, ev.period_key),
    env.DB.prepare("UPDATE usage_counters SET used = MAX(0, used - ?1), updated_at = ?2 WHERE user_id = ?3 AND metric = ?4 AND period_key = 'total' AND ?1 > 0")
      .bind(Number(ev.bytes || 0), now, userId, STOCK_BYTES_METRIC)
  ]);
  return { ok: true, refunded: true };
}

// Liczenie elementów w kopii w chmurze i porównanie z limitem planu. Nie kasuje danych:
// zapis jest odrzucany tylko, jeśli kopia PRZEKRACZA limit i jednocześnie ZWIĘKSZA liczbę elementów.
export function countBackupItems(value) {
  const data = value && typeof value === "object" && value.data && typeof value.data === "object" ? value.data : {};
  const counts = {};
  for (const [metric, key] of Object.entries(BACKUP_STOCK_METRICS)) {
    counts[metric] = Array.isArray(data[key]) ? data[key].length : 0;
  }
  return counts;
}

export function checkBackupLimits(tier, isAdmin, nextValue, previousValue) {
  const limits = limitsForTier(tier, isAdmin);
  if (!limits) return null;
  const next = countBackupItems(nextValue);
  const prev = previousValue ? countBackupItems(previousValue) : {};
  const violations = [];
  for (const [metric, count] of Object.entries(next)) {
    const lim = limits[metric];
    if (lim === undefined) continue;
    if (count > lim && count > Number(prev[metric] || 0)) violations.push({ metric, limit: lim, count });
  }
  return violations.length ? violations : null;
}

