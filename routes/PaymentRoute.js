const express = require("express");
const {
  createPayment,
  getPaymentConfig,
  paystackInitialize,
  paystackVerify,
} = require("../controller/PaymentCtrl");

const router = express.Router();

// Yoco (mobile app, existing)
router.post("/", createPayment);

// Which gateways are on, and which is the default. Public, read on app load.
router.get("/config", getPaymentConfig);

// Paystack. The webhook is mounted directly in index.js because it needs
// the raw request body for signature checking.
router.post("/paystack/initialize", paystackInitialize);
router.get("/paystack/verify/:reference", paystackVerify);

module.exports = router;
