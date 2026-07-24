const cron = require("node-cron");
const { expireHeldSeats } = require("../apis/seat/seatController");

/**
 * Runs every minute. Sweeps SeatHold documents whose expiresAt has
 * passed, marks them EXPIRED, and restores Trip.availableSeats.
 *
 * Why every minute and not every 10 minutes (the hold duration):
 * holds are created at arbitrary times, so expirations are spread out
 * continuously — we want seats freed up close to the moment they
 * actually expire, not in a once-per-10-minutes batch that would let
 * an already-expired seat block other users for up to 10 extra minutes.
 *
 * Relationship to the TTL index on SeatHold.expiresAt: the TTL index
 * is a backstop that guarantees documents get deleted even if this
 * cron job is down, but TTL sweeps only run roughly every 60s on
 * MongoDB's own schedule and — critically — TTL deletion does NOT
 * restore Trip.availableSeats. This cron job is what keeps
 * availableSeats accurate; the TTL index is what keeps the SeatHold
 * collection from accumulating garbage forever.
 */
const startSeatHoldExpiryCron = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const count = await expireHeldSeats();
      if (count > 0) {
        console.log(`[seat-hold-cron] Expired ${count} stale seat hold(s).`);
      }
    } catch (err) {
      console.error("[seat-hold-cron] Failed to expire stale seat holds:", err);
    }
  });
};

module.exports = { startSeatHoldExpiryCron };