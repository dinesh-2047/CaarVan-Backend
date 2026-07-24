// const mongoose = require("mongoose");

// const seatLayoutSchema = new mongoose.Schema(
//   {
//     vehicleId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Vehicle",
//       required: true,
//       unique: true,
//     },
//     rows: {
//       type: Number,
//       required: true,
//       min: 1,
//     },
//     columns: {
//       type: Number,
//       required: true,
//       min: 1,
//     },
//     seats: [
//       {
//         seatNo: {
//           type: Number,
//           required: true,
//         },
//         seatType: {
//           type: String,
//           enum: [
//             "NORMAL",
//             "SAFE_RIDE",
//             "PINK_SEAT",
//             "CHILD_SEAT",
//             "RESERVED",
//             "VIP",
//           ],
//           default: "NORMAL",
//         },
//         genderRestriction: {
//           type: String,
//           enum: ["male", "female", "others", "none"],
//           default: "none",
//         },
//       },
//     ],
//   },
//   { timestamps: true },
// );

// const seatReservationSchema = new mongoose.Schema(
//   {
//     tripId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Trip",
//       required: true,
//     },
//     seatNo: {
//       type: Number,
//       required: true,
//     },
//     reservedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     bookingId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Booking",
//     },
//     reservationType: {
//       type: String,
//       enum: ["BOOKED", "TEMPORARY", "HOLD"],
//       default: "BOOKED",
//     },
//     status: {
//       type: String,
//       enum: ["RESERVED", "RELEASED"],
//       default: "RESERVED",
//     },
//   },
//   { timestamps: true },
// );

// seatReservationSchema.index(
//   { tripId: 1, seatNo: 1 },
//   { unique: true, partialFilterExpression: { status: "RESERVED" } },
// );

// const VehicleSeatLayout = mongoose.model("VehicleSeatLayout", seatLayoutSchema);
// const SeatReservation = mongoose.model(
//   "SeatReservation",
//   seatReservationSchema,
// );

// module.exports = {
//   VehicleSeatLayout,
//   SeatReservation,
// };


const mongoose = require("mongoose");

/**
 * ─────────────────────────────────────────────────────────────────────────
 * VehicleSeatLayout — UNCHANGED
 * ─────────────────────────────────────────────────────────────────────────
 */
const seatLayoutSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      unique: true,
    },
    rows: { type: Number, required: true, min: 1 },
    columns: { type: Number, required: true, min: 1 },
    seats: [
      {
        seatNo: { type: Number, required: true },
        seatType: {
          type: String,
          enum: [
            "NORMAL",
            "SAFE_RIDE",
            "PINK_SEAT",
            "CHILD_SEAT",
            "RESERVED",
            "VIP",
          ],
          default: "NORMAL",
        },
        genderRestriction: {
          type: String,
          enum: ["male", "female", "others", "none"],
          default: "none",
        },
      },
    ],
  },
  { timestamps: true },
);

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SeatHold — NEW
 *
 * Why a separate collection instead of cramming "HOLD" into SeatReservation:
 *
 * 1. Different lifecycle. A hold is inherently temporary and expiring;
 *    a reservation (post-payment) is permanent until cancelled. Mixing
 *    them in one collection means every query ("is this seat taken?")
 *    has to reason about TTL/expiry semantics that don't apply to real
 *    bookings, and vice versa.
 * 2. Different cardinality per action. One hold = many seats (a group of
 *    seats a single user is trying to book in one payment). Modeling
 *    "one hold per seat" (like the old approach did for reservations)
 *    makes it hard to expire/release a hold atomically as a group and
 *    hard to tie it to a single payment intent.
 * 3. TTL auto-expiry. MongoDB can auto-delete expired hold documents via
 *    a TTL index, which is a free, reliable backstop to the cron job
 *    (cron handles releasing the seats/restoring availableSeats "on time"
 *    for UX; TTL guarantees cleanup even if cron is delayed/down).
 * 4. Cleaner concurrency control. To prevent double-booking we take a
 *    unique index on (tripId, seatNo) for "the seat is currently
 *    unavailable" rows. Keeping holds in their own collection lets us
 *    enforce "no more than one ACTIVE hold per seat" independently of
 *    "no more than one RESERVED booking per seat", using two unique
 *    partial indexes instead of one increasingly complex one.
 */
const seatHoldSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    seatNo: {
      type: Number,
      required: true,
    },
    // groupId ties together every seat in the same hold session, so a
    // multi-seat selection (3,4,5) can be confirmed/released/expired
    // as one atomic unit while still being stored as one-doc-per-seat
    // (which is what lets the unique index stop double-holds per seat).
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    heldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "CONFIRMED", "RELEASED", "EXPIRED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

// Only one ACTIVE hold may exist per (tripId, seatNo) at a time.
// This is the primary concurrency guard for the hold step: if two
// users race to hold seat 4, the second insert throws E11000 and
// loses the race deterministically.
seatHoldSchema.index(
  { tripId: 1, seatNo: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" } },
);

// TTL safety net: MongoDB's background task sweeps documents roughly
// every 60s once `expiresAt` is in the past, deleting ACTIVE holds that
// the cron job missed (e.g. process restart). NOTE: TTL only deletes
// documents — it does NOT restore Trip.availableSeats — so the cron
// job remains the source of truth for "expire and restore", and this
// index is purely a guarantee that stale ACTIVE holds can never block
// a seat forever even if cron stops running.
seatHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SeatReservation — UPDATED
 *
 * Changes from the original:
 * - reservationType no longer needs "HOLD" (holds live in SeatHold now).
 *   It keeps "BOOKED" vs other types in case you support free/admin-block
 *   seats later, but the temporary-hold concept is fully removed from
 *   this collection. This keeps SeatReservation meaning exactly one
 *   thing: "this seat is paid/confirmed for this trip."
 * - bookingId is now required, since a SeatReservation should only ever
 *   be created at the moment a Booking is confirmed (post-payment).
 * - Added groupId (mirrors the hold's groupId) purely for traceability/
 *   audit — lets you find "all seats reserved together in one purchase"
 *   without joining through Booking if needed.
 * ─────────────────────────────────────────────────────────────────────────
 */
const seatReservationSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
    },
    seatNo: {
      type: Number,
      required: true,
    },
    reservedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    reservationType: {
      type: String,
      enum: ["BOOKED"],
      default: "BOOKED",
    },
    status: {
      type: String,
      enum: ["RESERVED", "RELEASED"],
      default: "RESERVED",
    },
  },
  { timestamps: true },
);

// Unchanged in spirit: only one RESERVED row per (tripId, seatNo).
// This is the second half of the concurrency guarantee — even though
// holds already prevent two users from holding the same seat, this
// index independently guarantees two bookings can never both confirm
// the same seat (defense in depth, e.g. against bugs/race conditions
// in the confirm step itself).
seatReservationSchema.index(
  { tripId: 1, seatNo: 1 },
  { unique: true, partialFilterExpression: { status: "RESERVED" } },
);

const VehicleSeatLayout = mongoose.model("VehicleSeatLayout", seatLayoutSchema);
const SeatHold = mongoose.model("SeatHold", seatHoldSchema);
const SeatReservation = mongoose.model("SeatReservation", seatReservationSchema);

module.exports = {
  VehicleSeatLayout,
  SeatHold,
  SeatReservation,
};