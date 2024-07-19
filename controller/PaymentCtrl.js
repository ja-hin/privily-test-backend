const axios = require("axios");

const createPayment = async (req, res) => {
  try {
    const response = await axios.post(
      "https://payments.yoco.com/api/checkouts",
      {
        headers: {
          Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
        },
      },
      {
        amount: req.body.amount,
        currency: "ZAR",
        cancelUrl: req.body.cancelUrl,
        successUrl: req.body.successUrl,
        failureUrl: req.body.failureUrl,
        metadata: req.body.metadata,
        totalDiscount: req.body.totalDiscount,
        totalTaxAmount: req.body.totalTaxAmount,
        subtotalAmount: req.body.subtotalAmount,
        lineItems: req.body.lineItems,
      },
      
    );

    res.status(200).json(response.data);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Failed to create checkout",
        error: error.response.data,
      });
  }
};

module.exports = { createPayment };
