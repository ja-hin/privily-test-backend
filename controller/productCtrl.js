const Product = require("../models/productModel");
const Location = require("../models/locationModel");
const ProductAvailability = require("../models/productAvailability");
const User = require("../models/userModel");
const asyncHandler = require("express-async-handler");
const slugify = require("slugify");
const validateMongoDbId = require("../utils/validateMongodbId");


// create a pod with details
const createProduct = asyncHandler(async (req, res) => {
  try {
    location_obj = await Location.findOne({_id: req.body.location})
    req.body.location = location_obj._id
    if (req.body.title) {
      req.body.slug = slugify(req.body.title+"_"+location_obj.slug);
    }
    const newProduct = await Product.create(req.body);
    res.json(newProduct);
  } catch (error) {
    console.error(error); // Log the error for debugging purposes
    res.status(500).json({
      status: "fail",
      message: "An error occurred while creating the product.",
    });
  }
});

// update a pod details
const updateProduct = asyncHandler(async (req, res) => {
  const id = req.params.id; // Accessing the id from params correctly
  validateMongoDbId(id);
  try {
    if (req.body.title) {
      req.body.slug = slugify(req.body.title);
    }
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id },
      req.body,
      {
        new: true,
        runValidators: true, // Ensure validators are run on update
      }
    );
    if (!updatedProduct) {
      return res
        .status(404)
        .json({ status: "fail", message: "Product not found" });
    }
    res.json(updatedProduct);
  } catch (error) {
    console.error(error); // Log the error for debugging purposes
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

// delete a product
const deleteProduct = asyncHandler(async (req, res) => {
  const id = req.params.id; // Accessing the id from params correctly
  console.log(id);
  validateMongoDbId(id);
  try {
    const deleteProduct = await Product.findOneAndDelete({ _id: id }); // Correct usage of findOneAndDelete
    if (!deleteProduct) {
      return res
        .status(404)
        .json({ status: "fail", message: "Product not found" });
    }
    res.json(deleteProduct);
  } catch (error) {
    console.error(error); // Log the error for debugging purposes
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

// get a pod details
const getaProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const findProduct = await Product.findById(id).populate({ path: 'location' });;
    res.json(findProduct);
  } catch (error) {
    throw new Error(error);
  }
});

// get all pod details
const getAllProducts = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find().populate({ path: 'location' });;
    res.json(products);
  } catch (error) {
    throw new Error(error);
  }
});

// var geocoder = require('local-reverse-geocoder');

const getLocationsFromCity = async (city_name)=> {
  const locations = Location.find({ city:  { $regex: new RegExp(city_name, 'i') } }).exec()
  // .then(locations => {
  //   console.log("success")
  //   const ids = locations.map(location => location._id);
  // })
  // .catch(err => {
  //   console.error('Error finding locations:', err);
  //   throw new Error("Some Internal Server Error Occurred.")
  // })
  return locations;
}
// console.log("arrived")
// var point = { latitude: 42.083333, longitude: 3.1 };
// geocoder.lookUp(point, function (err, res) {
//   console.log(JSON.stringify(res, null, 2));
// });
// return "ok"
// get all pod details using filter
const getAllProductUsingFilter = asyncHandler(async (req, res) => {
  try {
    // Filtering
    const queryObj = { ...req.query };
    if (req?.query?.city){
      const locations = await getLocationsFromCity(req.query.city);
      queryObj['location'] = { $in: locations.map(location => location._id)};
    }
    delete queryObj['city']
    const excludeFields = ["page", "sort", "limit", "fields"];
    excludeFields.forEach((el) => delete queryObj[el]);
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
    let query = Product.find(JSON.parse(queryStr)).populate({ path: 'location' });
    
    // Sorting
    if (req.query.sort) {
      const sortCriteria = req.query.sort.split(",").map((field) => {
        if (field === "rating") return { totalrating: -1 };
        // if (field === "pricePerSlot") return { pricePerSlot: 1 };
        if (field === "pricePerSlot") return { pricePerSlot: 1000000 };
        if (field === "category") return { category: 1 };
        if (field === "size") return { size: 1 };
      });
      query = query.sort(sortCriteria);
    } else {
      query = query.sort("-createdAt");
    }

    // Limiting the fields
    if (req.query.fields) {
      const fields = req.query.fields.split(",").join(" ");
      query = query.select(fields);
    } else {
      query = query.select("-__v");
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    query = query.skip(skip).limit(limit);
    if (req.query.page) {
      const productCount = await Product.countDocuments();
      if (skip >= productCount) throw new Error("This Page does not exist");
    }
    const products = await query;
    res.json(products);
  } catch (error) {
    throw new Error(error);
  }
});

// pods rating and comments by user
const rating = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { star, prodId, comment } = req.body;
  try {
    const product = await Product.findById(prodId);
    let alreadyRated = product.ratings.find(
      (userId) => userId.postedby.toString() === _id.toString()
    );
    if (alreadyRated) {
      const updateRating = await Product.updateOne(
        {
          ratings: { $elemMatch: alreadyRated },
        },
        {
          $set: { "ratings.$.star": star, "ratings.$.comment": comment },
        },
        {
          new: true,
        }
      );
    } else {
      const rateProduct = await Product.findByIdAndUpdate(
        prodId,
        {
          $push: {
            ratings: {
              star: star,
              comment: comment,
              postedby: _id,
            },
          },
        },
        {
          new: true,
        }
      );
    }

    const getallratings = await Product.findById(prodId);
    let totalRating = getallratings.ratings.length;
    let ratingsum = getallratings.ratings
      .map((item) => item.star)
      .reduce((prev, curr) => prev + curr, 0);
    let actualRating = Math.round(ratingsum / totalRating);
    let finalproduct = await Product.findByIdAndUpdate(
      prodId,
      {
        totalrating: actualRating,
      },
      { new: true }
    );
    res.json(finalproduct);
  } catch (error) {
    throw new Error(error);
  }
});

// get all pod products address details in an array
const getAllProductAddress = asyncHandler(async (req, res) => {
  try {
    // Fetch all products
    console.log("products");
    const products = await Product.find();
    const addresses = [];
    products.forEach((product) => {
      addresses.push(product.address);
    });
    res.json(addresses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

const productAvailability = asyncHandler(async (req, res) => {
  try {
    start_time = '6:00' // 6 am
    end_time = '24:00' // till EOD
    if (!req?.query?.booking_date){
      res.status(500).json({ message: "Please provide a Booking Date" });
    }
    targetDate = new Date(req.query.booking_date);
    // Fetch a product availability
    const id = req.params.id;
    const product_availability = await ProductAvailability.findOne({product_id: id, createdAt: {
      $gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
      $lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1)
  }})
    if (!product_availability){
      res.status(500).json({ message: "Please provide a Booking Date" });
    }
    
    res.json({product_availability, 'start_time': start_time, 'end_time': end_time});
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});


module.exports = {
  createProduct,
  getaProduct,
  getAllProducts,
  getAllProductUsingFilter,
  updateProduct,
  deleteProduct,
  rating,
  getAllProductAddress,
  productAvailability
};
