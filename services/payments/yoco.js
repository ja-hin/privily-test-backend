// services/payments/yoco.js
//
// Wrapper for the two Yoco calls the backend makes, using the live key.
// The pre-existing createPayment / yocoCheckout code paths are left in
// place; this module exists so refunds can be dispatched by gateway.

const GATEWAY = "yoco";
const YOCO_BASE = "https://payments.yoco.com/api";

const secretKey = () => process.env.YOCO_SECRET_KEY_LIVE || "";
const isConfigured = () => Boolean(secretKey());

class YocoError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "YocoError";
    this.status = status || 502;
    this.data = data || null;
  }
}

const request = async (method, path, body) => {
  if (!isConfigured()) {
    throw new YocoError("Yoco is not configured on the server", 503);
  }
  const res = await fetch(`${YOCO_BASE}${path}`, {
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
  if (!res.ok) {
    const message =
      (data && (data.message || data.displayMessage)) ||
      `Yoco request failed (${res.status})`;
    throw new YocoError(message, res.status, data);
  }
  return data;
};

const createCheckout = async ({ amountInCents, successUrl, cancelUrl, failureUrl, metadata }) => {
  const data = await request("POST", "/checkouts", {
    amount: Math.round(Number(amountInCents)),
    currency: "ZAR",
    successUrl,
    cancelUrl,
    failureUrl,
    metadata,
  });
  return {
    gateway: GATEWAY,
    reference: data.id,
    checkoutId: data.id,
    merchantId: data.merchantId,
    paymentFacilitator: data.paymentFacilitator,
    authorizationUrl: data.redirectUrl,
    raw: data,
  };
};

const refund = async ({ reference }) => {
  if (!reference) throw new YocoError("checkoutId is required", 400);
  const data = await request("POST", `/checkouts/${encodeURIComponent(reference)}/refund`, {});
  return {
    gateway: GATEWAY,
    status: String(data.status || "pending").toLowerCase(),
    refundId: data.refundId || data.id || null,
    raw: data,
  };
};

module.exports = { GATEWAY, YocoError, isConfigured, createCheckout, refund };
