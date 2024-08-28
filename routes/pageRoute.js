// routes/pages.js
const express = require("express");
const router = express.Router();
const { getPage, savePage, getBanner, saveBanner } = require("../controller/pageCtrl");

// Route to get terms and conditions content
router.get("/terms-and-conditions", (req, res) =>
    getPage({ ...req, params: { type: "terms-and-conditions" } }, res)
);

// Route to get privacy policy content
router.get("/privacy-policy", (req, res) =>
    getPage({ ...req, params: { type: "privacy-policy" } }, res)
);

// Route to create or update terms and conditions content
router.post("/terms-and-conditions", (req, res) =>
    savePage({ ...req, body: { ...req.body, type: "terms-and-conditions" } }, res)
);

// Route to create or update privacy policy content
router.post("/privacy-policy", (req, res) =>
    savePage({ ...req, body: { ...req.body, type: "privacy-policy" } }, res)
);
// Route to get all banners
router.get('/banner', getBanner);

// Route to create or update banner images
router.post('/banner', saveBanner);

module.exports = router;



