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
      res.json(features);
    } catch (error) {
     res.status(500).json({
       status: "fail",
       message: "An error occurred while fetching users.",
     });
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
      return res.status(404).json({ message: "Locatiom not found" });
    }
    res.json({ message: "location unblocked successfully" });
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
const deleteFeature = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const deleteaFeature = await Features.findByIdAndDelete(id);
    res.json({
      deleteaFeature,
    });
  } catch (error) {
    throw new Error(error);
  }
});
const deleteLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const deleteaLocation = await Features.findByIdAndDelete(id);
    res.json({
      deleteaLocation,
    });
  } catch (error) {
    throw new Error(error);
  }
});
const editFeature = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, status, isBlocked } = req.body;

  validateMongoDbId(id);

  try {
    const updatedFeature = await Features.findByIdAndUpdate(
      id,
      { name, status, isBlocked },
      { new: true, runValidators: true }
    );

    if (!updatedFeature) {
      return res.status(404).json({ message: "Feature not found" });
    }

    res.json({ message: "Feature updated successfully", updatedFeature });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const editLocation = asyncHandler(async (req, res) => {
  console.log("req.user:", req.user); // Add this line to debug
  const { id } = req.params;
  const {
    name,
    city,
    state,
    country_code,
    zip,
    latitude,
    longitude,
    isBlocked,
  } = req.body;

  validateMongoDbId(id);

  try {
    const updatedLocation = await Location.findByIdAndUpdate(
      id,
      {
        name,
        city,
        state,
        country_code,
        zip,
        latitude,
        longitude,
        isBlocked,
      },
      { new: true, runValidators: true }
    );

    if (!updatedLocation) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.json({ message: "Location updated successfully", updatedLocation });
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
  deleteFeature,
  editFeature,
  deleteLocation,
  editLocation,
};
  