// Run from backend dir: node scripts/seedTripLocation.js [tripId]
// Sets a trip's currentLocation to Mumbai so the Track map shows something.

require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.DATABASE_URL);
  console.log('Connected to MongoDB');

  const Trip = mongoose.model('Trip', new mongoose.Schema({}, { strict: false, collection: 'trips' }));

  const seedTripId = process.argv[2];
  let trip;
  if (seedTripId) {
    trip = await Trip.findById(seedTripId);
  } else {
    trip = await Trip.findOne({ status: { $in: ['STARTED', 'APPROVED', 'PENDING'] } }).sort({ createdAt: -1 });
  }

  if (!trip) {
    console.log('No trip found. Pass a trip ID as argument.');
    process.exit(1);
  }

  trip.currentLocation = {
    type: 'Point',
    coordinates: [76.7797143, 30.7334121], // [lng, lat]
  };
  await trip.save();

  console.log(`✅ Trip ${trip._id} (${trip.tripCode || 'no code'}) updated with Mohali location`);
  console.log(`   Status: ${trip.status}`);
  console.log('   Open frontend → Active Trips → click Track (crosshair) icon');

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
