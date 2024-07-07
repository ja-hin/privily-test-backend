const Product = require("../models/productModel");
const Location = require("../models/locationModel");
const User = require("../models/userModel");
const Features =require("../models/featureModel")
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
  const getAllFeaturesDetails = asyncHandler(async (req, res) => {
    try {
      const features = await Features.find();
      res.json({ "data": features });
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
  const createFeature = asyncHandler(async (req, res) => {
    try {
      const { name, status } = req.body;

      // Create a slug for the feature (optional)
      // const slug_text = name;
      // const slug = slugify(slug_text, { lower: true });

      // Create the new feature
      const newFeature = await Features.create({ name, status });

      res.json(newFeature);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({
        status: "fail",
        message: "An error occurred while creating the feature.",
      });
    }
  });
const blockFeature = asyncHandler(async (req, res) => {
  const { id } = req.params;

  validateMongoDbId(id); // Make sure this function is correctly implemented

  try {
    const blockusr = await Features.findByIdAndUpdate(
      id,
      { isBlocked: true },
      { new: true }
    );

    if (!blockusr) {
      return res.status(404).json({ message: "Features not found" });
    }
    res.json({ message: "Features blocked successfully" });
  } catch (error) {
    console.error("Error blocking user:", error); // Log the error
    res.status(500).json({ message: error.message });
  }
});
const blockLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  validateMongoDbId(id); // Make sure this function is correctly implemented

  try {
    const blockusr = await Location.findByIdAndUpdate(
      id,
      { isBlocked: true },
      { new: true }
    );

    if (!blockusr) {
      return res.status(404).json({ message: "Location not found" });
    }
    res.json({ message: "Location blocked successfully" });
  } catch (error) {
    console.error("Error blocking user:", error); // Log the error
    res.status(500).json({ message: error.message });
  }
});
const unblockLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const unblock = await Location.findByIdAndUpdate(
      id,
      { isBlocked: false },
      { new: true }
    );
    if (!unblock) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User unblocked successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
const unblockFeature = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const unblock = await Features.findByIdAndUpdate(
      id,
      { isBlocked: false },
      { new: true }
    );
    if (!unblock) {
      return res.status(404).json({ message: "Feature not found" });
    }
    res.json({ message: "Feature unblocked successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = {
  getAllLocations,
  getAllLocationsDetails,
  createLocations,
  blockLocation,
  unblockLocation,
  createFeature,
  getAllFeaturesDetails,
  blockFeature,
  unblockFeature,
};
  