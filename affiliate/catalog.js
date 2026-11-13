/* NAPRAWNIK affiliate catalog — offline-safe data layer. No credentials or network calls. */
(function (root) {
  "use strict";
  const allowedHosts = new Set(["webep1.com", "www.webep1.com"]);
  function safeAffiliateUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" && allowedHosts.has(url.hostname) ? url.href : null;
    } catch (_) { return null; }
  }
  function normalizeOffer(raw, merchants, categories) {
    if (!raw || typeof raw !== "object") return null;
    const merchant = merchants.find(x => x.id === raw.merchantId && x.status === "verified");
    if (!merchant || !categories.some(x => x.id === raw.categoryId)) return null;
    const url = safeAffiliateUrl(raw.affiliateUrl);
    const title = String(raw.title || "").trim();
    if (!url || !title) return null;
    const price = Number(raw.price);
    return {
      id: String(raw.id || [merchant.id, raw.sku || title].join(":")),
      title,
      merchantId: merchant.id,
      merchantName: merchant.name,
      categoryId: raw.categoryId,
      affiliateUrl: url,
      imageUrl: /^https:\/\//i.test(String(raw.imageUrl || "")) ? String(raw.imageUrl) : null,
      price: Number.isFinite(price) && price > 0 ? price : null,
      currency: raw.currency === "PLN" ? "PLN" : null,
      description: String(raw.description || "").trim()
    };
  }
  function filterOffers(offers, query, categoryId) {
    const q = String(query || "").trim().toLocaleLowerCase("pl");
    return offers.filter(item =>
      (!categoryId || item.categoryId === categoryId) &&
      (!q || (item.title + " " + item.description + " " + item.merchantName).toLocaleLowerCase("pl").includes(q))
    );
  }
  root.NaprawnikAffiliate = Object.freeze({ safeAffiliateUrl, normalizeOffer, filterOffers });
})(typeof window !== "undefined" ? window : globalThis);
