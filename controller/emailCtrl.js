const nodemailer = require("nodemailer");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");

const sendEmail = async (to, subject, html, attachments = []) => {
  console.log("Sending email to:", to);
  console.log("Subject:", subject);
  console.log("HTML:", html);

  try {
    // let transporter = nodemailer.createTransport({
    //   host: "smtp.gmail.com",
    //   service: "gmail",
    //   port: 465,
    //   secure: true,
    //   auth: {
    //     user: process.env.MAIL_ID,
    //     pass: process.env.MP,
    //   },
    // });
    let transporter = nodemailer.createTransporter({
      host: "smtp.gmail.com",
      service: "gmail",
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_ID,
        pass: process.env.MP,
      },
      // Add these timeout settings
      connectionTimeout: 60000, // 1 minute
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 60000, // 1 minute
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
