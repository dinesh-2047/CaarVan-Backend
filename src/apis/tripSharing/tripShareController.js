const TripShare = require("./tripShareModel");
const { Trip } = require("../trip/tripModel");
const { v4: uuidv4 } = require("uuid");

exports.generateShareLink = async (req, res, next) => {
  try {
    const { tripId } = req.body;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "tripId is required",
      });
    }

    const trip = await Trip.findById(tripId).populate(
      "routeId",
      "source destination",
    );
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    if (!["APPROVED", "ACTIVE", "STARTED"].includes(trip.status)) {
      return res.status(400).json({
        success: false,
        message: "Only approved or active trips can be shared",
      });
    }

    let tripShare = await TripShare.findOne({ tripId });

    if (!tripShare) {
      const shareCode = uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase();
      tripShare = await TripShare.create({ tripId, shareCode });
    }

    const shareLink = `${process.env.FRONTEND_URL}/trips/share/${tripShare.shareCode}`;

    return res.status(200).json({
      success: true,
      message: "Share link generated successfully",
      data: {
        shareLink,
        shareCode: tripShare.shareCode,
        clicks: tripShare.clicks,
        trip: {
          tripCode: trip.tripCode,
          source: trip.routeId?.source,
          destination: trip.routeId?.destination,
          departureTime: trip.departureTime,
          fare: trip.fare,
          availableSeats: trip.availableSeats,
          category: trip.category?.name,
          status: trip.status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.trackLinkClick = async (req, res, next) => {
  try {
    const { shareCode } = req.body;

    if (!shareCode) {
      return res.status(400).json({
        success: false,
        message: "shareCode is required",
      });
    }

    const tripShare = await TripShare.findOneAndUpdate(
      { shareCode },
      { $inc: { clicks: 1 } },
      { new: true },
    ).populate({
      path: "tripId",
      select:
        "tripCode departureTime arrivalTime fare availableSeats status category isLadiesOnly",
      populate: {
        path: "routeId",
        select: "source destination checkpoints distance estimated_duration",
      },
    });

    if (!tripShare) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired share link",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Trip details fetched successfully",
      data: {
        clicks: tripShare.clicks,
        trip: tripShare.tripId,
      },
    });
  } catch (error) {
    next(error);
  }
};
