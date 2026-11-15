// invoiceService.js
// Drop this next to your controllers (e.g. controller/invoiceService.js) and
// require it from userCtrl.js. Replaces generateInvoicePDF entirely.

const fs = require("fs");
const path = require("path");
const os = require("os");
const mongoose = require("mongoose");
const moment = require("moment");
const PDFDocument = require("pdfkit");

/* -------------------------------------------------------------------------
 * COMPANY DETAILS — FILL THESE IN.
 * The old invoice literally printed "Your Company Name" / "your@email.com"
 * to paying customers. Set these via env vars, or hardcode them here.
 * A South African tax invoice legally requires the trading name, address,
 * and (if registered) the VAT number.
 * ---------------------------------------------------------------------- */
const COMPANY = {
  name: process.env.COMPANY_NAME || "Privily (Pty) Ltd",
  addressLines: (
    process.env.COMPANY_ADDRESS || "POSTAL ADDRESS: 9 MOUNT ESTATE MIDSTREAM MIDLANDS ESTATE CENTURION GAUTENG 1692"
  ).split("|"),
  phone: process.env.COMPANY_PHONE || "TODO: +27 83 212 8647",
  email: process.env.COMPANY_EMAIL || "support@privily.co",
  website: process.env.COMPANY_WEBSITE || "https://privily.co",
  regNumber: process.env.COMPANY_REG_NO || "", // e.g. 2021/123456/07
  vatNumber: process.env.COMPANY_VAT_NO || "", // e.g. 4123456789 — blank = not VAT registered
};

// Your app already prices VAT-inclusive at 15% (BookingScr.jsx computes
// actualPrice = totalAmount * 0.85). Keep this in sync with the app.
const VAT_RATE = Number(process.env.VAT_RATE ?? 0.15);
const VAT_REGISTERED = Boolean(COMPANY.vatNumber);

const BRAND = {
  ink: "#1A1A1A",
  muted: "#6B7280",
  hairline: "#E5E7EB",
  band: "#F8F9FB",
  accent: "#E90E8B",
};

const PAGE = { margin: 50, left: 50, right: 545, width: 495 };

/* ------------------------------ helpers ------------------------------- */

// "R 1 234.56" — space thousands separator, the SA convention.
const zar = (cents) => {
  const n = (Number(cents || 0) / 100).toFixed(2);
  const [whole, frac] = n.split(".");
  return `R ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${frac}`;
};

const dash = (v) => (v === 0 ? "0" : v || "—");

const fmtDate = (d) => (d ? moment(d).format("D MMMM YYYY") : "—");
const fmtTime = (d) => (d ? moment(d).format("HH:mm") : "—");

const humanDuration = (minutes) => {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (!h) return `${rem} min`;
  return rem ? `${h} hr ${rem} min` : `${h} hr`;
};

/* --------------------------- invoice number ---------------------------
 * A real sequential number. Reusing the Mongo _id (the old "INV-<objectid>")
 * is unreadable and is not an acceptable tax-invoice number.
 * -------------------------------------------------------------------- */
const CounterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});
const InvoiceCounter =
  mongoose.models.InvoiceCounter || mongoose.model("InvoiceCounter", CounterSchema);

const nextInvoiceNumber = async (issuedAt) => {
  const year = moment(issuedAt).format("YYYY");
  try {
    const doc = await InvoiceCounter.findByIdAndUpdate(
      `invoice-${year}`,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    return `INV-${year}-${String(doc.seq).padStart(5, "0")}`;
  } catch (err) {
    // Never let numbering failure block the email.
    console.error("invoice: counter failed, falling back", err.message);
    return `INV-${year}-${Date.now().toString().slice(-6)}`;
  }
};

/* ---------------------------- PDF drawing ----------------------------- */

const hr = (doc, y, color = BRAND.hairline) => {
  doc.save().moveTo(PAGE.left, y).lineTo(PAGE.right, y)
    .lineWidth(1).strokeColor(color).stroke().restore();
};

const label = (doc, text, x, y, width) =>
  doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND.muted)
    .text(String(text).toUpperCase(), x, y, { width, characterSpacing: 0.6 });

const body = (doc, text, x, y, opts = {}) =>
  doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts.size || 10)
    .fillColor(opts.color || BRAND.ink)
    .text(String(text), x, y, { width: opts.width, align: opts.align || "left" });

/**
 * Builds the invoice PDF.
 *
 * @param {Object} user     User doc (firstname, lastname, email, phoneNumber)
 * @param {Object} booking  Booking doc, ideally with podId populated
 * @param {Object} payment  { amountInCents, currency, checkoutId, merchantId,
 *                            paymentFacilitator, pricing, locationName }
 * @returns {Promise<{filepath: string, invoiceNumber: string, totalInCents: number}>}
 */
const generateInvoicePDF = async (user, booking, payment = {}) => {
  const issuedAt = new Date();
  const invoiceNumber = await nextInvoiceNumber(issuedAt);

  const pricing = payment.pricing || {};
  const totalInCents = Number(
    payment.amountInCents ?? pricing.totalInCents ?? 0
  );
  const grossInCents = Number(pricing.grossInCents ?? totalInCents);
  const discountInCents = Number(pricing.discountInCents ?? 0);

  // VAT is inclusive: back it out of the total rather than adding it on.
  const vatInCents = VAT_REGISTERED
    ? Math.round(totalInCents - totalInCents / (1 + VAT_RATE))
    : 0;
  const netInCents = totalInCents - vatInCents;

  // The slot the customer reserved — always endTime - startTime.
  const bookedMinutes =
    booking.startTime && booking.endTime
      ? moment(booking.endTime).diff(moment(booking.startTime), "minutes")
      : 0;

  // What they were actually charged for. Differs from bookedMinutes only when
  // the session was started late, in which case billing runs from arrival.
  const durationMinutes = pricing.billableMinutes ?? bookedMinutes;

  // Write to the OS temp dir, not into the repo. The old code wrote every
  // invoice ever generated into ../invoices and never deleted them.
  const outDir = path.join(os.tmpdir(), "privily-invoices");
  fs.mkdirSync(outDir, { recursive: true });
  const filepath = path.join(outDir, `${invoiceNumber}.pdf`);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: PAGE.margin });
      const stream = fs.createWriteStream(filepath);

      // Resolve on the WRITE STREAM's finish, not doc.on('end').
      // doc.on('end') fires before the bytes are flushed to disk, so the
      // mailer could attach a truncated / empty PDF.
      stream.on("finish", () =>
        resolve({ filepath, invoiceNumber, totalInCents })
      );
      stream.on("error", reject);
      doc.on("error", reject);
      doc.pipe(stream);

      /* ---------------------------- header --------------------------- */
      let y = PAGE.margin;

      const logoPath = path.join(__dirname, "Logo.png");
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, PAGE.left, y, { fit: [130, 42] });
        } catch (_) {
          /* corrupt logo must not break the invoice */
        }
      } else {
        doc.font("Helvetica-Bold").fontSize(20).fillColor(BRAND.ink)
          .text(COMPANY.name, PAGE.left, y + 6);
      }

      doc.font("Helvetica-Bold").fontSize(22).fillColor(BRAND.ink)
        .text("TAX INVOICE", PAGE.left, y, { width: PAGE.width, align: "right" });
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.muted)
        .text(invoiceNumber, PAGE.left, y + 28, { width: PAGE.width, align: "right" })
        .text(`Issued ${fmtDate(issuedAt)}`, PAGE.left, y + 42, {
          width: PAGE.width, align: "right",
        });

      y += 76;
      hr(doc, y);
      y += 18;

      /* --------------------- from / bill-to columns ------------------- */
      const colW = 230;
      const rightX = PAGE.left + 265;

      label(doc, "From", PAGE.left, y, colW);
      label(doc, "Bill to", rightX, y, colW);
      y += 14;

      const fromLines = [
        COMPANY.name,
        ...COMPANY.addressLines,
        COMPANY.phone,
        COMPANY.email,
        COMPANY.regNumber ? `Reg. No. ${COMPANY.regNumber}` : null,
        VAT_REGISTERED ? `VAT No. ${COMPANY.vatNumber}` : null,
      ].filter(Boolean);

      const customerName =
        [user?.firstname, user?.lastname].filter(Boolean).join(" ") || "—";
      const toLines = [
        customerName,
        user?.email || "—",
        // The old code read user.mobile, which does not exist on the User
        // model — it is phoneNumber. Every invoice printed "N/A".
        user?.phoneNumber || null,
      ].filter(Boolean);

      const startY = y;
      fromLines.forEach((line, i) => {
        body(doc, line, PAGE.left, startY + i * 13, {
          width: colW, size: 9.5, bold: i === 0,
          color: i === 0 ? BRAND.ink : BRAND.muted,
        });
      });
      toLines.forEach((line, i) => {
        body(doc, line, rightX, startY + i * 13, {
          width: colW, size: 9.5, bold: i === 0,
          color: i === 0 ? BRAND.ink : BRAND.muted,
        });
      });

      y = startY + Math.max(fromLines.length, toLines.length) * 13 + 18;

      /* ------------------------ booking summary ----------------------- */
      const summaryH = 62;
      doc.save().rect(PAGE.left, y, PAGE.width, summaryH)
        .fillColor(BRAND.band).fill().restore();

      const cells = [
        ["Booking date", fmtDate(booking.bookingDate)],
        ["Time", `${fmtTime(booking.startTime)} – ${fmtTime(booking.endTime)}`],
        ["Duration", humanDuration(bookedMinutes)],
        ["Booking ref", String(booking._id || "—").slice(-8).toUpperCase()],
      ];
      const cellW = PAGE.width / cells.length;
      cells.forEach(([k, v], i) => {
        const cx = PAGE.left + i * cellW + 14;
        label(doc, k, cx, y + 14, cellW - 20);
        body(doc, v, cx, y + 28, { width: cellW - 20, size: 11, bold: true });
      });

      y += summaryH + 26;

      /* -------------------------- line items -------------------------- */
      const COLS = {
        desc: { x: PAGE.left, w: 245 },
        qty: { x: 305, w: 70 },
        rate: { x: 375, w: 70 },
        amount: { x: 445, w: 100 },
      };

      label(doc, "Description", COLS.desc.x, y, COLS.desc.w);
      label(doc, "Billed", COLS.qty.x, y, COLS.qty.w);
      label(doc, "Rate", COLS.rate.x, y, COLS.rate.w);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND.muted)
        .text("AMOUNT", COLS.amount.x, y, { width: COLS.amount.w, align: "right" });

      y += 14;
      hr(doc, y);
      y += 12;

      // The old layout hardcoded Y offsets, so any pod title longer than the
      // column simply ran over the Date column. Measure and wrap instead.
      const descLines = [
        booking.podTitle || "Pod booking",
        payment.locationName ? `Location: ${payment.locationName}` : null,
        booking.bookingPurpose ? `Purpose: ${booking.bookingPurpose}` : null,
        // Explain the gap rather than leaving the customer to spot it.
        durationMinutes !== bookedMinutes
          ? `Billed from session start · ${humanDuration(bookedMinutes)} slot reserved`
          : null,
      ].filter(Boolean);

      const descText = descLines.join("\n");
      doc.font("Helvetica").fontSize(10);
      const rowH = Math.max(
        doc.heightOfString(descText, { width: COLS.desc.w }),
        14
      );

      body(doc, descLines[0], COLS.desc.x, y, {
        width: COLS.desc.w, size: 10, bold: true,
      });
      if (descLines.length > 1) {
        body(doc, descLines.slice(1).join("\n"), COLS.desc.x, y + 13, {
          width: COLS.desc.w, size: 9, color: BRAND.muted,
        });
      }
      body(doc, humanDuration(durationMinutes), COLS.qty.x, y, { width: COLS.qty.w });
      body(
        doc,
        pricing.ratePerMinute ? `${zar(pricing.ratePerMinute * 100)}/min` : "—",
        COLS.rate.x, y, { width: COLS.rate.w }
      );
      body(doc, zar(grossInCents), COLS.amount.x, y, {
        width: COLS.amount.w, align: "right",
      });

      y += rowH + 10;

      if (discountInCents > 0) {
        body(doc, "First booking discount", COLS.desc.x, y, {
          width: COLS.desc.w, color: BRAND.accent,
        });
        body(doc, `−${zar(discountInCents)}`, COLS.amount.x, y, {
          width: COLS.amount.w, align: "right", color: BRAND.accent,
        });
        y += 20;
      }

      hr(doc, y);
      y += 14;

      /* ---------------------------- totals ---------------------------- */
      const totalsX = 335;
      const totalsW = 110;
      const valX = 445;
      const valW = 100;

      const totalRow = (text, value, opts = {}) => {
        body(doc, text, totalsX, y, {
          width: totalsW, align: "right", size: opts.size || 10,
          bold: opts.bold, color: opts.color || BRAND.muted,
        });
        body(doc, value, valX, y, {
          width: valW, align: "right", size: opts.size || 10,
          bold: opts.bold, color: opts.color || BRAND.ink,
        });
        y += opts.gap || 16;
      };

      if (VAT_REGISTERED) {
        totalRow("Subtotal (excl. VAT)", zar(netInCents));
        totalRow(`VAT @ ${(VAT_RATE * 100).toFixed(0)}%`, zar(vatInCents));
      } else {
        totalRow("Subtotal", zar(totalInCents));
      }

      hr(doc, y - 4);
      y += 6;
      totalRow("Total", zar(totalInCents), {
        bold: true, size: 13, color: BRAND.ink, gap: 22,
      });

      totalRow("Amount paid", zar(totalInCents), { color: BRAND.muted });
      totalRow("Balance due", zar(0), { bold: true });

      y += 12;
      hr(doc, y);
      y += 16;

      /* ------------------------ payment details ----------------------- */
      label(doc, "Payment", PAGE.left, y, PAGE.width);
      y += 14;

      const paidVia =
        totalInCents === 0
          ? "No charge — complimentary booking"
          : `${payment.paymentFacilitator || "Yoco online checkout"}`;

      const payLines = [
        `Method: ${paidVia}`,
        payment.checkoutId ? `Reference: ${payment.checkoutId}` : null,
        `Status: Paid in full on ${fmtDate(issuedAt)}`,
      ].filter(Boolean);

      payLines.forEach((line, i) =>
        body(doc, line, PAGE.left, y + i * 13, {
          size: 9.5, color: BRAND.muted, width: PAGE.width,
        })
      );

      /* ----------------------------- footer --------------------------- */
      const footY = 760;
      hr(doc, footY - 14);
      const footer = [
        VAT_REGISTERED
          ? "This is a valid tax invoice for VAT purposes."
          : "This is not a VAT invoice.",
        `${COMPANY.name} · ${COMPANY.email} · ${COMPANY.website}`,
      ];
      footer.forEach((line, i) =>
        doc.font("Helvetica").fontSize(8).fillColor(BRAND.muted)
          .text(line, PAGE.left, footY + i * 11, {
            width: PAGE.width, align: "center",
          })
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateInvoicePDF, zar, COMPANY, VAT_RATE, VAT_REGISTERED };
