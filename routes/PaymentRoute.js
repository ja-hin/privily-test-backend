const express = require("express");
const { createPayment } = require("../controller/PaymentCtrl");

const router = express.Router();

router.post("/", createPayment);

module.exports = router;
