const express = require("express");
const {
  createProduct,
  getaProduct,
  getAllProducts,
  getAllProductUsingFilter,
  updateProduct,
  deleteProduct,
  rating,
  getAllProductAddress,
  getAllLocations,
} = require("../controller/productCtrl");
const { isAdmin, authMiddleware } = require("../middlew/authMIddleware");
const router = express.Router();

router.post("/create-pods", createProduct);
router.get("/", getAllProducts);
router.get("/:id", getaProduct);
router.put("/:id", authMiddleware, isAdmin, updateProduct);
router.delete("/:id", authMiddleware, isAdmin, deleteProduct);

router.get("/filter", getAllProductUsingFilter);
router.put("/rating", authMiddleware, rating);
router.get("/address", getAllProductAddress);
router.get("/locations/", getAllLocations);

module.exports = router;
