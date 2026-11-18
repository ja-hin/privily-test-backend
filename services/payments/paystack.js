// services/payments/paystack.js
//
// Thin wrapper around the Paystack REST API. Everything the rest of the
// backend needs from Paystack goes through here so the controllers never
// touch Paystack URLs or headers directly.
//
// Amounts are always in the smallest currency unit (cents for ZAR), which
// matches how the app and the Yoco code already pass amounts around.

const crypto = require("crypto");

const PAYSTACK_BASE = "https://api.paystack.co";
const GATEWAY = "paystack";

const secretKey = () => process.env.PAYSTACK_SECRET_KEY || "";
const publicKey = () => process.env.PAYSTACK_PUBLIC_KEY || "";
const isConfigured = () => Boolean(secretKey());

class PaystackError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "PaystackError";
    this.status = status || 502;
    this.data = data || null;
  }
}

const request = async (method, path, body) => {
  if (!isConfigured()) {
    throw new PaystackError("Paystack is not configured on the server", 503);
  }
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  if (!res.ok || !data || data.status === false) {
    const message = (data && data.message) || `Paystack request failed (${res.status})`;
    throw new PaystackError(message, res.status, data);
  }
  return data.data;
};

// Our own reference, so we can look the payment up before Paystack ever
// answers and so a webhook can be matched to a Transaction row.
const generateReference = () =>
  `PRV-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

/**
 * Create a hosted checkout. Returns the URL the customer must be sent to.
 * @param {Object} p
 * @param {number} p.amountInCents
 * @param {string} p.email           Paystack requires a customer email.
 * @param {string} [p.reference]     Defaults to a generated PRV-… reference.
 * @param {string} [p.callbackUrl]   Where Paystack redirects after payment.
 * @param {Object} [p.metadata]
 * @param {string} [p.currency]      Defaults to ZAR.
 */
const initialize = async ({
  amountInCents,
  email,
  reference,
  callbackUrl,
  metadata,
  currency = "ZAR",
}) => {
  const amount = Math.round(Number(amountInCents));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PaystackError("amountInCents must be a positive number", 400);
  }
  if (!email) {
    throw new PaystackError("email is required for a Paystack checkout", 400);
  }
  const ref = reference || generateReference();
  const data = await request("POST", "/transaction/initialize", {
    amount,
    email,
    currency,
    reference: ref,
    callback_url: callbackUrl || undefined,
    metadata: metadata || undefined,
  });
  return {
    gateway: GATEWAY,
    reference: data.reference || ref,
    accessCode: data.access_code,
    authorizationUrl: data.authorization_url,
  };
};

// Paystack's own status strings, mapped onto the single vocabulary the
// Transaction model uses ("successful", "failed", "pending", "refunded").
const normalizeStatus = (paystackStatus) => {
  switch (String(paystackStatus || "").toLowerCase()) {
    case "success":
      return "successful";
    case "failed":
    case "abandoned":
    case "reversed":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      return "pending";
  }
};

/**
 * Ask Paystack what happened to a reference. This is the source of truth
 * for whether a booking may be created; never trust the redirect alone.
 */
const verify = async (reference) => {
  if (!reference) throw new PaystackError("reference is required", 400);
  const data = await request(
    "GET",
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
  return {
    gateway: GATEWAY,
    reference: data.reference,
    status: normalizeStatus(data.status),
    rawStatus: data.status,
    amountInCents: Number(data.amount),
    currency: data.currency,
    paidAt: data.paid_at || data.paidAt || null,
    channel: data.channel || null,
    customerEmail: data.customer ? data.customer.email : null,
    transactionId: data.id,
    raw: data,
  };
};

/**
 * Refund a successful charge. Omit amountInCents for a full refund.
 */
const refund = async ({ reference, amountInCents }) => {
  if (!reference) throw new PaystackError("reference is required", 400);
  const body = { transaction: reference };
  if (amountInCents) body.amount = Math.round(Number(amountInCents));
  const data = await request("POST", "/refund", body);
  return {
    gateway: GATEWAY,
    status: String(data.status || "pending").toLowerCase(),
    refundId: data.id,
    amountInCents: Number(data.amount),
    raw: data,
  };
};

/**
 * Webhook payloads are signed with HMAC-SHA512 of the raw body using the
 * secret key. `rawBody` must be the exact bytes Paystack sent.
 */
const verifyWebhookSignature = (rawBody, signatureHeader) => {
  if (!signatureHeader || !isConfigured()) return false;
  const expected = crypto
    .createHmac("sha512", secretKey())
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = {
  GATEWAY,
  PaystackError,
  isConfigured,
  publicKey,
  generateReference,
  initialize,
  verify,
  refund,
  normalizeStatus,
  verifyWebhookSignature,
};
