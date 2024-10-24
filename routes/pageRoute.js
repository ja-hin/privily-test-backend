// routes/pages.js
const express = require("express");
const router = express.Router();
const { getPage, savePage, getBanner, saveBanner } = require("../controller/pageCtrl");
const { default: axios } = require("axios");

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
router.post("/opengate", async (req, res) => {
  try {
    // Call the external API using Axios
    const response = await axios.post(
      "https://web.fondcard.net/open/mqtt/api.php?method=mqtt.door.open",
      new URLSearchParams({
        serial: "WV3iZ",
        password: "94305670",
        userId: "629039",
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // Send the response back to the client
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error calling the external API:", error.message);
    res.status(500).json({ error: "Failed to open the gate." });
  }
});
module.exports = router;



