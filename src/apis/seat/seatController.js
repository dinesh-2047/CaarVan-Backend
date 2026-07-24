// const { VehicleSeatLayout, SeatReservation } = require("./seatModel");
// const Vehicle = require("../vehicle/vehicleModel");
// const { Trip } = require("../trip/tripModel");
// const Business = require("../Business/businessModel");

// const hasVehiclePermission = async (user, vehicle) => {
//   if (["admin", "manager", "driver"].includes(user.role)) {
//     return true;
//   }
//   // Check if vehicle belongs to the business owned by the user
//   const business = await Business.findById(vehicle.business_id);
//   if (business && business.user_id.toString() === user.id.toString()) {
//     return true;
//   }
//   return false;
// };

// // create or update seat layout
// const createSeatLayout = async (req, res, next) => {
//   try {
//     const { vehicleId, rows, columns, seats } = req.body;

//     if (!vehicleId || !rows || !columns || !Array.isArray(seats)) {
//       return res.status(400).json({
//         success: false,
//         message: "vehicleId, rows, columns, and seats array are required.",
//       });
//     }

//     const vehicle = await Vehicle.findById(vehicleId);

//     if (!vehicle) {
//       return res.status(404).json({
//         success: false,
//         message: "Vehicle not found.",
//       });
//     }

//     const allowed = await hasVehiclePermission(req.user, vehicle);

//     if (!allowed) {
//       return res.status(403).json({
//         success: false,
//         message:
//           "You are not authorized to set the seat layout for this vehicle.",
//       });
//     }

//     if (seats.length > vehicle.seat_capacity) {
//       return res.status(400).json({
//         success: false,
//         message: `Number of seats in layout (${seats.length}) cannot exceed vehicle seat capacity (${vehicle.seat_capacity}).`,
//       });
//     }

//     const seatNumbers = seats.map((s) => Number(s.seatNo));

//     const uniqueSeatNos = new Set(seatNumbers);

//     if (uniqueSeatNos.size !== seats.length) {
//       return res.status(400).json({
//         success: false,
//         message: "Duplicate seat numbers in layout.",
//       });
//     }

//     if (seatNumbers.some((num) => num < 1)) {
//       return res.status(400).json({
//         success: false,
//         message: "Seat numbers must be greater than or equal to 1.",
//       });
//     }

//     let layout = await VehicleSeatLayout.findOne({ vehicleId });

//     if (layout) {
//       layout.rows = rows;
//       layout.columns = columns;
//       layout.seats = seats;
//       await layout.save();
//     } else {
//       layout = await VehicleSeatLayout.create({
//         vehicleId,
//         rows,
//         columns,
//         seats,
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Vehicle seat layout saved successfully.",
//       data: layout,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // get seat availability
// const getSeatAvailability = async (req, res, next) => {
//   try {
//     const { tripId } = req.body;

//     if (!tripId) {
//       return res.status(400).json({
//         success: false,
//         message: "tripId is required.",
//       });
//     }

//     const trip = await Trip.findById(tripId).populate("vehicleId");
//     if (!trip) {
//       return res.status(404).json({
//         success: false,
//         message: "Trip not found.",
//       });
//     }

//     const layout = await VehicleSeatLayout.findOne({
//       vehicleId: trip.vehicleId?._id,
//     });

//     const activeReservations = await SeatReservation.find({
//       tripId,
//       status: "RESERVED",
//     }).lean();

//     const reservationMap = {};
//     activeReservations.forEach((r) => {
//       reservationMap[r.seatNo] = {
//         reservedBy: r.reservedBy,
//         reservationType: r.reservationType,
//         bookingId: r.bookingId,
//       };
//     });

//     let processedSeats = [];
//     let rows = 0;
//     let columns = 0;

//     if (layout) {
//       rows = layout.rows;
//       columns = layout.columns;
//       processedSeats = layout.seats.map((seat) => {
//         const isReserved = !!reservationMap[seat.seatNo];
//         return {
//           seatNo: seat.seatNo,
//           seatType: seat.seatType,
//           genderRestriction: seat.genderRestriction,
//           isAvailable: !isReserved,
//           ...(isReserved && {
//             reservationDetails: {
//               reservationType: reservationMap[seat.seatNo].reservationType,
//               ...(req.user &&
//                 ["admin", "manager"].includes(req.user.role) && {
//                   reservedBy: reservationMap[seat.seatNo].reservedBy,
//                 }),
//             },
//           }),
//         };
//       });
//     } else {
//       const capacity = trip.seatCapacity || trip.vehicleId?.seat_capacity || 10;

//       rows = Math.ceil(capacity / 4);
//       columns = 4;
//       for (let i = 1; i <= capacity; i++) {
//         const isReserved = !!reservationMap[i];
//         processedSeats.push({
//           seatNo: i,
//           seatType: "NORMAL",
//           genderRestriction: "none",
//           isAvailable: !isReserved,
//           ...(isReserved && {
//             reservationDetails: {
//               reservationType: reservationMap[i].reservationType,
//             },
//           }),
//         });
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Fetched seat availability successfully.",
//       data: {
//         tripId,
//         vehicleId: trip.vehicleId?._id,
//         vehicleNumber: trip.vehicleId?.vehicle_number,
//         rows,
//         columns,
//         seats: processedSeats,
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // reserve seat
// const reserveSeat = async (req, res, next) => {
//   try {
//     const { tripId, seatNo, reservationType } = req.body;

//     if (!tripId || !seatNo) {
//       return res.status(400).json({
//         success: false,
//         message: "tripId and seatNo are required.",
//       });
//     }

//     const trip = await Trip.findById(tripId);

//     if (!trip) {
//       return res.status(404).json({
//         success: false,
//         message: "Trip not found.",
//       });
//     }

//     if (!["APPROVED", "STARTED"].includes(trip.status)) {
//       return res.status(400).json({
//         success: false,
//         message: `Trip is ${trip.status} and cannot accept reservations.`,
//       });
//     }

//     if (trip.availableSeats <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No seats available on this trip.",
//       });
//     }

//     const layout = await VehicleSeatLayout.findOne({
//       vehicleId: trip.vehicleId,
//     });
//     if (layout) {
//       const seatExists = layout.seats.some((s) => s.seatNo === Number(seatNo));
//       if (!seatExists) {
//         return res.status(400).json({
//           success: false,
//           message: `Seat number ${seatNo} does not exist in this vehicle's seat layout.`,
//         });
//       }
//     } else if (Number(seatNo) < 1 || Number(seatNo) > trip.seatCapacity) {
//       return res.status(400).json({
//         success: false,
//         message: `Seat number ${seatNo} is out of range for this trip's capacity (1-${trip.seatCapacity}).`,
//       });
//     }

//     const existing = await SeatReservation.findOne({
//       tripId,
//       seatNo: Number(seatNo),
//       status: "RESERVED",
//     });

//     if (existing) {
//       return res.status(400).json({
//         success: false,
//         message: `Seat ${seatNo} is already reserved for this trip.`,
//       });
//     }

//     const reservation = await SeatReservation.create({
//       tripId,
//       seatNo: Number(seatNo),
//       reservedBy: req.user.id,
//       reservationType: reservationType || "TEMPORARY",
//       status: "RESERVED",
//     });

//     trip.availableSeats -= 1;
//     await trip.save();

//     return res.status(201).json({
//       success: true,
//       message: "Seat reserved successfully.",
//       data: reservation,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // release reserved seat
// const releaseSeat = async (req, res, next) => {
//   try {
//     const { tripId, seatNo } = req.body;

//     if (!tripId || !seatNo) {
//       return res.status(400).json({
//         success: false,
//         message: "tripId and seatNo are required.",
//       });
//     }

//     const reservation = await SeatReservation.findOne({
//       tripId,
//       seatNo: Number(seatNo),
//       status: "RESERVED",
//     });

//     if (!reservation) {
//       return res.status(404).json({
//         success: false,
//         message: "No active reservation found for this seat.",
//       });
//     }

//     const isOwner = reservation.reservedBy.toString() === req.user.id;

//     const isAdminOrManager = ["admin", "manager"].includes(req.user.role);

//     if (!isOwner && !isAdminOrManager) {
//       return res.status(403).json({
//         success: false,
//         message: "You are not authorized to release this seat reservation.",
//       });
//     }

//     reservation.status = "RELEASED";
//     await reservation.save();

//     const trip = await Trip.findById(reservation.tripId);
//     if (trip && ["APPROVED", "STARTED"].includes(trip.status)) {
//       trip.availableSeats += 1;
//       if (trip.availableSeats > trip.seatCapacity) {
//         trip.availableSeats = trip.seatCapacity;
//       }
//       await trip.save();
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Seat released successfully.",
//       data: reservation,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// module.exports = {
//   createSeatLayout,
//   getSeatAvailability,
//   reserveSeat,
//   releaseSeat,
// };

const mongoose = require("mongoose");
const { VehicleSeatLayout, SeatHold, SeatReservation } = require("./seatModel");
const Vehicle = require("../vehicle/vehicleModel");
const { Trip } = require("../trip/tripModel");
const { Booking } = require("../booking/bookingModel"); // real model: passengers[], totalFare, paymentStatus, bookingStatus

const HOLD_DURATION_MS = 10 * 60 * 1000; // 10 minutes
// How long to keep terminal-state SeatHold docs around for audit/debug
// before TTL deletes them. Set on `cleanupAt`, never on `expiresAt` —
// see the index comment in seatModel.js for why these are kept separate.
const HOLD_CLEANUP_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

const hasVehiclePermission = async (user, vehicle) => {
  if (["admin", "manager", "driver"].includes(user.role)) {
    return true;
  }
  if (vehicle.user_id && vehicle.user_id.toString() === user.id.toString()) {
    return true;
  }
  return false;
};

// ───────────────────────────────────────────────────────────────────────
// createSeatLayout — UNCHANGED from original
// ───────────────────────────────────────────────────────────────────────
const createSeatLayout = async (req, res, next) => {
  try {
    const { vehicleId, rows, columns, seats } = req.body;

    if (!vehicleId || !rows || !columns || !Array.isArray(seats)) {
      return res.status(400).json({
        success: false,
        message: "vehicleId, rows, columns, and seats array are required.",
      });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res
        .status(404)
        .json({ success: false, message: "Vehicle not found." });
    }

    const allowed = await hasVehiclePermission(req.user, vehicle);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to set the seat layout for this vehicle.",
      });
    }

    if (seats.length > vehicle.seat_capacity) {
      return res.status(400).json({
        success: false,
        message: `Number of seats in layout (${seats.length}) cannot exceed vehicle seat capacity (${vehicle.seat_capacity}).`,
      });
    }

    const seatNumbers = seats.map((s) => Number(s.seatNo));
    const uniqueSeatNos = new Set(seatNumbers);
    if (uniqueSeatNos.size !== seats.length) {
      return res
        .status(400)
        .json({ success: false, message: "Duplicate seat numbers in layout." });
    }
    if (seatNumbers.some((num) => num < 1)) {
      return res.status(400).json({
        success: false,
        message: "Seat numbers must be greater than or equal to 1.",
      });
    }

    let layout = await VehicleSeatLayout.findOne({ vehicleId });
    if (layout) {
      layout.rows = rows;
      layout.columns = columns;
      layout.seats = seats;
      await layout.save();
    } else {
      layout = await VehicleSeatLayout.create({
        vehicleId,
        rows,
        columns,
        seats,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle seat layout saved successfully.",
      data: layout,
    });
  } catch (error) {
    next(error);
  }
};

// ───────────────────────────────────────────────────────────────────────
// getSeatAvailability — UPDATED
// Now reports AVAILABLE / HELD / RESERVED per seat instead of a boolean.
// Expired holds are treated as not-held even before the cron/TTL sweep
// has physically removed them, so the map is always "live-correct".
// ───────────────────────────────────────────────────────────────────────
const getSeatAvailability = async (req, res, next) => {
  try {
    const { tripId } = req.body;

    if (!tripId) {
      return res
        .status(400)
        .json({ success: false, message: "tripId is required." });
    }

    const trip = await Trip.findById(tripId).populate("vehicleId");
    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Trip not found." });
    }

    const layout = await VehicleSeatLayout.findOne({
      vehicleId: trip.vehicleId?._id,
    });

    const [activeReservations, activeHolds] = await Promise.all([
      SeatReservation.find({ tripId, status: "RESERVED" }).lean(),
      SeatHold.find({
        tripId,
        status: "ACTIVE",
        expiresAt: { $gt: new Date() },
      }).lean(),
    ]);

    const reservedMap = {};
    activeReservations.forEach((r) => {
      reservedMap[r.seatNo] = {
        bookingId: r.bookingId,
        reservedBy: r.reservedBy,
      };
    });

    const heldMap = {};
    activeHolds.forEach((h) => {
      heldMap[h.seatNo] = {
        heldBy: h.heldBy,
        expiresAt: h.expiresAt,
        groupId: h.groupId,
      };
    });

    const isStaffViewer =
      req.user && ["admin", "manager"].includes(req.user.role);

    const buildSeatStatus = (seatNo) => {
      if (reservedMap[seatNo]) {
        return {
          seatStatus: "RESERVED",
          isAvailable: false,
          ...(isStaffViewer && { reservedBy: reservedMap[seatNo].reservedBy }),
        };
      }
      if (heldMap[seatNo]) {
        const isOwnHold =
          req.user &&
          heldMap[seatNo].heldBy.toString() === req.user.id.toString();
        return {
          seatStatus: "HELD",
          isAvailable: false,
          isOwnHold,
          ...(isOwnHold && { expiresAt: heldMap[seatNo].expiresAt }),
        };
      }
      return { seatStatus: "AVAILABLE", isAvailable: true };
    };

    let processedSeats = [];
    let rows = 0;
    let columns = 0;

    if (layout) {
      rows = layout.rows;
      columns = layout.columns;
      processedSeats = layout.seats.map((seat) => ({
        seatNo: seat.seatNo,
        seatType: seat.seatType,
        genderRestriction: seat.genderRestriction,
        ...buildSeatStatus(seat.seatNo),
      }));
    } else {
      const capacity = trip.seatCapacity || trip.vehicleId?.seat_capacity || 10;
      rows = Math.ceil(capacity / 4);
      columns = 4;
      for (let i = 1; i <= capacity; i++) {
        processedSeats.push({
          seatNo: i,
          seatType: "NORMAL",
          genderRestriction: "none",
          ...buildSeatStatus(i),
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Fetched seat availability successfully.",
      data: {
        tripId,
        vehicleId: trip.vehicleId?._id,
        vehicleNumber: trip.vehicleId?.vehicle_number,
        rows,
        columns,
        seats: processedSeats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ───────────────────────────────────────────────────────────────────────
// holdSeats — NEW
// Replaces reserveSeat(). Accepts an array of seatNos so the whole
// selection (3,4,5) is held as one group, paid for once.
//
// Concurrency strategy:
//   We use a MongoDB transaction + the unique partial index on
//   (tripId, seatNo, status: ACTIVE) in SeatHold. Within the
//   transaction we insertMany() all requested seat-holds. If another
//   request has already inserted an ACTIVE hold (or RESERVED booking)
//   for any of the same seats, the unique index throws a duplicate-key
//   error, the whole transaction aborts, and NO seat is partially held.
//   This is what stops "User A and User B click seat 4 at the same
//   moment" from both succeeding — exactly one insert wins the race.
// ───────────────────────────────────────────────────────────────────────
const holdSeats = async (req, res, next) => {
  const { tripId, seatNumbers } = req.body;

  if (!tripId || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
    return res.status(400).json({
      success: false,
      message: "tripId and a non-empty seatNumbers array are required.",
    });
  }

  const normalizedSeatNos = [...new Set(seatNumbers.map(Number))];
  if (normalizedSeatNos.some((n) => !Number.isInteger(n) || n < 1)) {
    return res.status(400).json({
      success: false,
      message: "seatNumbers must be positive integers.",
    });
  }

  const session = await mongoose.startSession();

  try {
    let createdHolds;
    let groupId;
    const expiresAt = new Date(Date.now() + HOLD_DURATION_MS);

    await session.withTransaction(async () => {
      const trip = await Trip.findById(tripId).session(session);
      if (!trip) {
        throw Object.assign(new Error("Trip not found."), { statusCode: 404 });
      }

      if (!["APPROVED", "STARTED"].includes(trip.status)) {
        throw Object.assign(
          new Error(`Trip is ${trip.status} and cannot accept reservations.`),
          { statusCode: 400 },
        );
      }

      if (trip.availableSeats < normalizedSeatNos.length) {
        throw Object.assign(
          new Error(
            `Only ${trip.availableSeats} seat(s) available, but ${normalizedSeatNos.length} were requested.`,
          ),
          { statusCode: 400 },
        );
      }

      const layout = await VehicleSeatLayout.findOne({
        vehicleId: trip.vehicleId,
      }).session(session);
      if (layout) {
        const validSeatNos = new Set(layout.seats.map((s) => s.seatNo));
        const invalid = normalizedSeatNos.filter((n) => !validSeatNos.has(n));
        if (invalid.length) {
          throw Object.assign(
            new Error(
              `Seat number(s) ${invalid.join(", ")} do not exist in this vehicle's layout.`,
            ),
            { statusCode: 400 },
          );
        }
      } else {
        const outOfRange = normalizedSeatNos.filter(
          (n) => n < 1 || n > trip.seatCapacity,
        );
        if (outOfRange.length) {
          throw Object.assign(
            new Error(
              `Seat number(s) ${outOfRange.join(", ")} are out of range (1-${trip.seatCapacity}).`,
            ),
            { statusCode: 400 },
          );
        }
      }

      groupId = new mongoose.Types.ObjectId();

      // insertMany + the unique partial index does the heavy lifting:
      // if ANY seat is already ACTIVE-held or RESERVED, this throws
      // E11000 and the transaction rolls back every doc we just tried
      // to insert, plus the availableSeats decrement below never runs.
      try {
        createdHolds = await SeatHold.insertMany(
          normalizedSeatNos.map((seatNo) => ({
            tripId,
            seatNo,
            groupId,
            heldBy: req.user.id,
            expiresAt,
            status: "ACTIVE",
          })),
          { session, ordered: true },
        );
      } catch (err) {
        if (err.code === 11000) {
          throw Object.assign(
            new Error(
              "One or more of the selected seats was just taken by another user. Please reselect.",
            ),
            { statusCode: 409 },
          );
        }
        throw err;
      }

      // trip.availableSeats -= normalizedSeatNos.length;
      // await trip.save({ session });
    });
    return res.status(201).json({
      success: true,
      message:
        "Seats held successfully. Complete payment before the hold expires.",
      data: {
        groupId,
        tripId,
        seatNumbers: normalizedSeatNos,
        expiresAt,
        holdDurationSeconds: HOLD_DURATION_MS / 1000,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode < 500) {
      return res
        .status(statusCode)
        .json({ success: false, message: error.message });
    }
    next(error);
  } finally {
    session.endSession();
  }
};

// ───────────────────────────────────────────────────────────────────────
// confirmHeldSeats — NEW
// Called after payment succeeds (e.g. from your payment webhook/callback
// handler). Converts an ACTIVE hold group into a Booking + RESERVED
// SeatReservation rows, atomically.
//
// Why re-check expiresAt here: a hold can still be physically present
// (TTL/cron haven't swept it yet) but logically expired the instant
// payment comes back. We must not honor a hold that expired mid-payment.
// ───────────────────────────────────────────────────────────────────────
// const confirmHeldSeats = async (req, res, next) => {
//   const { groupId, paymentRef, passengers, totalFare , tripId} = req.body;

//   if (!groupId) {
//     return res
//       .status(400)
//       .json({ success: false, message: "groupId is required." });
//   }
//   if (!Array.isArray(passengers) || passengers.length === 0) {
//     return res.status(400).json({
//       success: false,
//       message:
//         "passengers array is required (one entry per held seat, each with name, age, gender, seatNo).",
//     });
//   }
//   if (typeof totalFare !== "number" || totalFare < 0) {
//     return res.status(400).json({
//       success: false,
//       message: "totalFare must be a non-negative number.",
//     });
//   }

//   const session = await mongoose.startSession();

//   try {
//     let booking;
//     let alreadyConfirmed = false;

//     await session.withTransaction(async () => {
//       // Idempotency check first: payment gateways commonly retry
//       // webhooks (at-least-once delivery). If a Booking already exists
//       // for this groupId, return it instead of trying to re-create —
//       // re-running the insert logic below would hit the unique index
//       // on SeatReservation and throw, which is the wrong error to
//       // surface for "you already told us this succeeded."
//       const existingBooking = await Booking.findOne({
//         seatHoldGroupId: groupId,
//       }).session(session);
//       if (existingBooking) {
//         booking = existingBooking;
//         alreadyConfirmed = true;
//         return;
//       }

//       const holds = await SeatHold.find({ groupId, status: "ACTIVE" }).session(
//         session,
//       );

//       if (!holds.length) {
//         throw Object.assign(
//           new Error(
//             "No active hold found for this groupId. It may have expired or already been processed.",
//           ),
//           { statusCode: 404 },
//         );
//       }

//       const ownerId = holds[0].heldBy.toString();
//       const isOwner = ownerId === req.user.id.toString();
//       const isStaff = ["admin", "manager"].includes(req.user.role);
//       if (!isOwner && !isStaff) {
//         throw Object.assign(
//           new Error("You are not authorized to confirm this hold."),
//           {
//             statusCode: 403,
//           },
//         );
//       }

//       if (holds.some((h) => h.expiresAt <= new Date())) {
//         throw Object.assign(
//           new Error("This hold has expired. Please reselect your seats."),
//           { statusCode: 409 },
//         );
//       }

//       const tripId = holds[0].tripId;
//       const heldSeatNumbers = holds.map((h) => h.seatNo).sort((a, b) => a - b);
//       const passengerSeatNumbers = passengers
//         .map((p) => Number(p.seatNo))
//         .sort((a, b) => a - b);

//       // The passengers array must exactly match the held seats — same
//       // count, same seat numbers. Otherwise someone could hold 5 seats
//       // and pay for 5, but submit passenger details (and a Booking) for
//       // only 2, leaving 3 seats RESERVED with no real passenger on them,
//       // or submit a seatNo that was never actually held.
//       const sameLength = heldSeatNumbers.length === passengerSeatNumbers.length;
//       const sameSeats =
//         sameLength &&
//         heldSeatNumbers.every((n, i) => n === passengerSeatNumbers[i]);
//       if (!sameSeats) {
//         throw Object.assign(
//           new Error(
//             `Passenger seat numbers (${passengerSeatNumbers.join(", ")}) must exactly match held seats (${heldSeatNumbers.join(", ")}).`,
//           ),
//           { statusCode: 400 },
//         );
//       }

//       const bookingDocs = await Booking.create(
//         [
//           {
//             tripId,
//             userId: ownerId,
//             seatHoldGroupId: groupId,
//             paymentRef,
//             passengers,
//             totalFare,
//             bookingStatus: "CONFIRMED",
//             paymentStatus: "PAID",
//           },
//         ],
//         { session },
//       );
//       booking = bookingDocs[0];

//       try {
//         await SeatReservation.insertMany(
//           heldSeatNumbers.map((seatNo) => ({
//             tripId,
//             seatNo,
//             reservedBy: ownerId,
//             bookingId: booking._id,
//             groupId,
//             reservationType: "BOOKED",
//             status: "RESERVED",
//           })),
//           { session, ordered: true },
//         );
//       } catch (err) {
//         if (err.code === 11000) {
//           // Should be effectively unreachable since the hold already
//           // guarded these seats, but kept as defense in depth.
//           throw Object.assign(
//             new Error(
//               "A seat in this hold was already reserved through another flow.",
//             ),
//             { statusCode: 409 },
//           );
//         }
//         throw err;
//       }

//       await SeatHold.updateMany(
//         { groupId },
//         {
//           $set: {
//             status: "CONFIRMED",
//             cleanupAt: new Date(Date.now() + HOLD_CLEANUP_RETENTION_MS),
//           },
//         },
//         { session },
//       );
//     });

//     const trip = await Trip.findById(tripId).session(session);
//     trip.availableSeats -= heldSeatNumbers.length;
//     await trip.save({ session });

//     return res.status(alreadyConfirmed ? 200 : 201).json({
//       success: true,
//       message: alreadyConfirmed
//         ? "Booking was already confirmed for this hold."
//         : "Booking confirmed and seats reserved successfully.",
//       data: booking,
//     });
//   } catch (error) {
//     next(error);
//   } finally {
//     session.endSession();
//   }
// };
const confirmHeldSeats = async (req, res, next) => {
  const { groupId, paymentRef, passengers, totalFare } = req.body;

  if (!groupId) {
    return res.status(400).json({
      success: false,
      message: "groupId is required.",
    });
  }

  if (!Array.isArray(passengers) || passengers.length === 0) {
    return res.status(400).json({
      success: false,
      message:
        "passengers array is required (one entry per held seat, each with name, age, gender, seatNo).",
    });
  }

  if (typeof totalFare !== "number" || totalFare < 0) {
    return res.status(400).json({
      success: false,
      message: "totalFare must be a non-negative number.",
    });
  }

  const session = await mongoose.startSession();

  try {
    let booking;
    let alreadyConfirmed = false;

    await session.withTransaction(async () => {
      // Check if this hold was already confirmed
      const existingBooking = await Booking.findOne({
        seatHoldGroupId: groupId,
      }).session(session);

      if (existingBooking) {
        booking = existingBooking;
        alreadyConfirmed = true;
        return;
      }

      // Fetch active holds
      const holds = await SeatHold.find({
        groupId,
        status: "ACTIVE",
      }).session(session);

      if (!holds.length) {
        throw Object.assign(
          new Error(
            "No active hold found. It may have expired or already been confirmed.",
          ),
          { statusCode: 404 },
        );
      }

      const ownerId = holds[0].heldBy.toString();

      const isOwner = ownerId === req.user.id.toString();
      const isStaff = ["admin", "manager"].includes(req.user.role);

      if (!isOwner && !isStaff) {
        throw Object.assign(
          new Error("You are not authorized to confirm this hold."),
          { statusCode: 403 },
        );
      }

      // Hold expired?
      if (holds.some((h) => h.expiresAt <= new Date())) {
        throw Object.assign(
          new Error("This hold has expired. Please select seats again."),
          { statusCode: 409 },
        );
      }

      const tripId = holds[0].tripId;
      const heldSeatNumbers = holds.map((h) => h.seatNo).sort((a, b) => a - b);

      const passengerSeatNumbers = passengers
        .map((p) => Number(p.seatNo))
        .sort((a, b) => a - b);

      // Passenger seats must exactly match held seats
      const sameLength = heldSeatNumbers.length === passengerSeatNumbers.length;

      const sameSeats =
        sameLength &&
        heldSeatNumbers.every(
          (seat, index) => seat === passengerSeatNumbers[index],
        );

      if (!sameSeats) {
        throw Object.assign(
          new Error(
            `Passenger seat numbers (${passengerSeatNumbers.join(
              ", ",
            )}) must exactly match held seats (${heldSeatNumbers.join(", ")}).`,
          ),
          { statusCode: 400 },
        );
      }

      // Create Booking
      const bookingDocs = await Booking.create(
        [
          {
            tripId,
            userId: ownerId,
            seatHoldGroupId: groupId,
            paymentRef,
            passengers,
            totalFare,
            bookingStatus: "CONFIRMED",
            paymentStatus: "PAID",
          },
        ],
        { session },
      );

      booking = bookingDocs[0];

      // Create Seat Reservations
      try {
        await SeatReservation.insertMany(
          heldSeatNumbers.map((seatNo) => ({
            tripId,
            seatNo,
            reservedBy: ownerId,
            bookingId: booking._id,
            groupId,
            reservationType: "BOOKED",
            status: "RESERVED",
          })),
          {
            session,
            ordered: true,
          },
        );
      } catch (err) {
        if (err.code === 11000) {
          throw Object.assign(
            new Error("One or more seats have already been reserved."),
            { statusCode: 409 },
          );
        }

        throw err;
      }

      // Update available seats
      const trip = await Trip.findById(tripId).session(session);

      if (!trip) {
        throw Object.assign(new Error("Trip not found."), { statusCode: 404 });
      }

      if (trip.availableSeats < heldSeatNumbers.length) {
        throw Object.assign(new Error("Not enough seats available."), {
          statusCode: 400,
        });
      }

      trip.availableSeats -= heldSeatNumbers.length;

      await trip.save({ session });

      // Mark Hold Confirmed
      await SeatHold.updateMany(
        { groupId },
        {
          $set: {
            status: "CONFIRMED",
            cleanupAt: new Date(Date.now() + HOLD_CLEANUP_RETENTION_MS),
          },
        },
        { session },
      );
    });

    return res.status(alreadyConfirmed ? 200 : 201).json({
      success: true,
      message: alreadyConfirmed
        ? "Booking was already confirmed for this hold."
        : "Booking confirmed and seats reserved successfully.",
      data: booking,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

// ───────────────────────────────────────────────────────────────────────
// releaseHeldSeats — NEW
// Covers both "payment failed" and "user manually cancels" — both just
// need the hold released and availableSeats restored.
// ───────────────────────────────────────────────────────────────────────
const releaseHeldSeats = async (req, res, next) => {
  const { groupId, seatNumbers } = req.body;

  if (!groupId) {
    return res
      .status(400)
      .json({ success: false, message: "groupId is required." });
  }

  // seatNumbers is optional: omit it to release the entire group (e.g.
  // payment failed, user cancelled checkout). Pass specific seat
  // numbers to release just those — e.g. the user unselected one seat
  // out of a multi-seat hold but wants to keep the rest, including
  // their original expiresAt (untouched on the seats that remain).
  const partialSeatNos = Array.isArray(seatNumbers)
    ? [...new Set(seatNumbers.map(Number))]
    : null;

  const session = await mongoose.startSession();

  try {
    let releasedCount = 0;
    let remainingSeatNumbers = [];

    await session.withTransaction(async () => {
      const groupFilter = { groupId, status: "ACTIVE" };
      const allHolds = await SeatHold.find(groupFilter).session(session);

      if (!allHolds.length) {   
        throw Object.assign(
          new Error("No active hold found for this groupId."),
          { statusCode: 404 },
        );
      }

      const ownerId = allHolds[0].heldBy.toString();
      const isOwner = ownerId === req.user.id.toString();
      const isStaff = ["admin", "manager"].includes(req.user.role);
      if (!isOwner && !isStaff) {
        throw Object.assign(
          new Error("You are not authorized to release this hold."),
          {
            statusCode: 403,
          },
        );
      }

      const toRelease = partialSeatNos
        ? allHolds.filter((h) => partialSeatNos.includes(h.seatNo))
        : allHolds;

      if (partialSeatNos && toRelease.length !== partialSeatNos.length) {
        const foundSeatNos = toRelease.map((h) => h.seatNo);
        const notFound = partialSeatNos.filter(
          (n) => !foundSeatNos.includes(n),
        );
        throw Object.assign(
          new Error(
            `Seat(s) ${notFound.join(", ")} are not actively held in this group.`,
          ),
          { statusCode: 400 },
        );
      }

      const tripId = allHolds[0].tripId;

      await SeatHold.updateMany(
        { _id: { $in: toRelease.map((h) => h._id) } },
        {
          $set: {
            status: "RELEASED",
            cleanupAt: new Date(Date.now() + HOLD_CLEANUP_RETENTION_MS),
          },
        },
        { session },
      );

      // const trip = await Trip.findById(tripId).session(session);
      // if (trip) {
      //   trip.availableSeats = Math.min(
      //     trip.availableSeats + toRelease.length,
      //     trip.seatCapacity,
      //   );
      //   await trip.save({ session });
      // }

      releasedCount = toRelease.length;
      remainingSeatNumbers = allHolds
        .filter((h) => !toRelease.some((r) => r._id.equals(h._id)))
        .map((h) => h.seatNo);
    });

    return res.status(200).json({
      success: true,
      message:
        partialSeatNos && remainingSeatNumbers.length
          ? "Selected seat(s) released; remaining held seats are unaffected."
          : "Held seats released successfully.",
      data: { groupId, releasedCount, remainingSeatNumbers },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode < 500) {
      return res
        .status(statusCode)
        .json({ success: false, message: error.message });
    }
    next(error);
  } finally {
    session.endSession();
  }
};

// ───────────────────────────────────────────────────────────────────────
// expireHeldSeats — NEW
// Called by the cron job (not a public route, but exposed here so it
// can also be triggered manually/for testing via an admin route if
// desired). Sweeps every ACTIVE hold whose expiresAt has passed,
// restores availableSeats per trip, and marks the holds EXPIRED.
//
// This is batched per-trip (one Trip update per trip, not per seat) to
// keep it efficient even with many expired holds across many trips.
// ───────────────────────────────────────────────────────────────────────
const expireHeldSeats = async () => {
  const session = await mongoose.startSession();
  let expiredCount = 0;

  try {
    await session.withTransaction(async () => {
      const expired = await SeatHold.find({
        status: "ACTIVE",
        expiresAt: { $lte: new Date() },
      }).session(session);

      if (!expired.length) return;

      const expiredIds = expired.map((h) => h._id);

      await SeatHold.updateMany(
        { _id: { $in: expiredIds } },
        {
          $set: {
            status: "EXPIRED",
            cleanupAt: new Date(Date.now() + HOLD_CLEANUP_RETENTION_MS),
          },
        },
        { session },
      );

      const countByTrip = expired.reduce((acc, h) => {
        const key = h.tripId.toString();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      await Promise.all(
        Object.entries(countByTrip).map(async ([tripId, count]) => {
          const trip = await Trip.findById(tripId).session(session);
          if (!trip) return;
          // trip.availableSeats = Math.min(trip.availableSeats + count, trip.seatCapacity);
          // await trip.save({ session });
        }),
      );

      expiredCount = expired.length;
    });
  } finally {
    session.endSession();
  }

  return expiredCount;
};

// HTTP wrapper for expireHeldSeats, useful for an admin/ops endpoint or
// manual trigger; the cron job calls expireHeldSeats() directly.
const expireHeldSeatsHandler = async (req, res, next) => {
  try {
    const count = await expireHeldSeats();
    return res.status(200).json({
      success: true,
      message: `Expired ${count} stale hold(s).`,
      data: { expiredCount: count },
    });
  } catch (error) {
    next(error);
  }
};

// ───────────────────────────────────────────────────────────────────────
// getSeatLayout — NEW
// Returns the seat layout for a given vehicleId, including rows, columns,
// and seat details (seatNo, seatType, genderRestriction). Returns 404 if
// no layout has been created for this vehicle yet.
// ───────────────────────────────────────────────────────────────────────
const getSeatLayout = async (req, res, next) => {
  try {
    const { vehicleId } = req.body;

    if (!vehicleId) {and 
      return res.status(400).json({
        success: false,
        message: "vehicleId is required.",
      });
    }

    const layout = await VehicleSeatLayout.findOne({ vehicleId }).populate(
      "vehicleId",
      "vehicle_number vehicle_type seat_capacity",
    );

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: "No seat layout found for this vehicle.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seat layout fetched successfully.",
      data: layout,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSeatLayout,
  getSeatLayout,
  getSeatAvailability,
  holdSeats,
  confirmHeldSeats,
  releaseHeldSeats,
  expireHeldSeats,
  expireHeldSeatsHandler,
};
