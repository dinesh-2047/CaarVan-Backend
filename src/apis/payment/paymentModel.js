const mongoose = require("mongoose");

const PAYMENT_METHODS = ["RAZORPAY", "UPI", "CASH", "BANK_TRANSFER"];
const PAYMENT_STATUS = ["PENDING", "PAID", "REJECTED", "REFUNDED", "FAILED"];

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: [true, "Booking is required"],
    },

    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },

    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHODS,
        message: `Payment method must be one of: ${PAYMENT_METHODS.join(", ")}`,
      },
      required: [true, "Payment method is required"],
    },

    transactionId: {
      type: String,
      trim: true,
    },

    razorpayOrderId: {
      type: String,
      trim: true,
    },

    razorpaySignature: {
      type: String,
      trim: true,
    },

    screenshot: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: {
        values: PAYMENT_STATUS,
        message: `Status must be one of: ${PAYMENT_STATUS.join(", ")}`,
      },
      default: "PENDING",
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    verifiedAt: {
      type: Date,
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    refundedAt: {
      type: Date,
    },

    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    refundReason: {
      type: String,
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },
  },
  { timestamps: true },
);

paymentSchema.index({ bookingId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ razorpayOrderId: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = { Payment, PAYMENT_METHODS, PAYMENT_STATUS };
