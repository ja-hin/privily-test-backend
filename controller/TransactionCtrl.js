const RateModel = require("../models/rateModel");
const Transaction = require("../models/Transaction");
const asyncHandler = require("express-async-handler");

const saveTransaction = async (req, res) => {
  try {
    const { amount, currency, id, metadata, status, merchantId } = req.body;
    const transactionData = {
      amount,
      currency,
      id: id,
      merchantId: merchantId,
      checkoutId: metadata.checkoutId,
      paymentFacilitator: metadata.paymentFacilitator,
      status,
    };

    // Save the transaction data to the database
    const newTransaction = new Transaction(transactionData);
    await newTransaction.save();

    res.status(201).json({ message: "Transaction saved successfully" });
  } catch (error) {
    console.error("Error saving transaction:", error);
    res.status(500).json({ message: "Failed to save transaction" });
  }
};
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find();
    res.status(200).json({
      status: 200,
      message: "API successfully fetched the data",
      data: transactions,
    });
  } catch (error) {
    console.error("Error retrieving transactions:", error);
    res.status(500).json({ message: "Failed to retrieve transactions" });
  }
};


 const createRate = asyncHandler(async (req, res) => {
   try {
     const { rate, status } = req.body;

     // Find the rate document (assuming there's only one rate document)
     let existingRate = await RateModel.findOne();

     if (existingRate) {
       // If a rate document exists, update it
       existingRate.rate = rate;
       existingRate.status = status;
       await existingRate.save();
     } else {
       // If no rate document exists, create a new one
       existingRate = await RateModel.create({ rate, status });
     }

     res.json(existingRate);
   } catch (error) {
     console.log(error.message);
     res.status(500).json({
       status: "fail",
       message: "An error occurred while creating or updating the Rate.",
     });
   }
 });

 const getRate = asyncHandler(async (req, res) => {
   try {
     // Assuming there's only one rate record in the database
     const rate = await RateModel.findOne();
     if (!rate) {
       return res.status(404).json({
         status: "fail",
         message: "Rate not found",
       });
     }
     res.json(rate);
   } catch (error) {
     console.error("Error fetching rate:", error);
     res.status(500).json({
       status: "fail",
       message: "An error occurred while fetching the rate.",
     });
   }
 });



module.exports = { saveTransaction, getAllTransactions, createRate, getRate };
