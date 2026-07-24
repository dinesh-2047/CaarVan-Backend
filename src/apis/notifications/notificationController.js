const Notification = require("./notificationModel");
const User = require("../user/userModel");

//  notifications for the authenticated user
const getUserNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 20;

    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalNotifications = await Notification.countDocuments(query);

    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully.",
      data: {
        notifications,
        pagination: {
          currentPage: page,
          pageSize: limit,
          total: totalNotifications,
          totalPages: Math.ceil(totalNotifications / limit),
          unread: unreadCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// mark a specific notification as read
const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "notificationId is required.",
      });
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      userId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// mark all notifications of the user as read
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { $set: { isRead: true } },
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// register FCM device token for the user
const registerFcmToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: "fcmToken is required.",
      });
    }

    // Remove the FCM token from any other user to prevent duplicate push deliveries
    await User.updateMany(
      { fcmToken, _id: { $ne: req.user.id } },
      { $unset: { fcmToken: 1 } }
    );

    await User.findByIdAndUpdate(req.user.id, { fcmToken }, { new: true });

    return res.status(200).json({
      success: true,
      message: "FCM token registered successfully.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  registerFcmToken,
};
