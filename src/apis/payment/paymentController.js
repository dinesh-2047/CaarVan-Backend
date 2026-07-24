const { Payment } = require("./paymentModel");
const { Booking } = require("../booking/bookingModel");
const { Trip } = require("../trip/tripModel");
const notify = require("../../utils/notify");
const {
  razorpayInstance,
  verifyPaymentSignature,
  isTestMode,
} = require("../../config/razorpay");

const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const confirmBookingAfterPayment = async (bookingId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) return;

  booking.bookingStatus = "CONFIRMED";
  booking.paymentStatus = "PAID";
  await booking.save();

  // Send Booking Confirmation Notification
  await notify({
    userId: booking.userId,
    title: "Booking Confirmed & Seats Locked",
    message: `Your payment for booking ${booking.bookingNumber} was verified successfully. Your booking is confirmed!`,
    type: "SUCCESS",
    metadata: {
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
    },
  });
};

// create order for booking amount
exports.createPaymentOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return next(createError("bookingId is required"));
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return next(createError("Booking not found", 404));
    }

    if (booking.userId.toString() !== req.user.id) {
      return next(createError("Forbidden - this is not your booking", 403));
    }

    if (booking.paymentStatus === "PAID") {
      return next(createError("This booking is already paid"));
    }

    if (booking.bookingStatus === "CANCELLED") {
      return next(createError("Cannot pay for a cancelled booking"));
    }

    const amountInPaise = Math.round(booking.totalFare * 100);

    const order = await razorpayInstance.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: booking.bookingNumber,
    });

    const payment = await Payment.create({
      bookingId,
      amount: booking.totalFare,
      paymentMethod: "RAZORPAY",
      razorpayOrderId: order.id,
      status: "PENDING",
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: isTestMode
        ? "Razorpay test order created"
        : "Razorpay order created",
      isTestMode,
      order,
      payment,
    });
  } catch (error) {
    next(error);
  }
};

// verify razorpay payment
exports.verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      req.body;

    if (
      !paymentId ||
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return next(
        createError(
          "paymentId, razorpayOrderId, razorpayPaymentId, and razorpaySignature are all required",
        ),
      );
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return next(createError("Payment record not found", 404));
    }

    if (payment.razorpayOrderId !== razorpayOrderId) {
      return next(createError("Order ID mismatch"));
    }

    if (payment.status === "PAID") {
      return next(createError("Payment already verified"));
    }

    const isValid = verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValid) {
      payment.status = "FAILED";
      await payment.save();
      return next(createError("Payment signature verification failed", 400));
    }

    payment.status = "PAID";
    payment.transactionId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.verifiedAt = new Date();
    await payment.save();

    await confirmBookingAfterPayment(payment.bookingId);

    res.status(200).json({
      success: true,
      message: "Payment verified and booking confirmed",
      isTestMode,
      payment,
    });
  } catch (error) {
    next(error);
  }
};

// upload payment proof
exports.uploadPaymentProof = async (req, res, next) => {
  try {
    const { bookingId, amount, paymentMethod, transactionId } = req.body;

    if (!bookingId || !amount || !paymentMethod) {
      return next(
        createError("bookingId, amount, and paymentMethod are required"),
      );
    }

    if (!["UPI", "CASH", "BANK_TRANSFER"].includes(paymentMethod)) {
      return next(
        createError(
          "paymentMethod must be UPI, CASH, or BANK_TRANSFER for manual proof",
        ),
      );
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return next(createError("Booking not found", 404));
    }

    if (booking.userId.toString() !== req.user.id) {
      return next(createError("Forbidden — this is not your booking", 403));
    }

    if (booking.paymentStatus === "PAID") {
      return next(createError("This booking is already paid for"));
    }

    const paymentData = {
      bookingId,
      amount,
      paymentMethod,
      transactionId,
      status: "PENDING",
      createdBy: req.user.id,
    };

    if (req.file) {
      paymentData.screenshot = req.file.path;
    } else if (paymentMethod !== "CASH") {
      return next(
        createError("Payment screenshot is required for UPI / bank transfer"),
      );
    }

    const payment = await Payment.create(paymentData);

    res.status(201).json({
      success: true,
      message: "Payment proof submitted — awaiting admin verification",
      payment,
    });
  } catch (error) {
    next(error);
  }
};

// verify payment
exports.verifyPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return next(createError("paymentId is required"));
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return next(createError("Payment not found", 404));
    }

    if (payment.status !== "PENDING") {
      return next(createError(`Payment is already ${payment.status}`));
    }

    payment.status = "PAID";
    payment.verifiedBy = req.user.id;
    payment.verifiedAt = new Date();
    await payment.save();

    await confirmBookingAfterPayment(payment.bookingId);

    res.status(200).json({
      success: true,
      message: "Payment verified and booking confirmed",
      payment,
    });
  } catch (error) {
    next(error);
  }
};

// reject payment
exports.rejectPayment = async (req, res, next) => {
  try {
    const { paymentId, reason } = req.body;

    if (!paymentId) {
      return next(createError("paymentId is required"));
    }

    if (!reason) {
      return next(createError("Rejection reason is required"));
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return next(createError("Payment not found", 404));
    }

    if (payment.status !== "PENDING") {
      return next(createError(`Payment is already ${payment.status}`));
    }

    payment.status = "REJECTED";
    payment.verifiedBy = req.user.id;
    payment.verifiedAt = new Date();
    payment.rejectionReason = reason;
    await payment.save();

    // Send Payment Rejection Notification
    const booking = await Booking.findById(payment.bookingId);
    await notify({
      userId: payment.createdBy,
      title: "Payment Verification Rejected",
      message: `Your payment proof for booking ${booking ? booking.bookingNumber : "N/A"} was rejected. Reason: ${reason}`,
      type: "DANGER",
      metadata: { paymentId: payment._id.toString() },
    });

    res.status(200).json({
      success: true,
      message: "Payment rejected",
      payment,
    });
  } catch (error) {
    next(error);
  }
};

// refund payment
exports.refundPayment = async (req, res, next) => {
  try {
    const { paymentId, reason } = req.body;

    if (!paymentId) {
      return next(createError("paymentId is required"));
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return next(createError("Payment not found", 404));
    }

    if (payment.status !== "PAID") {
      return next(createError("Only a PAID payment can be refunded"));
    }

    payment.status = "REFUNDED";
    payment.refundedBy = req.user.id;
    payment.refundedAt = new Date();
    if (reason) payment.refundReason = reason;
    await payment.save();

    // show refund on booking also
    const booking = await Booking.findById(payment.bookingId);
    if (booking) {
      booking.paymentStatus = "REFUNDED";
      await booking.save();
    }

    // Send Refund Processed Notification
    await notify({
      userId: payment.createdBy,
      title: "Refund Processed Successfully",
      message: `Your refund of INR ${payment.amount} for booking ${booking ? booking.bookingNumber : "N/A"} has been processed. Reason: ${reason || "Processed by admin"}`,
      type: "INFO",
      metadata: { paymentId: payment._id.toString() },
    });

    res.status(200).json({
      success: true,
      message: isTestMode ? "Payment refunded (Test Mode)" : "Payment refunded",
      isTestMode,
      payment,
    });
  } catch (error) {
    next(error);
  }
};
