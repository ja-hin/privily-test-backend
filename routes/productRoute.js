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
  productAvailability,
  blockPods,
  unblockpods,
  deletePods,
  editPods,
} = require("../controller/productCtrl");
const { isAdmin, authMiddleware } = require("../middlew/authMIddleware");
const { unblockLocation } = require("../controller/locationCtrl");
const router = express.Router();

router.get("/availability/:id", productAvailability);
router.post("/create-pods", createProduct);
router.get("/", getAllProducts);
router.get("/getall", authMiddleware, isAdmin, getAllProducts);
router.get("/filter", getAllProductUsingFilter);
router.put("/rating", authMiddleware, rating);
router.get("/address", getAllProductAddress);
router.get("/:id", getaProduct);
router.put("/:id", authMiddleware, isAdmin, updateProduct);
router.delete("/:id", authMiddleware, isAdmin, deleteProduct);
router.put("/block-pods/:id", authMiddleware, isAdmin, blockPods);
router.put("/unblock-pods/:id", authMiddleware, isAdmin, unblockpods);
router.delete("/delete-pods/:id", authMiddleware, isAdmin, deletePods);
router.put("/edit-pods/:id", authMiddleware, isAdmin, editPods);


module.exports = router;
