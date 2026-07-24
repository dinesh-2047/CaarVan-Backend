// const mongoose = require("mongoose");

// const BOOKING_STATUS = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];
// const PAYMENT_STATUS = ["PENDING", "PAID", "REFUNDED", "FAILED"];
// const GENDERS = ["male", "female", "others"];

// const passengerSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: [true, "Passenger name is required"],
//       trim: true,
//     },

//     age: {
//       type: Number,
//       required: [true, "Passenger age is required"],
//       min: [0, "Age cannot be negative"],
//       max: [100, "Invalid age"],
//     },

//     gender: {
//       type: String,
//       enum: {
//         values: GENDERS,
//         message: `Gender must be one of: ${GENDERS.join(", ")}`,
//       },
//       required: [true, "Passenger gender is required"],
//     },

//     seatNo: {
//       type: Number,
//       required: [true, "Seat number is required"],
//       min: [1, "Seat number must be at least 1"],
//     },
//   },
//   { _id: false },
// );

// const bookingSchema = new mongoose.Schema(
//   {
//     bookingNumber: {
//       type: String,
//       unique: true,
//       uppercase: true,
//       trim: true,
//     },

//     userId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: [true, "User is required"],
//     },

//     tripId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Trip",
//       required: [true, "Trip is required"],
//     },

//     passengers: {
//       type: [passengerSchema],
//       validate: {
//         validator: (arr) => Array.isArray(arr) && arr.length > 0,
//         message: "At least one passenger is required",
//       },
//     },

//     totalPassengers: {
//       type: Number,
//       required: true,
//       min: [1, "Total passengers must be at least 1"],
//     },

//     seats: {
//       type: [Number],
//     },

//     totalFare: {
//       type: Number,
//       required: true,
//       min: [0, "Total fare cannot be negative"],
//     },

//     bookingStatus: {
//       type: String,
//       enum: {
//         values: BOOKING_STATUS,
//         message: `Booking status must be one of: ${BOOKING_STATUS.join(", ")}`,
//       },
//       default: "PENDING",
//     },

//     paymentStatus: {
//       type: String,
//       enum: {
//         values: PAYMENT_STATUS,
//         message: `Payment status must be one of: ${PAYMENT_STATUS.join(", ")}`,
//       },
//       default: "PENDING",
//     },

//     cancelledAt: {
//       type: Date,
//     },

//     cancelledBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//     },

//     cancellationReason: {
//       type: String,
//       trim: true,
//     },
//   },
//   { timestamps: true },
// );

// bookingSchema.index({ userId: 1, createdAt: -1 });
// bookingSchema.index({ tripId: 1, bookingStatus: 1 });
// bookingSchema.index({ userId: 1, seats: 1 });

// bookingSchema.pre("validate", function () {
//   // auto-generate booking bumber
//   if (!this.bookingNumber) {
//     const ts = Date.now().toString(36).toUpperCase();
//     const random = Math.random().toString(36).substring(2, 6).toUpperCase();
//     this.bookingNumber = `BKG-${ts}-${random}`;
//   }

//   //   totalPassengers and seats[] in sync
//   if (this.passengers && this.isModified("passengers")) {
//     this.totalPassengers = this.passengers.length;
//     this.seats = this.passengers.map((p) => p.seatNo);
//   }
// });

// const Booking = mongoose.model("Booking", bookingSchema);

// module.exports = { Booking, BOOKING_STATUS, PAYMENT_STATUS };


const mongoose = require("mongoose");

const BOOKING_STATUS = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];
const PAYMENT_STATUS = ["PENDING", "PAID", "REFUNDED", "FAILED"];
const GENDERS = ["male", "female", "others"];

const passengerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Passenger name is required"],
      trim: true,
    },

    age: {
      type: Number,
      required: [true, "Passenger age is required"],
      min: [0, "Age cannot be negative"],
      max: [100, "Invalid age"],
    },

    gender: {
      type: String,
      enum: {
        values: GENDERS,
        message: `Gender must be one of: ${GENDERS.join(", ")}`,
      },
      required: [true, "Passenger gender is required"],
    },

    seatNo: {
      type: Number,
      required: [true, "Seat number is required"],
      min: [1, "Seat number must be at least 1"],
    },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingNumber: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },

    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: [true, "Trip is required"],
    },

    // Ties this booking back to the SeatHold group it was confirmed
    // from. Used by confirmHeldSeats() as an idempotency key: if the
    // payment webhook fires twice for the same hold (common with most
    // payment gateways' at-least-once delivery), the second call can
    // detect "a booking already exists for this groupId" and return
    // the existing booking instead of erroring or double-booking.
    seatHoldGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },

    // Reference/transaction id from the payment gateway (Razorpay,
    // Stripe, etc.). Needed to reconcile a Booking with the actual
    // charge, and as a secondary idempotency guard alongside
    // seatHoldGroupId.
    paymentRef: {
      type: String,
      trim: true,
    },

    passengers: {
      type: [passengerSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one passenger is required",
      },
    },

    totalPassengers: {
      type: Number,
      required: true,
      min: [1, "Total passengers must be at least 1"],
    },

    seats: {
      type: [Number],
    },

    boardingPoint: {
      type: String,
      trim: true,
    },

    droppingPoint: {
      type: String,
      trim: true,
    },

    totalFare: {
      type: Number,
      required: true,
      min: [0, "Total fare cannot be negative"],
    },

    bookingStatus: {
      type: String,
      enum: {
        values: BOOKING_STATUS,
        message: `Booking status must be one of: ${BOOKING_STATUS.join(", ")}`,
      },
      default: "PENDING",
    },

    paymentStatus: {
      type: String,
      enum: {
        values: PAYMENT_STATUS,
        message: `Payment status must be one of: ${PAYMENT_STATUS.join(", ")}`,
      },
      default: "PENDING",
    },

    cancelledAt: {
      type: Date,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    cancellationReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ tripId: 1, bookingStatus: 1 });
bookingSchema.index({ userId: 1, seats: 1 });

bookingSchema.pre("validate", function () {
  // auto-generate booking bumber
  if (!this.bookingNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.bookingNumber = `BKG-${ts}-${random}`;
  }

  //   totalPassengers and seats[] in sync
  if (this.passengers && this.isModified("passengers")) {
    this.totalPassengers = this.passengers.length;
    this.seats = this.passengers.map((p) => p.seatNo);
  }
});

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = { Booking, BOOKING_STATUS, PAYMENT_STATUS };