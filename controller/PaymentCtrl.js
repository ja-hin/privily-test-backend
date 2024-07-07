// controllers/paymentController.js
const axios = require("axios");
const Payment = require("../models/Payment");

const yocoSecretKey = "sk_test_cf22177cvKQB93Qec734ed889edf"; // Replace with your Yoco secret key

const createPayment = async (req, res) => {
  const { token, amountInCents, currency } = req.body;

  try {
    const response = await axios.post(
      "https://online.yoco.com/v1/charges/",
      {
        token,
        amountInCents,
        currency,
      },
      {
        headers: {
          "X-Auth-Secret-Key": yocoSecretKey,
        },
      }
    );

    const payment = new Payment({
      token,
      amountInCents,
      currency,
      status: response.data.status,
    });

    await payment.save();

    res.send(response.data);
  } catch (error) {
    res.status(500).send({ error: error.response.data.message });
  }
};

module.exports = {
  createPayment,
};
