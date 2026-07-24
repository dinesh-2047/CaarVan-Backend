const mongoose = require('mongoose');

const locationHistorySchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    speed:   { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
  },
  { timestamps: true }
);

locationHistorySchema.index({ location: '2dsphere' });

module.exports = mongoose.model('LocationHistory', locationHistorySchema);