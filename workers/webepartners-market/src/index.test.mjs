import test from "node:test";
import assert from "node:assert/strict";
import { parseFeed, feedConfig } from "./index.mjs";

test("parses common JSON product feeds with an HTTPS affiliate URL", () => {
  const feed = { program: "Example partner", category: "narzedzia" };
  const rows = parseFeed(JSON.stringify([
    {
      id: "tool-1",
      title: "Klucz dynamometryczny",
      description: "Zakres 20–200 Nm",
      brand: "Example",
      link: "https://shop.example/product/tool-1",
      image_url: "https://shop.example/images/tool-1.jpg",
      price: "129,90",
      currency: "PLN"
    }
  ]), feed, "application/json");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].external_id, "tool-1");
  assert.equal(rows[0].title, "Klucz dynamometryczny");
  assert.equal(rows[0].price, 129.9);
  assert.equal(rows[0].program, "Example partner");
});

test("parses XML product/item feeds from the supplied response body", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <products><product>
      <id>part-7</id>
      <name>Świeca zapłonowa</name>
      <description><![CDATA[Świeca do silnika 4T]]></description>
      <brand>Example</brand>
      <link>https://shop.example/part-7</link>
      <image_link>https://shop.example/images/part-7.jpg</image_link>
      <price>19.99 PLN</price>
      <currency>PLN</currency>
    </product></products>`;
  const rows = parseFeed(xml, { program: "Example partner", category: "czesci" }, "application/xml");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].external_id, "part-7");
  assert.equal(rows[0].title, "Świeca zapłonowa");
  assert.equal(rows[0].description, "Świeca do silnika 4T");
  assert.equal(rows[0].product_url, "https://shop.example/part-7");
});

test("rejects feed URLs outside the exact HTTPS hostname allowlist", async () => {
  await assert.rejects(
    feedConfig({ FEED_CONFIG: JSON.stringify([{ program: "Bad", url: "https://evil.example/feed" }]), FEED_ALLOWED_HOSTS: "feed.example" }),
    /allowlisted HTTPS hostname/
  );
});

test("rejects feed URLs with credentials, custom ports or non-HTTPS schemes", async () => {
  for (const url of [
    "http://feed.example/products.xml",
    "https://user:pass@feed.example/products.xml",
    "https://feed.example:8443/products.xml"
  ]) {
    await assert.rejects(
      feedConfig({ FEED_CONFIG: JSON.stringify([{ program: "Bad", url }]), FEED_ALLOWED_HOSTS: "feed.example" })
    );
  }
});

test("accepts one exact allowlisted HTTPS feed URL", async () => {
  const feeds = await feedConfig({
    FEED_CONFIG: JSON.stringify([{ program: "Good", url: "https://feed.example/data.xml", category: "czesci" }]),
    FEED_ALLOWED_HOSTS: "feed.example"
  });
  assert.equal(feeds.length, 1);
  assert.equal(feeds[0].program, "Good");
});
