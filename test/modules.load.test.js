// Smoke test: every touched module must load and the mongoose schemas must
// compile. No DB connection is opened.
const test = require("node:test");
const assert = require("node:assert/strict");
process.env.JWT_SECRET = process.env.JWT_SECRET || "x";
process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "y";

test("models compile with the new payment fields", () => {
  const Transaction = require("../models/Transaction");
  const Booking = require("../models/bookingModel");
  const PaymentSettings = require("../models/paymentSettingsModel");
  assert.ok(Transaction.schema.path("gateway"));
  assert.ok(Transaction.schema.path("reference"));
  assert.ok(Transaction.schema.path("booking"));
  assert.ok(Booking.schema.path("paymentGateway"));
  assert.ok(Booking.schema.path("paymentReference"));
  assert.ok(Booking.schema.path("transaction"));
  assert.deepEqual(PaymentSettings.GATEWAYS, ["yoco", "paystack"]);
  // A Yoco-only legacy row still validates (nothing new became required).
  const legacy = new Transaction({ amount: 100, currency: "ZAR", merchantId: "m", checkoutId: "c", paymentFacilitator: "yoco-online-checkout", status: "successful" });
  assert.equal(legacy.validateSync(), undefined);
  assert.equal(legacy.gateway, "yoco");
  // A Paystack row without Yoco fields also validates.
  const ps = new Transaction({ amount: 100, gateway: "paystack", reference: "PRV-1", status: "pending" });
  assert.equal(ps.validateSync(), undefined);
});

test("gateway registry resolves names and labels", () => {
  const payments = require("../services/payments");
  assert.equal(payments.normalizeGatewayName(" Paystack "), "paystack");
  assert.equal(payments.normalizeGatewayName("stripe"), null);
  assert.equal(payments.gatewayLabel("paystack"), "Paystack");
  assert.equal(payments.gatewayLabel("yoco"), "Yoco online checkout");
  assert.throws(() => payments.getGateway("stripe"), /Unknown payment gateway/);
});

test("controllers and routes load", () => {
  const ctrl = require("../controller/PaymentCtrl");
  for (const fn of ["createPayment","getPaymentConfig","getPaymentSettings","updatePaymentSettings","paystackInitialize","paystackVerify","paystackWebhook","syncPaystackTransaction"]) {
    assert.equal(typeof ctrl[fn], "function", fn);
  }
  const userCtrl = require("../controller/userCtrl");
  assert.equal(typeof userCtrl.refundBooking, "function");
  assert.equal(typeof userCtrl.createBooking, "function");
  require("../routes/PaymentRoute");
  require("../routes/adminRoute");
  require("../routes/authRoute");
});
