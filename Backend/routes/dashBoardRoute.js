const express = require("express");
const expressAsyncHandler = require("express-async-handler");
const registerstaff = require("../models/registerstaff");
const validateMongoDbId = require("../utils/validateMongodbId");
const Features = require("../models/featureModel");
const productModel = require("../models/productModel");
const User = require("../models/userModel");
const bookingModel = require("../models/bookingModel");
const locationModel = require("../models/locationModel");
const Transaction = require("../models/Transaction");

const router = express.Router();

const getData = {
  2: {
    page: "feature",
    method: async () => {
      try {
        const features = await Features.find();
        return features;
      } catch {
        return "Error occurred";
      }
    },
  },
  3: {
    page: "pods",
    method: async () => {
      try {
        const products = await productModel
          .find()
          .populate("location")
          .populate("features");
        return products;
      } catch {
        return "Error occurred";
      }
    },
  },
  4: {
    page: "vipPods",
    method: async () => {
      try {
        // fetch vip pods
        return {};
      } catch {
        return "Error occurred";
      }
    },
  },
  5: {
    page: "userDetails",
    method: async () => {
      try {
        const getUsers = await User.find();
        return getUsers;
      } catch {
        return "Error occurred";
      }
    },
  },
  6: {
    page: "bookings",
    method: async () => {
      try {
        const allBookings = await bookingModel.find();
        return allBookings;
      } catch {
        return "Error occurred";
      }
    },
  },
  7: {
    page: "location",
    method: async () => {
      try {
        const locations = await locationModel.find();
        return locations;
      } catch {
        return "Error occurred";
      }
    },
  },
  8: {
    page: "Transaction",
    method: async () => {
      try {
        const Transactions = await Transaction.find();
        return Transactions;
      } catch {
        return "Error occurred";
      }
    },
  },
};

const getDashBoardData = expressAsyncHandler(async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id);
    try {
        const staff = await registerstaff.findById(id);
        let roles = staff?.auth_page;
        const result = {};
        for (const page of roles) {
            if (getData.hasOwnProperty(page)) {
                result[getData[page]?.page] = await getData[page].method();
            }
        }

        res.json({ data: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

router.get("/:id", getDashBoardData);

module.exports = router;
