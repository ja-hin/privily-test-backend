
// const generateInvoicePdfBuffer = (booking, user) => {
//   return new Promise((resolve, reject) => {
//     const doc = new PDFDocument();
//     const buffers = [];

//     doc.on("data", buffers.push.bind(buffers));
//     doc.on("end", () => {
//       const pdfData = Buffer.concat(buffers);
//       resolve(pdfData);
//     });

//     // Compose PDF content
//     doc.fontSize(20).text("Invoice for your Booking", { align: "center" });
//     doc.moveDown();

//     doc.fontSize(14).text(`Booking ID: ${booking._id}`);
//     doc.text(`Name: ${user.firstname} ${user.lastname}`);
//     doc.text(`Email: ${user.email}`);
//     doc.text(`Booking Date: ${booking.bookingDate.toDateString()}`);
//     doc.text(`Start Time: ${booking.startTime.toLocaleTimeString()}`);
//     doc.text(`End Time: ${booking.endTime.toLocaleTimeString()}`);
//     doc.text(`Purpose: ${booking.bookingPurpose || "N/A"}`);

//     // Add more invoice details like price, taxes, total etc.
//     doc.moveDown();
//     doc.text(`Total Amount: ZAR XXXX`); // You can calculate or fetch this from booking/payment info

//     doc.end();
//   });
// };


// const generateInvoicePdfBuffer = (booking, user) => {
//   return new Promise((resolve, reject) => {
//     const doc = new PDFDocument({ margin: 50 });
//     const buffers = [];

//     doc.on("data", buffers.push.bind(buffers));
//     doc.on("end", () => {
//       const pdfData = Buffer.concat(buffers);
//       resolve(pdfData);
//     });

//     // COMPANY HEADER
//     doc.fontSize(16).text("Privily (Pty) Ltd", { align: "left" });
//     doc.fontSize(10).text("Reg. No.: 2023/832609/07");
//     doc.text("9 Mt. Orville, Midlands Estate, Midstream");
//     doc.text("Vat No.: 4890315445");
//     doc.text("Ph: (+27) 082 4412152 / (+27) 083 212 8647");
//     doc.moveDown();

//     // INVOICE METADATA
//     doc.fontSize(14).text(`Tax Invoice # ${booking.invoiceNumber || "XXXX"}`, {
//       align: "right",
//     });
//     doc.fontSize(10).text(`Invoice Date: ${new Date().toLocaleDateString()}`, {
//       align: "right",
//     });
//     doc.text(
//       `Due Date: ${
//         booking.dueDate?.toLocaleDateString() || "10 days from invoice"
//       }`,
//       { align: "right" }
//     );
//     doc.text(`Invoice No.: ${booking.invoiceNumber || "0001"}`, {
//       align: "right",
//     });

//     doc.moveDown();

//     // BILL TO
//     doc.fontSize(12).text("BILL TO:", { underline: true });
//     doc.text(`${user.firstname} ${user.lastname}`);
//     doc.text(user.email);
//     if (user.company) doc.text(user.company);
//     if (user.vatNumber) doc.text(`VAT No.: ${user.vatNumber}`);
//     doc.moveDown();

//     // TABLE HEADER
//     doc.font("Helvetica-Bold");
//     doc.text("DESCRIPTION", 50, doc.y, { continued: true });
//     doc.text("UNIT", 250, doc.y, { continued: true });
//     doc.text("QTY", 300, doc.y, { continued: true });
//     doc.text("DURATION", 350, doc.y, { continued: true });
//     doc.text("RATE", 420, doc.y, { continued: true });
//     doc.text("TOTAL", 480, doc.y);
//     doc.moveDown();
//     doc.font("Helvetica");
//     if (Array.isArray(booking.items) && booking.items.length > 0) {
//       booking.items.forEach((item) => {
//         doc.text(item.description, 50, doc.y, { continued: true });
//         doc.text(item.unit, 250, doc.y, { continued: true });
//         doc.text(item.qty.toString(), 300, doc.y, { continued: true });
//         doc.text(item.duration, 350, doc.y, { continued: true });
//         doc.text(`R ${item.rate.toLocaleString()}`, 420, doc.y, {
//           continued: true,
//         });
//         doc.text(`R ${item.total.toLocaleString()}`, 480, doc.y);
//         doc.moveDown();
//       });
//     } else {
//       console.log("No items available in the booking.");
//       doc.text("No items available.", 50, doc.y);
//     }
//     doc.moveDown();
//     const subtotal = booking.subtotal || 24000;
//     const vat = booking.vat || subtotal * 0.15;
//     const total = subtotal + vat;

//     doc.font("Helvetica-Bold");
//     doc.text(`SUBTOTAL`, 420, doc.y, { continued: true });
//     doc.text(`R ${subtotal.toLocaleString()}`, 480, doc.y);
//     doc.text(`VAT`, 420, doc.y, { continued: true });
//     doc.text(`R ${vat.toLocaleString()}`, 480, doc.y);
//     doc.text(`TOTAL`, 420, doc.y, { continued: true });
//     doc.text(`R ${total.toLocaleString()}`, 480, doc.y);
//     doc.font("Helvetica");

//     doc.moveDown();

//     // BANK DETAILS
//     doc.fontSize(10);
//     doc.text("Bank Details:");
//     doc.text("Privily (Pty) Ltd");
//     doc.text("Standard Bank, Branch: 002645");
//     doc.text("Account: 10 20 085 0707");
//     doc.text("SWIFT: SBZAZAJJ");

//     doc.moveDown();
//     doc.text(
//       `Event: Fame Week Africa - Soundproof Pods - ${
//         booking.eventStartDate || "02 Sept 2024"
//       } to ${booking.eventEndDate || "04 Sept 2024"}`
//     );

//     doc.end();
//   });
// };
const drawTable = (doc, booking, duration, rate, bookingTotal) => {
  const tableTop = doc.y;
  const rowHeight = 20;
  const columnWidths = [240, 50, 50, 70, 70, 70];
  const tableWidth = columnWidths.reduce((acc, width) => acc + width, 0);
  const cellPadding = 5;

  doc
    .font("Helvetica-Bold")
    .text("DESCRIPTION", 50 + cellPadding, tableTop, {
      width: columnWidths[0] - cellPadding,
      align: "left",
    })
    .text("DURATION", 400, tableTop, {
      width: columnWidths[3],
      align: "center",
    })
    .text("RATE", 470, tableTop, { width: columnWidths[4], align: "center" })
    .text("TOTAL", 540, tableTop, { width: columnWidths[5], align: "center" });

  // Header row border
  doc.rect(50, tableTop - 5, tableWidth, rowHeight).stroke();

  const rowTop = tableTop + rowHeight;

  doc
    .font("Helvetica")
    .text(booking.podTitle, 50 + cellPadding, rowTop, {
      width: columnWidths[0] - cellPadding,
      align: "left",
    })

    .text(`R ${rate.toLocaleString()}`, 470, rowTop, {
      width: columnWidths[4],
      align: "center",
    })
    .text(duration, 400, rowTop, {
      width: columnWidths[3],
      align: "center",
    })
    .text(`R ${bookingTotal.toLocaleString()}`, 540, rowTop, {
      width: columnWidths[5],
      align: "center",
    });

  // Row border
  doc.rect(50, rowTop - 5, tableWidth, rowHeight).stroke();

  return rowTop + rowHeight;
};


const generateInvoicePdfBuffer = async (booking, user) => {
  console.log("booking",booking)
const pod = await productModel.findById(booking.podId);
console.log("pod",pod)
const rate = pod?.rate;
console.log("rate", rate);

const startTime = new Date(booking.startTime);
const endTime = new Date(booking.endTime);

console.log("pods", startTime,endTime);


const durationInMinutes = Math.round((endTime - startTime) / (1000 * 60)); // 1 min = 60,000 ms
const duration = `${durationInMinutes}`;
const bookingTotal = durationInMinutes * rate;
console.log("duration", duration, rate, bookingTotal);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // COMPANY HEADER
    doc.image(logoPath, 50, 50, { width: 200 });
    doc.fontSize(16).text("Privily (Pty) Ltd", { align: "right" });
    doc.fontSize(10).text("Reg. No.: 2023/832609/07", { align: "right" });
    doc.text("9 Mt. Orville, Midlands Estate, Midstream", { align: "right" });
    doc.text("Vat No.: 4890315445", { align: "right" });
    doc.text("Ph: (+27) 082 4412152 / (+27) 083 212 8647", { align: "right" });
    doc.moveDown();

    // INVOICE METADATA
    doc.fontSize(14).text(`Tax Invoice`, {
      align: "center",
    });

    doc.moveDown();

    // BILL TO
    doc.fontSize(12).text("BILL TO:", { underline: true });
    doc.text(`${booking.user.firstname} ${booking.user.lastname}`);
    doc.text(booking.user.email);
    if (user.company) doc.text(user.company);
    if (user.vatNumber) doc.text(`VAT No.: ${user.vatNumber}`);
    doc.fontSize(10).text(`Invoice Date: ${new Date().toLocaleDateString()}`, {
      align: "right",
    });
    doc.text(`Invoice No.: ${booking.invoiceNumber || "0001"}`, {
      align: "right",
    });
    doc.moveDown();

    // Draw the table with the items
    const tableHeight = drawTable(doc, booking, rate, duration, bookingTotal);

    // Subtotal, VAT, and Total
const subtotal = bookingTotal;
const vat = subtotal * 0.15;
const grandTotal = subtotal;

    const columnWidths = [240, 50, 50, 70, 70, 70];
    const tableStartX = 50;
    const totalColumnX =
      tableStartX + columnWidths.slice(0, 5).reduce((sum, w) => sum + w, 0);

    const totalColumnWidth = columnWidths[5]; // 70
    const labelX = totalColumnX - 80;
    const valueX = totalColumnX;

    // Subtotal
      doc.text("VAT", labelX, tableHeight + 40);
      doc.text(`R ${vat.toLocaleString()}`, valueX, tableHeight + 40, {
        width: totalColumnWidth,
        align: "left",
      });
    // Total
    doc.text("TOTAL", labelX, tableHeight + 60);
    doc.text(`R ${grandTotal.toLocaleString()}`, valueX, tableHeight + 60, {
      width: totalColumnWidth,
      align: "left",
    });

    doc.font("Helvetica");

    doc.moveDown();

    // BANK DETAILS
    doc.fontSize(10);
    doc.text("Bank Details:", 50, doc.y, { align: "left" });
    doc.text("Privily (Pty) Ltd", 50, doc.y, { align: "left" });
    doc.text("Standard Bank, Branch: 002645", 50, doc.y + 10, {
      align: "left",
    });
    doc.text("Account: 10 20 085 0707", 50, doc.y, { align: "left" });
    doc.text("SWIFT: SBZAZAJJ", 50, doc.y, { align: "left" });

    // Add space after the bank details
    doc.moveDown();

    // doc.text(
    //   `Event: Fame Week Africa - Soundproof Pods - ${
    //     booking.eventStartDate || "02 Sept 2024"
    //   } to ${booking.eventEndDate || "04 Sept 2024"}`
    // );

    doc.end();
  });
};

// const generateInvoicePdfBuffer = async (booking, user) => {
//   // Add timeout wrapper
//   return Promise.race([
//     new Promise((resolve, reject) => {
//       // Your existing PDF generation code
//       const doc = new PDFDocument({ margin: 50 });
//       const buffers = [];

//       // Set a timeout for PDF generation
//       const timeout = setTimeout(() => {
//         reject(new Error("PDF generation timeout"));
//       }, 30000); // 30 seconds

//       doc.on("data", buffers.push.bind(buffers));
//       doc.on("end", () => {
//         clearTimeout(timeout);
//         const pdfData = Buffer.concat(buffers);
//         resolve(pdfData);
//       });

//       // Rest of your PDF code...
//     }),
//     new Promise((_, reject) =>
//       setTimeout(() => reject(new Error("PDF generation timeout")), 30000)
//     ),
//   ]);
// };
const sendInvoiceEmailWithAttachment = async (booking, user) => {
  const pdfBuffer = await generateInvoicePdfBuffer(booking, user);

  const mailOptions = {
    to: user.email,
    subject: "Your Booking Invoice",
    html: `<p>Dear ${user.firstname},</p><p>Please find attached the invoice for your booking.</p>`,
    attachments: [
      {
        filename: `invoice_${booking._id}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  await sendEmail(
    mailOptions.to,
    mailOptions.subject,
    mailOptions.html,
    mailOptions.attachments
  );
};
// const sendInvoiceEmail = asyncHandler(async (req, res) => {
//   const { bookingId } = req.params;
//   validateMongoDbId(bookingId);

//   const booking = await Booking.findById(bookingId).populate("user");

//   if (!booking) {
//     return res.status(404).json({ message: "Booking not found" });
//   }

//   const user = booking.user;
//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }

//   await sendInvoiceEmailWithAttachment(booking, user);

//   res.json({ message: "Invoice PDF sent successfully" });
// });

const sendInvoiceEmail = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  validateMongoDbId(bookingId);

  console.log(`Starting invoice generation for booking: ${bookingId}`);
  const startTime = Date.now();

  try {
    const booking = await Booking.findById(bookingId).populate("user");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const user = booking.user;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`Generating PDF for user: ${user.email}`);
    await sendInvoiceEmailWithAttachment(booking, user);

    const endTime = Date.now();
    console.log(`Invoice sent successfully in ${endTime - startTime}ms`);

    res.json({ message: "Invoice PDF sent successfully" });
  } catch (error) {
    const endTime = Date.now();
    console.error(
      `Invoice generation failed after ${endTime - startTime}ms:`,
      error
    );

    res.status(500).json({
      message: "Failed to send invoice",
      error: error.message,
    });
  }
});