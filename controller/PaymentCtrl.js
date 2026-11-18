const axios = require("axios");
const asyncHandler = require("express-async-handler");
const Transaction = require("../models/Transaction");
const Booking = require("../models/bookingModel");
const PaymentSettings = require("../models/paymentSettingsModel");
const payments = require("../services/payments");

/* -------------------------------------------------------------------------- */
/*  Yoco — existing mobile checkout, unchanged                                 */
/* -------------------------------------------------------------------------- */

const createPayment = async (req, res) => {
  try {
    const response = await axios.post(
      "https://payments.yoco.com/api/checkouts",
      {
        amount: req.body.amount,
        currency: "ZAR",
        cancelUrl: req.body.cancelUrl,
        successUrl: req.body.successUrl,
        failureUrl: req.body.failureUrl,
        metadata: req.body.metadata,
        totalDiscount: req.body.totalDiscount,
        totalTaxAmount: req.body.totalTaxAmount,
        subtotalAmount: req.body.subtotalAmount,
        lineItems: null,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.YOCO_SECRET_KEY_LIVE}`,
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error(
      "Error details:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({
      message: "Failed to create checkout",
      error: error.response ? error.response.data : error.message,
    });
  }
};

/* -------------------------------------------------------------------------- */
/*  Gateway config — read by the app and the website on load                   */
/* -------------------------------------------------------------------------- */

const buildConfig = (settings) => {
  // A gateway is only offered if the admin enabled it AND its key is set.
  const available = settings.enabledGateways.filter((g) =>
    payments.getGateway(g).isConfigured()
  );
  const defaultGateway = available.includes(settings.defaultGateway)
    ? settings.defaultGateway
    : available[0] || null;
  return {
    currency: "ZAR",
    enabledGateways: available,
    defaultGateway,
    paystackPublicKey: available.includes("paystack") ? payments.paystack.publicKey() : null,
    gateways: available.map((g) => ({ id: g, label: payments.gatewayLabel(g) })),
  };
};

// GET /api/payments/config  (public)
const getPaymentConfig = asyncHandler(async (req, res) => {
  const settings = await PaymentSettings.getSettings();
  res.json(buildConfig(settings));
});

// GET /api/admin/payment-settings
const getPaymentSettings = asyncHandler(async (req, res) => {
  const settings = await PaymentSettings.getSettings();
  res.json({
    settings: {
      enabledGateways: settings.enabledGateways,
      defaultGateway: settings.defaultGateway,
      updatedAt: settings.updatedAt,
      updatedBy: settings.updatedBy,
    },
    configured: Object.fromEntries(
      payments.GATEWAY_NAMES.map((g) => [g, payments.getGateway(g).isConfigured()])
    ),
    effective: buildConfig(settings),
  });
});

// PUT /api/admin/payment-settings  { enabledGateways: [...], defaultGateway }
const updatePaymentSettings = asyncHandler(async (req, res) => {
  const { enabledGateways, defaultGateway } = req.body;
  const settings = await PaymentSettings.getSettings();

  if (enabledGateways !== undefined) {
    if (!Array.isArray(enabledGateways) || enabledGateways.length === 0) {
      return res.status(400).json({ message: "enabledGateways must be a non-empty array" });
    }
    const cleaned = enabledGateways.map(payments.normalizeGatewayName);
    if (cleaned.some((g) => !g)) {
      return res.status(400).json({ message: `Gateways must be one of: ${payments.GATEWAY_NAMES.join(", ")}` });
    }
    settings.enabledGateways = [...new Set(cleaned)];
  }
  if (defaultGateway !== undefined) {
    const g = payments.normalizeGatewayName(defaultGateway);
    if (!g) return res.status(400).json({ message: "Invalid defaultGateway" });
    settings.defaultGateway = g;
  }
  if (!settings.enabledGateways.includes(settings.defaultGateway)) {
    return res.status(400).json({ message: "defaultGateway must be one of the enabled gateways" });
  }
  settings.updatedBy = req.user ? req.user.email : null;
  await settings.save();

  res.json({
    message: "Payment settings updated",
    settings: {
      enabledGateways: settings.enabledGateways,
      defaultGateway: settings.defaultGateway,
    },
    effective: buildConfig(settings),
  });
});

/* -------------------------------------------------------------------------- */
/*  Paystack                                                                   */
/* -------------------------------------------------------------------------- */

const sendGatewayError = (res, error, fallback) => {
  const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
  console.error(`${fallback}:`, error.data || error.message);
  res.status(status).json({ message: error.message || fallback, error: error.data || null });
};

// POST /api/user/paystack-checkout   (also /api/payments/paystack/initialize)
// body: { amountInCents | amount, email, callbackUrl, metadata }
//
// Response mirrors the Yoco shape the app already reads (redirectUrl, id)
// and adds the Paystack-specific fields.
const paystackInitialize = asyncHandler(async (req, res) => {
  const settings = await PaymentSettings.getSettings();
  const config = buildConfig(settings);
  if (!config.enabledGateways.includes("paystack")) {
    return res.status(503).json({ message: "Paystack is currently disabled" });
  }

  const amountInCents = Number(req.body.amountInCents ?? req.body.amount);
  const email = (req.user && req.user.email) || req.body.email;
  const { callbackUrl, metadata } = req.body;

  if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
    return res.status(400).json({ message: "amountInCents must be a positive number" });
  }
  if (!email) {
    return res.status(400).json({ message: "email is required for Paystack checkout" });
  }

  const reference = payments.paystack.generateReference();
  try {
    const init = await payments.paystack.initialize({
      amountInCents,
      email,
      reference,
      callbackUrl,
      metadata: { ...(metadata || {}), source: req.body.source || "app" },
    });

    // Record the attempt now so the webhook and verify have a row to update.
    const txn = await Transaction.create({
      amount: Math.round(amountInCents),
      currency: "ZAR",
      gateway: "paystack",
      reference: init.reference,
      checkoutId: init.reference,
      merchantId: "paystack",
      paymentFacilitator: "paystack",
      status: "pending",
      user: req.user ? req.user._id : null,
      customerEmail: email,
      metadata: metadata || null,
    });

    res.status(200).json({
      gateway: "paystack",
      id: init.reference,
      reference: init.reference,
      accessCode: init.accessCode,
      redirectUrl: init.authorizationUrl,
      authorizationUrl: init.authorizationUrl,
      transactionId: txn._id,
      amountInCents: txn.amount,
      currency: "ZAR",
    });
  } catch (error) {
    sendGatewayError(res, error, "Failed to create Paystack checkout");
  }
});

// Re-checks a reference with Paystack and brings our Transaction row in line.
// Shared by the verify endpoint, the webhook, and createBooking.
const syncPaystackTransaction = async (reference) => {
  const result = await payments.paystack.verify(reference);
  const update = {
    status: result.status,
    rawStatus: result.rawStatus,
    channel: result.channel,
    customerEmail: result.customerEmail,
    paidAt: result.paidAt ? new Date(result.paidAt) : null,
  };
  let txn = await Transaction.findOneAndUpdate(
    { gateway: "paystack", reference },
    { $set: update },
    { new: true }
  );
  if (!txn) {
    // Initialized outside this server (or row lost): still record it.
    txn = await Transaction.create({
      amount: result.amountInCents,
      currency: result.currency || "ZAR",
      gateway: "paystack",
      reference,
      checkoutId: reference,
      merchantId: "paystack",
      paymentFacilitator: "paystack",
      ...update,
    });
  }
  return { result, txn };
};

// GET /api/user/paystack-verify/:reference   (also /api/payments/paystack/verify/:reference)
const paystackVerify = asyncHandler(async (req, res) => {
  const { reference } = req.params;
  try {
    const { result, txn } = await syncPaystackTransaction(reference);
    res.json({
      gateway: "paystack",
      reference,
      status: result.status,
      rawStatus: result.rawStatus,
      paid: result.status === "successful",
      amountInCents: result.amountInCents,
      currency: result.currency,
      paidAt: result.paidAt,
      channel: result.channel,
      transactionId: txn._id,
      bookingId: txn.booking,
    });
  } catch (error) {
    sendGatewayError(res, error, "Failed to verify Paystack payment");
  }
});

// POST /api/payments/paystack/webhook
// Mounted with express.raw() so req.body is a Buffer of the exact bytes.
const paystackWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

  if (!payments.paystack.verifyWebhookSignature(rawBody, signature)) {
    console.warn("Paystack webhook: bad signature");
    return res.status(401).json({ message: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch (_) {
    return res.status(400).json({ message: "Invalid JSON" });
  }

  // Acknowledge first; Paystack retries anything that is not a 200.
  res.status(200).json({ received: true });

  try {
    const data = event.data || {};
    switch (event.event) {
      case "charge.success": {
        await Transaction.findOneAndUpdate(
          { gateway: "paystack", reference: data.reference },
          {
            $set: {
              status: "successful",
              rawStatus: data.status || "success",
              channel: data.channel || null,
              customerEmail: data.customer ? data.customer.email : null,
              paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
            },
            $setOnInsert: {
              amount: Number(data.amount),
              currency: data.currency || "ZAR",
              gateway: "paystack",
              reference: data.reference,
              checkoutId: data.reference,
              merchantId: "paystack",
              paymentFacilitator: "paystack",
            },
          },
          { upsert: true }
        );
        break;
      }
      case "charge.failed": {
        await Transaction.findOneAndUpdate(
          { gateway: "paystack", reference: data.reference, status: { $ne: "successful" } },
          { $set: { status: "failed", rawStatus: data.status || "failed" } }
        );
        break;
      }
      case "refund.processed": {
        const reference = data.transaction_reference || data.transaction?.reference;
        const txn = await Transaction.findOneAndUpdate(
          { gateway: "paystack", reference },
          { $set: { status: "refunded", refundedAt: new Date(), refundId: String(data.id || "") } },
          { new: true }
        );
        if (txn && txn.booking) {
          await Booking.findByIdAndUpdate(txn.booking, { status: "Cancelled", isBookingActive: false });
        }
        break;
      }
      default:
        // Other events (transfer.*, subscription.*) are not used here.
        break;
    }
  } catch (error) {
    console.error("Paystack webhook handling failed:", event && event.event, error);
  }
});

module.exports = {
  createPayment,
  getPaymentConfig,
  getPaymentSettings,
  updatePaymentSettings,
  paystackInitialize,
  paystackVerify,
  paystackWebhook,
  syncPaystackTransaction,
};
