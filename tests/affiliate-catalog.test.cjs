const test = require("node:test");
const assert = require("node:assert/strict");
require("../affiliate/catalog.js");
const api = globalThis.NaprawnikAffiliate;

test("accepts only HTTPS WebePartners tracking URLs", () => {
  assert.equal(api.safeAffiliateUrl("https://webep1.com/go/example"), "https://webep1.com/go/example");
  assert.equal(api.safeAffiliateUrl("http://webep1.com/go/example"), null);
  assert.equal(api.safeAffiliateUrl("https://example.com/"), null);
});

test("does not publish offers from unverified merchants", () => {
  const categories = [{ id: "tools" }];
  const unverified = [{ id: "tooles", name: "Tooles", status: "pending_account_verification" }];
  assert.equal(api.normalizeOffer({ title: "Klucz", merchantId: "tooles", categoryId: "tools", affiliateUrl: "https://webep1.com/go/x" }, unverified, categories), null);
});

test("normalizes and filters a verified offer without inventing optional data", () => {
  const merchants = [{ id: "shop", name: "Sklep", status: "verified" }];
  const categories = [{ id: "tools" }];
  const offer = api.normalizeOffer({ title: "Klucz dynamometryczny", merchantId: "shop", categoryId: "tools", affiliateUrl: "https://webep1.com/go/x" }, merchants, categories);
  assert.equal(offer.title, "Klucz dynamometryczny");
  assert.equal(offer.price, null);
  assert.equal(offer.imageUrl, null);
  assert.equal(api.filterOffers([offer], "dynamometryczny", "tools").length, 1);
});

test("NAPRAWNIK MARKET tile has dedicated icon and is wired without replacing renderHome", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const ui = fs.readFileSync(path.join(__dirname, "../affiliate/market-ui.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const icon = fs.readFileSync(path.join(__dirname, "../assets/naprawnik-market-icon.svg"), "utf8");
  assert.match(html, /data-market-open/);
  assert.match(html, /naprawnik-market-icon\.svg/);
  assert.match(ui, /data-market-open/);
  assert.doesNotMatch(ui, /window\.renderHome\s*=/);
  assert.match(icon, /<svg[\s\S]*viewBox="0 0 512 512"/);
});

test("NAPRAWNIK MARKET is wired across both Web PWA and APK with shared backend", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../scripts/shared-manifest.json"), "utf8"));
  const ui = fs.readFileSync(path.join(__dirname, "../affiliate/market-ui.js"), "utf8");
  assert.match(html, /data-market-open/);
  assert.match(html, /naprawnik-market-icon\.svg/);
  assert.match(html, /affiliate\/market-ui\.js/);
  assert.ok(manifest.pwaPrecache.includes("./affiliate/market-ui.js"));
  assert.ok(manifest.pwaPrecache.includes("./assets/naprawnik-market-icon.svg"));
  assert.ok(manifest.apkPrecache.includes("./affiliate/market-ui.js"));
  assert.ok(manifest.apkPrecache.includes("./assets/naprawnik-market-icon.svg"));
  assert.match(ui, /https:\/\/naprawnik-market-live\.turbodiesel966\.workers\.dev/);
});
