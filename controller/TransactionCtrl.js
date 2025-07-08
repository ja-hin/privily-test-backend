const discountModel = require("../models/discountModel");
const RateModel = require("../models/rateModel");
const Booking = require("../models/bookingModel");
const Transaction = require("../models/Transaction");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const productModel = require("../models/productModel");

const saveTransaction = async (req, res) => {
  try {
    const { amount, currency, id, checkoutId,paymentFacilitator, status, merchantId } = req.body;
    const transactionData = {
      amount,
      currency,
      id: id,
      merchantId: merchantId,
      checkoutId: checkoutId,
      paymentFacilitator: paymentFacilitator,
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
// const getAllTransactions = async (req, res) => {
//   try {
//     const transactions = await Transaction.find();
//     res.status(200).json({
//       status: 200,
//       message: "API successfully fetched the data",
//       data: transactions,
//     });
//   } catch (error) {
//     console.error("Error retrieving transactions:", error);
//     res.status(500).json({ message: "Failed to retrieve transactions" });
//   }
// };
// const getAllTransactions = async (req, res) => {
//   try {
//     // Fetch all transactions
//     const transactions = await Transaction.find();

//     // Create an array to hold the enhanced transaction data
//     const enhancedTransactions = [];

//     // Loop through each transaction and find the matching booking
//     for (const transaction of transactions) {
//       const booking = await Booking.findOne({
//         createdAt: { $gte: new Date(transaction.createdAt) },
//       });
// console.log("booking",booking)
//       if (booking) {
//         const enhancedTransaction = {
//           ...transaction.toObject(), // Convert mongoose object to plain JS object
//           podName: booking.podTitle, // Add podTitle from Booking model
//           location: booking.location, // Add location from Booking model
//           username: booking.user, // Add userName from Booking model
//         };
//         enhancedTransactions.push(enhancedTransaction);
//       } else {
//         enhancedTransactions.push(transaction);
//       }
//     }

//     res.status(200).json({
//       status: 200,
//       message: "API successfully fetched the data",
//       data: enhancedTransactions,
//     });
//   } catch (error) {
//     console.error("Error retrieving transactions:", error);
//     res.status(500).json({ message: "Failed to retrieve transactions" });
//   }
// };


const getAllTransactions = asyncHandler(async (req, res) => {
  try {
    // Fetch all transactions
    const transactions = await Transaction.find();

    const enhancedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        // Fetch the booking related to the transaction
        const booking = await Booking.findOne({
          createdAt: { $gte: new Date(transaction.createdAt) }, // Optional: you can adjust this based on your matching logic
        });

        if (!booking) {
          return transaction; // If no booking found, return the transaction as-is
        }

        // Get the user details from the booking
        const user = await User.findById(booking.user);
        const username = user
          ? `${user.firstname} ${user.lastname}`
          : "Unknown";

        // Get the pod details from the booking
        const pod = await productModel.findById(booking.podId);
        let locationName = "Unknown";
        let locationDetails = null;

        if (pod && pod.location) {
          // Fetch the location details if the pod has a location ID
          const Location = require("../models/locationModel"); // Adjust path as needed
          locationDetails = await Location.findById(pod.location);
          locationName = locationDetails?.name || "Unknown";
        }

        // Enhance the transaction with additional data
        return {
          ...transaction.toObject(),
          podTitle: booking.podTitle,
          username, // Add username from the related user
          locationName, // Add location name from the related location
          locationDetails, // Add full location details if required
        };
      })
    );

    res.status(200).json({
      status: 200,
      message: "API successfully fetched the data",
      data: enhancedTransactions,
    });
  } catch (error) {
    console.error("Error retrieving transactions:", error);
    res.status(500).json({ message: "Failed to retrieve transactions" });
  }
});


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

 const createDiscount = asyncHandler(async (req, res) => {
   try {
     const { discount } = req.body;

     // Find the rate document (assuming there's only one rate document)
     let existingDiscount = await discountModel.findOne();

     if (existingDiscount) {
       // If a rate document exists, update it
       existingDiscount.discount = discount;
       await existingDiscount.save();
     } else {
       // If no rate document exists, create a new one
       existingDiscount = await discountModel.create({ discount });
     }

     res.json(existingDiscount);
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
const getDiscount = asyncHandler(async (req, res) => {
  try {
    // Assuming there's only one rate record in the database
    const discount = await discountModel.findOne();
    if (!discount) {
      return res.status(404).json({
        status: "fail",
        message: "Rate not found",
      });
    }
    res.json(discount);
  } catch (error) {
    console.error("Error fetching rate:", error);
    res.status(500).json({
      status: "fail",
      message: "An error occurred while fetching the rate.",
    });
  }
});


module.exports = {
  saveTransaction,
  getAllTransactions,
  createRate,
  getRate,
  createDiscount,
  getDiscount,
};
