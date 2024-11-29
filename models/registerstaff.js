// const mongoose = require("mongoose");
// const bcrypt = require("bcrypt");

// // Define the Schema for staff members
// const staffSchema = new mongoose.Schema(
//   {
//     firstname: {
//       type: String,
//       required: true,
//     },
//     lastname: {
//       type: String,
//       required: true,
//     },
//     email: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     mobile: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     password: {
//       type: String,
//       required: true,
//     },
//     role: {
//       type: String,
//       default: "staff",
//     },
//     isBlocked: {
//       type: Boolean,
//       default: false,
//     },
//     auth_page: {
//       type: [String], // Array of roles (could be strings like "admin", "editor", etc.)
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// staffSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) {
//     next();
//   }
//   const salt = await bcrypt.genSaltSync(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

// // Method to compare the entered password with the hashed password
// staffSchema.methods.isPasswordMatched = async function (enteredPassword) {
//   return await bcrypt.compare(enteredPassword, this.password);
// };

// module.exports = mongoose.model("Staff", staffSchema);


const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Define the Schema for staff members
const staffSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "staff",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    auth_page: {
      type: [String], // Array of roles (could be strings like "admin", "editor", etc.)
    },
  },
  {
    timestamps: true,
  }
);

staffSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare the entered password with the hashed password
staffSchema.methods.isPasswordMatched = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Staff", staffSchema);
