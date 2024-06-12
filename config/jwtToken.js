//jwtToken.js
const jwt = require("jsonwebtoken");

const generateToken = (id, expiresIn = '100d') => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn});
};

module.exports = { generateToken };
