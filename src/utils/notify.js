const Notification = require("../apis/notifications/notificationModel");
const User = require("../apis/user/userModel");
const admin = require("../config/firebase");

const notify = async ({
  userId,
  title,
  message,
  type = "INFO",
  metadata = {},
}) => {
  try {
    if (!userId) {
      console.warn("notify: userId is required to send a notification.");
      return null;
    }

    // store the notification in the database
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      metadata,
    });

    // query the user details to check for FCM/device token
    const user = await User.findById(userId).select("+fcmToken");

    if (user?.fcmToken) {
      const fcmMessage = {
        token: user.fcmToken,
        notification: {
          title,
          body: message,
        },
        data: {
          type,
          notificationId: notification._id.toString(),
          metadata: JSON.stringify(metadata),
        },
        android: {
          priority: "high",
        },
        apns: {
          payload: {
            aps: { sound: "default" },
          },
        },
      };

      await admin.messaging().send(fcmMessage);
      console.log(`FCM push sent to user ${userId}`);
    }

    return notification;
  } catch (error) {
    console.error("notify() error:", error.message);
    return null;
  }
};

module.exports = notify;