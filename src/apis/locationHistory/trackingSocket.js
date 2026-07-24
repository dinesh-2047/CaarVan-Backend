const jwt = require('jsonwebtoken');
const { Trip } = require('../trip/tripModel');
const LocationHistory = require('./locationHistoryModel');

const initTrackingSocket = (io) => {
   const trackingNS = io.of('/tracking');

  console.log('[Socket] Tracking namespace initialized'); 

  // Har socket connection pe JWT verify karo
  trackingNS.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized - token missing'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Unauthorized - invalid token'));
    }
  });

  trackingNS.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id} | User: ${socket.user.id}`);

    // ── Driver: trip room join karo ──────────────────────────────────
    socket.on('driver:join_trip', async ({ tripId }) => {
      try {
        const trip = await Trip.findOne({
          _id: tripId,
          driverId: socket.user.id,
          status: 'STARTED', // tumhara existing status
        });

        if (!trip) {
          return socket.emit('error', {
            message: 'Trip not found ya STARTED status mein nahi hai',
          });
        }

        socket.join(`trip:${tripId}`);
        socket.currentTripId = tripId; // disconnect ke liye save

        // Passengers ko batao driver online aa gaya
        socket.to(`trip:${tripId}`).emit('driver:online', {
          driverId: socket.user.id,
          tripId,
        });

        console.log(`[Socket] Driver ${socket.user.id} joined trip:${tripId}`);
      } catch (err) {
        console.error('[Socket] driver:join_trip error:', err.message);
        socket.emit('error', { message: 'Server error' });
      }
    });

    // ── Driver: location update bhejo ────────────────────────────────
    socket.on('driver:location_update', async ({ tripId, lat, lng, speed = 0, heading = 0 }) => {
      try {
        if (!tripId || lat == null || lng == null) {
          return socket.emit('error', {
            message: 'tripId, lat, lng required hain',
          });
        }

        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);

        if (isNaN(parsedLat) || isNaN(parsedLng)) {
          return socket.emit('error', { message: 'lat/lng valid numbers hone chahiye' });
        }

        const coordinates = [parsedLng, parsedLat]; // GeoJSON: [lng, lat]

        // 1. Trip ka currentLocation update karo
        await Trip.findByIdAndUpdate(tripId, {
          currentLocation: { type: 'Point', coordinates },
        });

        // 2. History mein save karo
        await LocationHistory.create({
          tripId,
          driverId: socket.user.id,
          location: { type: 'Point', coordinates },
          speed,
          heading,
        });

        // 3. Us trip ke baaki sab ko broadcast karo
        socket.to(`trip:${tripId}`).emit('driver:location', {
          tripId,
          lat: parsedLat,
          lng: parsedLng,
          speed,
          heading,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[Socket] driver:location_update error:', err.message);
        socket.emit('error', { message: 'Location update failed' });
      }
    });

    // ── Passenger: trip room join karo ───────────────────────────────
    socket.on('passenger:join_trip', async ({ tripId }) => {
      try {
        const trip = await Trip.findOne({
          _id: tripId,
          status: { $in: ['STARTED', 'APPROVED'] },
        }).select('status currentLocation driverId');

        if (!trip) {
          return socket.emit('error', { message: 'Trip not found' });
        }

        socket.join(`trip:${tripId}`);

        // Latest known location turant bhej do
        socket.emit('trip:current_location', {
          tripId,
          coordinates: trip.currentLocation?.coordinates ?? null,
          status: trip.status,
        });

        console.log(`[Socket] Passenger ${socket.user.id} joined trip:${tripId}`);
      } catch (err) {
        console.error('[Socket] passenger:join_trip error:', err.message);
        socket.emit('error', { message: 'Server error' });
      }
    });

    // ── Disconnect ───────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} | Reason: ${reason}`);

      if (socket.currentTripId) {
        socket.to(`trip:${socket.currentTripId}`).emit('driver:offline', {
          driverId: socket.user.id,
        });
      }
    });
  });
};

module.exports = initTrackingSocket;