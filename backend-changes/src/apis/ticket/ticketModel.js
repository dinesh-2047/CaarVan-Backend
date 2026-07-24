const mongoose = require("mongoose");

const TICKET_STATUS = ["ISSUED", "USED", "CANCELLED", "EXPIRED"];

const itinerarySchema = new mongoose.Schema(
  {
    tripCode: {
      type: String,
      trim: true,
    },

    categoryName: {
      type: String,
      trim: true,
    },

    source: {
      type: String,
      trim: true,
    },

    destination: {
      type: String,
      trim: true,
    },

    departureTime: {
      type: Date,
    },

    arrivalTime: {
      type: Date,
    },

    driverName: {
      type: String,
      trim: true,
    },

    driverPhone: {
      type: String,
      trim: true,
    },

    vehicleNumber: {
      type: String,
      trim: true,
    },

    fare: {
      type: Number,
    },

    boardingPoint: {
      type: String,
      trim: true,
    },

    droppingPoint: {
      type: String,
      trim: true,
    },

    passengers: [
      {
        name: { type: String, trim: true },
        age: { type: Number },
        gender: { type: String, trim: true },
        seatNo: { type: Number },
        _id: false,
      },
    ],
  },
  { _id: false },
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: [true, "Booking is required"],
      unique: true,
    },

    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: [true, "Trip is required"],
    },

    qrCode: {
      type: String,
    },

    itinerary: {
      type: itinerarySchema,
      required: [true, "Itinerary snapshot is required"],
    },

    status: {
      type: String,
      enum: {
        values: TICKET_STATUS,
        message: `Status must be one of: ${TICKET_STATUS.join(", ")}`,
      },
      default: "ISSUED",
    },

    usedAt: {
      type: Date,
    },

    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    cancelledAt: {
      type: Date,
    },

    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Generator is required"],
    },
  },
  { timestamps: true },
);

ticketSchema.index({ tripId: 1, status: 1 });

ticketSchema.pre("save", function () {
  if (!this.ticketNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.ticketNumber = `TKT-${ts}-${random}`;
  }
});

const Ticket = mongoose.model("Ticket", ticketSchema);

module.exports = { Ticket, TICKET_STATUS };
