# Backend Changes — Booking Checkpoints + Driver Credentials Email + Trip Visibility Fix

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `src/apis/booking/bookingModel.js` | Added `boardingPoint` and `droppingPoint` fields |
| 2 | `src/apis/booking/bookingController.js` | Updated `createBooking` to accept & validate `boardingPoint`/`droppingPoint` |
| 3 | `src/apis/ticket/ticketModel.js` | Added `boardingPoint`/`droppingPoint` to `itinerarySchema` |
| 4 | `src/apis/ticket/ticketController.js` | Included boarding/dropping points in ticket itinerary + PDF |
| 5 | `src/apis/driver/driverController.js` | Added credential email to driver on registration |
| 6 | `src/apis/trip/tripController.js` | **FIXED** `getOwnerTrips` to include trips on owner's vehicles; **NEW** `getDriverTrips` endpoint; **ADDED** active-trip guard in `createTrip`; **FIXED** checkpoints parsing to accept single object / JSON string |
| 7 | `src/routes/driverRoutes.js` | **NEW** route for `getDriverTrips` |

---

### 1. bookingModel.js — Add boardingPoint / droppingPoint

```js
boardingPoint: {
  type: String,
  trim: true,
},

droppingPoint: {
  type: String,
  trim: true,
},
```

These store the city name from the trip's `checkpoints[]` where the customer wants to board and alight.

### 2. bookingController.js — Accept and validate checkpoints

**`createBooking`** now accepts `boardingPoint` and `droppingPoint` from `req.body`:

```js
const { tripId, passengers, boardingPoint, droppingPoint } = req.body;
```

Validation after trip lookup:
- Checks `boardingPoint` exists in `trip.checkpoints` (if provided)
- Checks `droppingPoint` exists in `trip.checkpoints` (if provided)
- Returns 400 with a descriptive message if invalid

Stored in the booking document:
```js
const booking = await Booking.create({
  ...
  ...(boardingPoint && { boardingPoint }),
  ...(droppingPoint && { droppingPoint }),
});
```

### 3. ticketModel.js — Add boarding/dropping to itinerary

```js
boardingPoint: { type: String, trim: true },
droppingPoint: { type: String, trim: true },
```

These capture a snapshot of the booking's boarding/dropping points at the time the ticket is generated.

### 4. ticketController.js — Include in itinerary + PDF

**`generateTicket`** — Falls back to the route's source/destination if checkpoints weren't selected:

```js
boardingPoint: booking.boardingPoint || trip.routeId?.source,
droppingPoint: booking.droppingPoint || trip.routeId?.destination,
```

**`downloadTicket` (PDF)** — Two new lines in the PDF output:
```
Board at: {boardingPoint}
Drop at: {droppingPoint}
```

---

### 5. driverController.js — Email credentials to driver on registration

**Change:** After the driver is created in `registerDriver`, an email is sent to the driver's email address with their login credentials.

- Imports `sendEmail` from `../../config/mailer`
- Sends an HTML email containing the driver's email and plain-text password
- Uses `.catch()` to silently handle email failures without blocking driver creation

---

### 6. tripController.js — Fix cross-visibility of trips between owners and drivers

#### Problem
- **Owner can't see driver-created trips:** `getOwnerTrips` filtered only by `{ createdBy: userId }`. When a driver creates a trip, `createdBy` is the driver's ID, so the owner's query missed it.
- **Driver can't see owner-created trips:** No endpoint existed to query trips by `driverId`. When an owner creates a trip for a driver, the driver had no way to fetch it.

#### Fix A — `getOwnerTrips` (modified)
Now builds an `$or` filter to return trips that were:
- Created by the user (`createdBy: userId`), **OR**
- On vehicles owned by the user (`vehicleId` is in the user's vehicle list)

```js
const ownerVehicles = await Vehicle.find({ user_id: userId }).select("_id");
const ownerVehicleIds = ownerVehicles.map((v) => v._id);

const filter = {
  $or: [
    { createdBy: userId },
    { vehicleId: { $in: ownerVehicleIds } },
  ],
};
```

Requires `Vehicle` model import at the top of the file.

#### Fix B — `getDriverTrips` (new function)
New endpoint that queries trips where `driverId = req.user.id`:

```js
exports.getDriverTrips = async (req, res, next) => {
  const filter = { driverId: req.user.id };
  const trips = await Trip.find(filter)
    .populate("routeId", "...")
    .populate("vehicleId", "...")
    .populate("createdBy", "name role")
    .sort({ createdAt: -1 });
  ...
};
```

### 7. driverRoutes.js — New route for driver trip fetching

Added to `/driver` prefix (protected by authMiddleware + roleMiddleware for "driver"/"owner"):

```js
router.post("/get-driver-trips", tripController.getDriverTrips);
```

### 8. tripController.js — Block new trip if driver already has an active one

**Problem:** A driver could create multiple overlapping trips, causing scheduling conflicts.

**Fix:** After verifying the driver exists, check for any existing trip with non-terminal status (`PENDING`, `APPROVED`, `STARTED`, `ACTIVE`) for the same driver:

```js
const activeStatuses = ["PENDING", "APPROVED", "STARTED", "ACTIVE"];
const existingActive = await Trip.findOne({
  driverId,
  status: { $in: activeStatuses },
});
if (existingActive) {
  return next(
    createError(
      `Driver already has an active trip (${existingActive.tripCode || existingActive._id}) in status "${existingActive.status}". Complete or cancel it before creating a new one.`,
      409,
    ),
  );
}
```

The check runs after driver existence/role validation but before trip creation, so it returns early with a 409 Conflict and a clear message identifying the existing trip.

### 9. tripController.js — Fix checkpoints parsing in `createTrip`

**Problem:** The driver panel sends `checkpoints` as a single JSON object (`{"city":"Gurugram",...}`) or a JSON string, while the backend only accepted an array. `Array.isArray()` returned `false`, so checkpoints were silently dropped — trip created without them.

**Fix:** Added flexible parsing that handles all input shapes:

```js
if (selectedCheckpoints) {
  // Parse string → object/array
  let parsed = selectedCheckpoints;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { parsed = null; }
  }
  // Normalise single object → array
  let cpArray = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
  // ... validate against route checkpoints ...
}
```

Supports:
- `checkpoints: [{"city":"Delhi",...}, {"city":"Agra",...}]` — array (was already working)
- `checkpoints: {"city":"Gurugram",...}` — single object (was silently dropped)
- `checkpoints: '{"city":"Gurugram",...}'` — JSON string from FormData (was silently dropped)

---

## How to Apply

Copy the files from `backend-changes/src/` to the corresponding paths in `src/`:

```
backend-changes/src/apis/booking/bookingModel.js       →  src/apis/booking/bookingModel.js
backend-changes/src/apis/booking/bookingController.js   →  src/apis/booking/bookingController.js
backend-changes/src/apis/ticket/ticketModel.js          →  src/apis/ticket/ticketModel.js
backend-changes/src/apis/ticket/ticketController.js     →  src/apis/ticket/ticketController.js
backend-changes/src/apis/driver/driverController.js     →  src/apis/driver/driverController.js
backend-changes/src/apis/trip/tripController.js         →  src/apis/trip/tripController.js
backend-changes/src/routes/driverRoutes.js              →  src/routes/driverRoutes.js
```
