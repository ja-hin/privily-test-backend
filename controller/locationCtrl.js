const Product = require("../models/productModel");
const Location = require("../models/locationModel");
const User = require("../models/userModel");
const asyncHandler = require("express-async-handler");
const slugify = require("slugify");
const validateMongoDbId = require("../utils/validateMongodbId");

const getAllLocations = asyncHandler(async (req, res) => {
    try {
        var locations = null;
        Location.aggregate([
            {
              $group: {
                _id: '$zip',
                city: { $first: '$city' }
              }
            },
            {
              $group: {
                _id: null,
                cities: { $addToSet: '$city' }
              }
            }
          ])
          .then(result => {
            res.json({"locations": result[0].cities});
          })
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server Error" });
    }
  });

const getAllLocationsDetails = asyncHandler(async (req, res) => {
    try {
      const locations = await Location.find();
      res.json({"data": locations});
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server Error" });
    }
  });

const createLocations = asyncHandler(async (req, res) => {
    try {
        slug_text = req.body.name + req.body.latitude.toString() + req.body.longitude.toString()
        req.body.slug = slugify(slug_text, { lower: true });
        console.log(req.body.slug);
        const newLocation = await Location.create(req.body);
        res.json(newLocation);
      } catch (error) {
        console.log(error.message)
        // console.error(error); // Log the error for debugging purposes
        res.status(500).json({
          status: "fail",
          message: "An error occurred while creating the product.",
        });
      }
  });

module.exports = {
    getAllLocations,
    getAllLocationsDetails,
    createLocations,
  };
  