const nodemailer = require("nodemailer");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");

const sendEmail = async (to, subject, html, attachments = []) => {
  console.log("Sending email to:", to);
  console.log("Subject:", subject);
  console.log("HTML:", html);

  try {
    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      service: "gmail",
      port: 587,
      secure: false,
      auth: {
        user: process.env.MAIL_ID,
        pass: process.env.MP,
      },
    });

    const mailOptions = {
      from: '"Privily" <info@privily.co>',
      to: to,
      subject: subject,
      html: html,
      attachments: attachments, // <-- Add attachments here
    };

    // Send email
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};

module.exports = { sendEmail };
