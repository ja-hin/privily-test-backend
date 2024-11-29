const express = require("express");
const { saveTransaction, getAllTransactions, createRate, getRate, createDiscount, getDiscount } = require("../controller/TransactionCtrl");

const router = express.Router();

router.post("/", saveTransaction);
router.get("/getalltransactions", getAllTransactions);
router.post("/ManageRates", createRate);
router.post("/ManageDiscount", createDiscount);
router.get("/getrate", getRate);
router.get("/getdiscount", getDiscount);
// router.get("/getrates", createRate);


module.exports = router;
 