const mongoose = require("mongoose");

// One row per payment attempt, across every gateway.
//
// `reference` is the gateway's primary identifier for the payment: the
// checkout ID for Yoco, the transaction reference for Paystack. The older
// Yoco-only fields (merchantId, checkoutId, paymentFacilitator) are kept so
// existing rows and the admin's current columns keep working.
const transactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
    default: "ZAR",
  },
  gateway: {
    type: String,
    enum: ["yoco", "paystack"],
    default: "yoco",
    index: true,
  },
  reference: {
    type: String,
    default: null,
    index: true,
  },
  merchantId: {
    type: String,
    default: "N/A",
  },
  checkoutId: {
    type: String,
    default: null,
  },
  paymentFacilitator: {
    type: String,
    default: "yoco-online-checkout",
  },
  // "pending" | "successful" | "failed" | "refunded"
  status: {
    type: String,
    required: true,
  },
  rawStatus: {
    type: String,
    default: null,
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    default: null,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  customerEmail: {
    type: String,
    default: null,
  },
  channel: {
    type: String,
    default: null,
  },
  paidAt: {
    type: Date,
    default: null,
  },
  refundedAt: {
    type: Date,
    default: null,
  },
  refundId: {
    type: String,
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Transaction", transactionSchema);
