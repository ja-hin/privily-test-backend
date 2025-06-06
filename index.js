const bodyParser = require("body-parser");
const express = require("express");
const dbConnect = require("./config/dbConnect");
const { notFound, errorHandler } = require("./middlew/errorHandler");
const app = express();
const dotenv = require("dotenv").config();
const PORT = process.env.PORT || 4000;

const authRouter = require("./routes/authRoute");
const productRouter = require("./routes/productRoute");
const categoryRouter = require("./routes/prodcategoryRoute");
const pageRouter = require("./routes/pageRoute")
const locationRouter = require("./routes/locationRoute");
const dashBoardRoute = require("./routes/dashBoardRoute");
const uploadRouter = require("./routes/UploadRouter");
const Paymentrouter = require("./routes/PaymentRoute")
const TransactionRouter = require("./routes/TransactionRouter");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");
const { createPayment } = require("./controller/PaymentCtrl");

dbConnect();
app.use(morgan("dev"));
// app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));
app.use("/api/user", authRouter);
app.use("/api/product", productRouter);
app.use("/api/category", categoryRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/pages", pageRouter)
app.use("/api/location", locationRouter);
app.use("/api/dashboard", dashBoardRoute);
app.use("/api", uploadRouter);
app.use("/api/payments", Paymentrouter);
app.use("/api/transactions", TransactionRouter);


app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running  at PORT ${PORT}`);
});
