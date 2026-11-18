// services/payments/index.js
//
// Gateway registry. Code elsewhere asks for a gateway by name and gets the
// same small interface back, so adding a third provider later means adding
// one file here and nothing in the controllers.

const paystack = require("./paystack");
const yoco = require("./yoco");

const GATEWAYS = { yoco, paystack };
const GATEWAY_NAMES = Object.keys(GATEWAYS);

const normalizeGatewayName = (name) => {
  const n = String(name || "").trim().toLowerCase();
  return GATEWAY_NAMES.includes(n) ? n : null;
};

const getGateway = (name) => {
  const n = normalizeGatewayName(name);
  if (!n) {
    const err = new Error(`Unknown payment gateway: ${name}`);
    err.status = 400;
    throw err;
  }
  return GATEWAYS[n];
};

// Human-readable label used on invoices and in emails.
const gatewayLabel = (name) =>
  ({ yoco: "Yoco online checkout", paystack: "Paystack" }[normalizeGatewayName(name)] ||
  "Online payment");

module.exports = {
  GATEWAY_NAMES,
  normalizeGatewayName,
  getGateway,
  gatewayLabel,
  paystack,
  yoco,
};
