// models/paymentSettingsModel.js
//
// One document that says which payment gateways customers may use and which
// one is offered first. The admin edits it; the app and the website read it
// on load. Flipping defaultGateway here moves new checkouts between Yoco and
// Paystack without an app release.

const mongoose = require("mongoose");

const GATEWAYS = ["yoco", "paystack"];

const paymentSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    enabledGateways: {
      type: [{ type: String, enum: GATEWAYS }],
      default: ["yoco", "paystack"],
    },
    defaultGateway: { type: String, enum: GATEWAYS, default: "yoco" },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

const PaymentSettings = mongoose.model("PaymentSettings", paymentSettingsSchema);

// Always returns a document, creating the default one on first use.
PaymentSettings.getSettings = async function () {
  let doc = await this.findOne({ key: "default" });
  if (!doc) doc = await this.create({ key: "default" });
  return doc;
};

PaymentSettings.GATEWAYS = GATEWAYS;

module.exports = PaymentSettings;
