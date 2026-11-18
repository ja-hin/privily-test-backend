// Run with:  node --test test/
// Exercises the Paystack wrapper against a fake fetch; no network, no DB.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.PAYSTACK_SECRET_KEY = "sk_test_unit";
process.env.PAYSTACK_PUBLIC_KEY = "pk_test_unit";
const paystack = require("../services/payments/paystack");

const withFetch = async (impl, fn) => {
  const original = global.fetch;
  global.fetch = impl;
  try { return await fn(); } finally { global.fetch = original; }
};
const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

test("initialize posts amount, email, currency and callback, returns auth url", async () => {
  let captured;
  const out = await withFetch(async (url, opts) => {
    captured = { url, opts };
    return jsonResponse({ status: true, data: { authorization_url: "https://checkout.paystack.com/abc", access_code: "abc", reference: "PRV-1" } });
  }, () => paystack.initialize({ amountInCents: 12345, email: "a@b.co", reference: "PRV-1", callbackUrl: "https://x/y" }));
  assert.equal(captured.url, "https://api.paystack.co/transaction/initialize");
  assert.equal(captured.opts.headers.Authorization, "Bearer sk_test_unit");
  const body = JSON.parse(captured.opts.body);
  assert.deepEqual(body, { amount: 12345, email: "a@b.co", currency: "ZAR", reference: "PRV-1", callback_url: "https://x/y" });
  assert.equal(out.authorizationUrl, "https://checkout.paystack.com/abc");
  assert.equal(out.reference, "PRV-1");
  assert.equal(out.gateway, "paystack");
});

test("initialize rejects bad input before calling Paystack", async () => {
  await assert.rejects(() => paystack.initialize({ amountInCents: 0, email: "a@b.co" }), /positive/);
  await assert.rejects(() => paystack.initialize({ amountInCents: 100 }), /email/);
});

test("verify maps Paystack status onto our vocabulary", async () => {
  const mk = (status) => () => withFetch(
    async () => jsonResponse({ status: true, data: { reference: "R", status, amount: 500, currency: "ZAR", paid_at: "2026-11-18T10:00:00Z", channel: "card", customer: { email: "c@d.co" }, id: 9 } }),
    () => paystack.verify("R")
  );
  assert.equal((await mk("success")()).status, "successful");
  assert.equal((await mk("abandoned")()).status, "failed");
  assert.equal((await mk("failed")()).status, "failed");
  assert.equal((await mk("ongoing")()).status, "pending");
  const v = await mk("success")();
  assert.equal(v.amountInCents, 500);
  assert.equal(v.customerEmail, "c@d.co");
});

test("API errors surface message and status", async () => {
  await assert.rejects(
    () => withFetch(async () => jsonResponse({ status: false, message: "Transaction reference not found" }, 404), () => paystack.verify("nope")),
    (e) => e.name === "PaystackError" && e.status === 404 && /not found/.test(e.message)
  );
});

test("refund posts the reference, optional partial amount", async () => {
  let body;
  await withFetch(async (url, opts) => { body = JSON.parse(opts.body); return jsonResponse({ status: true, data: { id: 1, status: "pending", amount: 500 } }); },
    () => paystack.refund({ reference: "R" }));
  assert.deepEqual(body, { transaction: "R" });
  await withFetch(async (url, opts) => { body = JSON.parse(opts.body); return jsonResponse({ status: true, data: { id: 1, status: "pending", amount: 200 } }); },
    () => paystack.refund({ reference: "R", amountInCents: 200 }));
  assert.deepEqual(body, { transaction: "R", amount: 200 });
});

test("webhook signature check accepts a correct HMAC and rejects a wrong one", () => {
  const raw = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "R" } }));
  const good = crypto.createHmac("sha512", "sk_test_unit").update(raw).digest("hex");
  assert.equal(paystack.verifyWebhookSignature(raw, good), true);
  assert.equal(paystack.verifyWebhookSignature(raw, good.replace(/^./, "0")), false);
  assert.equal(paystack.verifyWebhookSignature(raw, undefined), false);
});

test("generated references are unique and prefixed", () => {
  const a = paystack.generateReference(), b = paystack.generateReference();
  assert.match(a, /^PRV-\d+-[0-9A-F]{8}$/);
  assert.notEqual(a, b);
});
