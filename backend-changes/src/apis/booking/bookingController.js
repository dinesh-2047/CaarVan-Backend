const { Booking } = require("./bookingModel");
const { Trip } = require("../trip/tripModel");
const User = require("../user/userModel");
const { SeatReservation, VehicleSeatLayout } = require("../seat/seatModel");
const notify = require("../../utils/notify");

const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// create booking
exports.createBooking = async (req, res, next) => {
  try {
    const { tripId, passengers, boardingPoint, droppingPoint } = req.body;

    if (!tripId) {
      return next(createError("tripId is required"));
    }

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return next(
        createError("passengers array is required and cannot be empty"),
      );
    }

    for (const p of passengers) {
      if (!p.name || p.age === undefined || !p.gender || !p.seatNo) {
        return next(
          createError("Each passenger must have name, age, gender and seatNo"),
        );
      }
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return next(createError("Trip not found", 404));
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return next(createError("User not found", 404));
    }

    if (!["APPROVED", "STARTED"].includes(trip.status)) {
      return next(
        createError(`Trip is ${trip.status} and cannot accept bookings`),
      );
    }

    if (trip.departureTime <= new Date()) {
      return next(
        createError("Cannot book a trip whose departure time has passed"),
      );
    }

    if (boardingPoint) {
      const valid = trip.checkpoints.some((cp) => cp.city === boardingPoint);
      if (!valid) {
        return next(
          createError(`"${boardingPoint}" is not a valid checkpoint for this trip`),
        );
      }
    }

    if (droppingPoint) {
      const valid = trip.checkpoints.some((cp) => cp.city === droppingPoint);
      if (!valid) {
        return next(
          createError(`"${droppingPoint}" is not a valid checkpoint for this trip`),
        );
      }
    }

    if (trip.isLadiesOnly) {
      if (user.gender !== "female") {
        return next(
          createError("Only female users can book a Ladies Only trip", 403),
        );
      }

      const hasNonFemalePassenger = passengers.some((p) => p.gender !== "female");

      if (hasNonFemalePassenger) {
        return next(
          createError(
            "All passengers must be female for a Ladies Only trip",
            403,
          ),
        );
      }
    }

    const requestedSeats = passengers.map((p) => Number(p.seatNo));

    // Fetch seat layout of the vehicle to check layout & gender restrictions
    const layout = await VehicleSeatLayout.findOne({ vehicleId: trip.vehicleId });
    if (layout) {
      const seatMap = {};
      layout.seats.forEach((s) => {
        seatMap[s.seatNo] = s;
      });

      for (const p of passengers) {
        const seatDetail = seatMap[p.seatNo];
        if (!seatDetail) {
          return next(
            createError(`Seat number ${p.seatNo} does not exist in this vehicle's seat layout.`),
          );
        }

        // Validate gender restriction if specified
        if (seatDetail.genderRestriction && seatDetail.genderRestriction !== "none") {
          if (p.gender !== seatDetail.genderRestriction) {
            return next(
              createError(
                `Seat number ${p.seatNo} is restricted to ${seatDetail.genderRestriction} passengers.`,
                403
              ),
            );
          }
        }
      }
    } else {
      // fallback range 
      const invalidSeat = requestedSeats.find(
        (s) => s < 1 || s > trip.seatCapacity,
      );

      if (invalidSeat !== undefined) {
        return next(
          createError(
            `Seat number ${invalidSeat} is out of range (1-${trip.seatCapacity})`,
          ),
        );
      }
    }

    const uniqueSeats = new Set(requestedSeats);

    if (uniqueSeats.size !== requestedSeats.length) {
      return next(
        createError("Duplicate seat numbers in the same booking request"),
      );
    }

    let seatsToDecrement = 0;
    const reservationsToUpdate = [];
    const reservationsToCreate = [];

    for (const seatNo of requestedSeats) {
      const existingRes = await SeatReservation.findOne({
        tripId,
        seatNo,
        status: "RESERVED",
      });

      if (existingRes) {
        // If it's already a confirmed booking, or held by someone else, it's a conflict
        if (existingRes.reservedBy.toString() !== req.user.id || existingRes.reservationType === "BOOKED") {
          return next(
            createError(`Seat number ${seatNo} is already reserved or booked.`),
          );
        }
        // It's held by the current user. Save for update.
        reservationsToUpdate.push(existingRes);
      } else {
        // No reservation exists. We need to create one and decrement available seats.
        seatsToDecrement += 1;
        reservationsToCreate.push({
          tripId,
          seatNo,
          reservedBy: req.user.id,
          reservationType: "BOOKED",
          status: "RESERVED",
        });
      }
    }

    if (trip.availableSeats < seatsToDecrement) {
      return next(
        createError(
          `Only ${trip.availableSeats} seat(s) available, but ${seatsToDecrement} more requested`,
        ),
      );
    }

    const totalFare = trip.fare * passengers.length;

    const booking = await Booking.create({
      userId: req.user.id,
      tripId,
      passengers,
      totalPassengers: passengers.length,
      seats: passengers.map((p) => Number(p.seatNo)),
      totalFare,
      ...(boardingPoint && { boardingPoint }),
      ...(droppingPoint && { droppingPoint }),
    });

    // Update existing temporary reservations to BOOKED and link bookingId
    for (const res of reservationsToUpdate) {
      res.reservationType = "BOOKED";
      res.bookingId = booking._id;
      await res.save();
    }

    // Create new reservation records for previously unreserved seats
    if (reservationsToCreate.length > 0) {
      const reservations = reservationsToCreate.map((r) => ({
        ...r,
        bookingId: booking._id,
      }));
      await SeatReservation.insertMany(reservations);
    }

    if (seatsToDecrement > 0) {
      trip.availableSeats -= seatsToDecrement;
      await trip.save();
    }

    await booking.populate([
      {
        path: "tripId",
        select: "tripCode routeId departureTime arrivalTime fare category",
      },
      { path: "userId", select: "name phone email" },
    ]);

    // Send Booking Initiated Notification
    await notify({
      userId: req.user.id,
      title: "Booking Initiated",
      message: `Your booking ${booking.bookingNumber} has been initiated. Complete the payment to confirm your seats.`,
      type: "INFO",
      metadata: { bookingId: booking._id.toString(), bookingNumber: booking.bookingNumber }
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// cancel booking
exports.cancelBooking = async (req, res, next) => {
  try {
    const { bookingId, reason } = req.body;

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

    if (!["PENDING", "CONFIRMED"].includes(booking.bookingStatus)) {
      return next(
        createError(
          `Booking is already ${booking.bookingStatus} and cannot be cancelled`,
        ),
      );
    }

    const trip = await Trip.findById(booking.tripId);

    if (trip && ["STARTED", "COMPLETED"].includes(trip.status)) {
      return next(
        createError(`Cannot cancel — trip is already ${trip.status}`),
      );
    }

    booking.bookingStatus = "CANCELLED";
    booking.cancelledAt = new Date();
    booking.cancelledBy = req.user.id;
    if (reason) booking.cancellationReason = reason;

    await booking.save();

    // Fetch active reservations to update trip availableSeats correctly
    const activeReservations = await SeatReservation.find({
      bookingId: booking._id,
      status: "RESERVED",
    });

    if (activeReservations.length > 0) {
      await SeatReservation.updateMany(
        { bookingId: booking._id, status: "RESERVED" },
        { $set: { status: "RELEASED" } }
      );
    }

    if (trip) {
      trip.availableSeats += activeReservations.length;
      if (trip.availableSeats > trip.seatCapacity) {
        trip.availableSeats = trip.seatCapacity;
      }
      await trip.save();
    }

    // Send Booking Cancellation Notification
    await notify({
      userId: booking.userId,
      title: "Booking Cancelled",
      message: `Your booking ${booking.bookingNumber} has been successfully cancelled.`,
      type: "WARNING",
      metadata: { bookingId: booking._id.toString(), bookingNumber: booking.bookingNumber }
    });

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// get booking
exports.getBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return next(createError("bookingId is required"));
    }

    const booking = await Booking.findById(bookingId)
      .populate("tripId")
      .populate("userId", "name phone email")
      .populate("cancelledBy", "name role");

    if (!booking) {
      return next(createError("Booking not found", 404));
    }

    const isOwner = booking.userId._id.toString() === req.user.id;
    const isAdminOrManager = ["admin", "manager"].includes(req.user.role);
    if (!isOwner && !isAdminOrManager) {
      return next(createError("Forbidden", 403));
    }

    res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// get user bookings
exports.getUserBookings = async (req, res, next) => {
  try {
    const { status } = req.body;

    const filter = { userId: req.user.id };

    if (status) filter.bookingStatus = status;

    const bookings = await Booking.find(filter)
      .populate(
        "tripId",
        "tripCode routeId departureTime arrivalTime fare status category",
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    next(error);
  }
};
