const EmergencyModel = require("./sosModel.js");
const { getIO } = require("../../socket/socket.js");

exports.triggerSOS = async (req, res) => {
  try {
    const { tripId, userId, latitude, longitude, emergencyType, status } =
      req.body;

    /*const userId = req.user.Id;*/

    const exist = await EmergencyModel.findOne({
      tripId,
      userId,
      status: "ACTIVE",
    });

    if (exist) {
      console.log("A SOS alert already exists for this trip!");
      return res.status(400).json({
        message: "A SOS alert already exists for this trip!",
      });
    }

    const alert = await EmergencyModel.create({
      tripId,
      userId,
      latitude,
      longitude,
      emergencyType,
      status: "ACTIVE",
      locationHistory: [
        {
          latitude,
          longitude,
          timestamp: new Date(),
        },
      ],
    });

    const io = getIO();
    //This will broadcast the alert to the emergency dashboard and fire the event
    //sos_alert is the event name and alert is the data
    io.to("emergency-agents").emit("sos_alert", alert);

    console.log("SOS alert triggered successfully!");
    console.log(alert);
    return res.status(200).json({
      message: "SOS alert triggered successfully!",
      data: alert,
    });
  } catch (err) {
    console.log("Failed to trigger SOS alert! : ", err);
    return res.status(500).json({
      message: "Failed to trigger SOS alert!",
      err,
    });
  }
};

exports.shareLiveLocation = async (req, res) => {
  try {
    const { alertId, latitude, longitude } = req.body;

    const alert = await EmergencyModel.findById(alertId);

    if (!alert) {
      console.log("Alert does not exist!");
      return res.status(404).json({
        message: "Alert does not exist!",
      });
    }

    alert.latitude = latitude;
    alert.longitude = longitude;
    alert.locationHistory.push({
      latitude,
      longitude,
      timestamp: new Date(),
    });

    await alert.save();

    const io = getIO();

    io.to("emergency-agents").emit("location_update", {
      alertId,
      latitude,
      longitude,
      timestamp: new Date(),
    });

    console.log("Live location shared successfully!");
    return res.status(200).json({
      message: "Live location shared successfully!",
      data: alert,
    });
  } catch (err) {
    console.log("Error in sharing live location : ", err);
    res.status(500).json({
      message: "Error in sharing live location",
      err,
    });
  }
};

exports.closeSOS = async (req, res) => {
  try {
    const { alertId } = req.params;
    const alert = await EmergencyModel.findById(alertId);

    if (!alert) {
      console.log("Alert does not exists!");
      return res.status(404).json({
        message: "Alert does not exists!",
      });
    }

    alert.status = "RESOLVED";

    await alert.save();

    const io = getIO();
    (io.to("emergency-agents").emit("sos_close"), { alertId: alert._id });

    console.log("Alert Closed successfully!");
    return res.status(200).json({
      message: "Alert Closed successfully!",
    });
  } catch (err) {
    console.log("Alert does not exist!");
    return res.status(404).json({
      message: "Alert does not exist!",
    });
  }
};
