const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const crypto = require("crypto");

const { Ticket } = require("./ticketModel");
const { Booking } = require("../booking/bookingModel");
const { Trip } = require("../trip/tripModel");

const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// for creating secure short token or signature - validating ticket
const signTicketToken = (ticketNumber) => {
  const secret = process.env.JWT_SECRET || "carvan_ticket_secret";
  return crypto
    .createHmac("sha256", secret)
    .update(ticketNumber)
    .digest("hex")
    .slice(0, 16);
};

// generate ticket
exports.generateTicket = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return next(createError("bookingId is required"));
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return next(createError("Booking not found", 404));
    }

    const isOwner = booking.userId.toString() === req.user.id;

    const isAdminOrManager = ["admin", "manager"].includes(req.user.role);

    if (!isOwner && !isAdminOrManager) {
      return next(createError("Forbidden", 403));
    }

    if (
      booking.bookingStatus !== "CONFIRMED" ||
      booking.paymentStatus !== "PAID"
    ) {
      return next(
        createError(
          "Ticket can only be generated after the booking is CONFIRMED and payment is PAID",
        ),
      );
    }

    // no duplicates if ticket already exist
    const existing = await Ticket.findOne({ bookingId });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Ticket already exists for this booking",
        ticket: existing,
      });
    }

    const trip = await Trip.findById(booking.tripId)
      .populate("routeId", "source destination")
      .populate("driverId", "name phone")
      .populate("vehicleId", "vehicle_number");

    if (!trip) {
      return next(createError("Associated trip not found", 404));
    }

    const itinerary = {
      tripCode: trip.tripCode,
      categoryName: trip.category?.name,
      source: trip.routeId?.source,
      destination: trip.routeId?.destination,
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime,
      driverName: trip.driverId?.name,
      driverPhone: trip.driverId?.phone,
      vehicleNumber: trip.vehicleId?.vehicle_number,
      fare: trip.fare,
      boardingPoint: booking.boardingPoint || trip.routeId?.source,
      droppingPoint: booking.droppingPoint || trip.routeId?.destination,
      passengers: booking.passengers,
    };

    // Generate ticketNumber early so it can be embedded in the QR payload
    const ts = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const ticketNumber = `TKT-${ts}-${random}`;
    const verificationToken = signTicketToken(ticketNumber);

    const qrPayload = JSON.stringify({
      ticketNumber,
      bookingId: booking._id.toString(),
      tripId: trip._id.toString(),
      token: verificationToken,
    });

    const qrCode = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 300,
    });

    const ticket = await Ticket.create({
      ticketNumber,
      bookingId: booking._id,
      tripId: trip._id,
      qrCode,
      itinerary,
      generatedBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Ticket generated successfully",
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

//  download ticket in the form of pdf
exports.downloadTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.body;

    if (!ticketId) {
      return next(createError("ticketId is required"));
    }

    const ticket = await Ticket.findById(ticketId).populate(
      "bookingId",
      "userId bookingNumber",
    );

    if (!ticket) {
      return next(createError("Ticket not found", 404));
    }

    const isOwner = ticket.bookingId?.userId?.toString() === req.user.id;

    const isAdminOrManager = ["admin", "manager"].includes(req.user.role);

    if (!isOwner && !isAdminOrManager) {
      return next(createError("Forbidden", 403));
    }

    const it = ticket.itinerary;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${ticket.ticketNumber}.pdf`,
    );

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text("Carvan — Trip Ticket", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Ticket No: ${ticket.ticketNumber}`);
    doc.text(`Status: ${ticket.status}`);
    doc.moveDown();

    doc.fontSize(14).text("Trip Details", { underline: true });
    doc.fontSize(11);
    doc.text(`Trip Code: ${it.tripCode || "-"}`);
    doc.text(`Category: ${it.categoryName || "-"}`);
    doc.text(`From: ${it.source || "-"}  →  To: ${it.destination || "-"}`);
    doc.text(`Board at: ${it.boardingPoint || it.source || "-"}`);
    doc.text(`Drop at: ${it.droppingPoint || it.destination || "-"}`);
    doc.text(
      `Departure: ${it.departureTime ? new Date(it.departureTime).toLocaleString() : "-"}`,
    );
    doc.text(
      `Arrival: ${it.arrivalTime ? new Date(it.arrivalTime).toLocaleString() : "-"}`,
    );
    doc.text(`Driver: ${it.driverName || "-"} (${it.driverPhone || "-"})`);
    doc.text(`Vehicle No: ${it.vehicleNumber || "-"}`);
    doc.text(`Fare: ${it.fare !== undefined ? it.fare : "-"}`);
    doc.moveDown();

    doc.fontSize(14).text("Passengers", { underline: true });
    doc.fontSize(11);
    (it.passengers || []).forEach((p, i) => {
      doc.text(
        `${i + 1}. ${p.name} | Age: ${p.age} | Gender: ${p.gender} | Seat: ${p.seatNo}`,
      );
    });
    doc.moveDown();

    if (ticket.qrCode) {
      const base64Data = ticket.qrCode.split(",")[1];
      const qrBuffer = Buffer.from(base64Data, "base64");
      doc.fontSize(14).text("Scan at Boarding", { underline: true });
      doc.image(qrBuffer, { width: 150, align: "center" });
    }

    doc.end();
  } catch (error) {
    next(error);
  }
};

// validate ticket
exports.validateTicket = async (req, res, next) => {
  try {
    const { ticketNumber, qrPayload } = req.body;

    let lookupTicketNumber = ticketNumber;

    let decodedToken;

    if (!lookupTicketNumber && qrPayload) {
      try {
        const parsed = JSON.parse(qrPayload);
        lookupTicketNumber = parsed.ticketNumber;
        decodedToken = parsed.token;
      } catch {
        return next(createError("Invalid QR payload"));
      }
    }

    if (!lookupTicketNumber) {
      return next(createError("ticketNumber or qrPayload is required"));
    }

    const ticket = await Ticket.findOne({
      ticketNumber: lookupTicketNumber,
    }).populate("tripId", "driverId status");

    if (!ticket) {
      return next(createError("Ticket not found", 404));
    }

    // If QR payload was used, verify the signature matches before trusting it
    if (decodedToken) {
      const expectedToken = signTicketToken(ticket.ticketNumber);
      if (decodedToken !== expectedToken) {
        return next(createError("QR code signature is invalid", 400));
      }
    }

    if (
      req.user.role === "driver" &&
      ticket.tripId?.driverId?.toString() !== req.user.id
    ) {
      return next(
        createError("Forbidden — you are not the driver for this trip", 403),
      );
    }

    if (ticket.status === "USED") {
      return next(createError("Ticket has already been used", 409));
    }

    if (ticket.status === "CANCELLED") {
      return next(createError("Ticket has been cancelled", 409));
    }

    if (ticket.status === "EXPIRED") {
      return next(createError("Ticket has expired", 409));
    }

    ticket.status = "USED";
    ticket.usedAt = new Date();
    ticket.validatedBy = req.user.id;
    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Ticket validated successfully — passenger may board",
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

// get ticket
exports.getTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.body;

    if (!ticketId) {
      return next(createError("ticketId is required"));
    }

    const ticket = await Ticket.findById(ticketId).populate(
      "bookingId",
      "userId bookingNumber",
    );

    if (!ticket) {
      return next(createError("Ticket not found", 404));
    }

    const isOwner = ticket.bookingId?.userId?.toString() === req.user.id;

    const isAdminOrManager = ["admin", "manager"].includes(req.user.role);

    if (!isOwner && !isAdminOrManager) {
      return next(createError("Forbidden", 403));
    }

    res.status(200).json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
};

// generate user ticket
exports.getUserTickets = async (req, res, next) => {
  try {
    const { status } = req.body;

    const bookings = await Booking.find({ userId: req.user.id }).select("_id");

    const bookingIds = bookings.map((b) => b._id);

    const filter = { bookingId: { $in: bookingIds } };

    if (status) filter.status = status;

    const tickets = await Ticket.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tickets.length,
      tickets,
    });
  } catch (error) {
    next(error);
  }
};
