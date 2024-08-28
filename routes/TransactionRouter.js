const express = require("express");
const { saveTransaction, getAllTransactions, createRate, getRate } = require("../controller/TransactionCtrl");

const router = express.Router();

router.post("/", saveTransaction);
router.get("/getalltransactions", getAllTransactions);
router.post("/ManageRates", createRate);
router.get("/getrate", getRate);
// router.get("/getrates", createRate);


module.exports = router;
 