// const crypto = require("crypto");

// const isDummyMode =
//   !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET;

// const dummyRazorpay = {
//   orders: {
//     create: async ({ amount, currency, receipt }) => {
//       // Fakes what Razorpay's API would return
//       return {
//         id: `order_dummy_${Date.now()}${Math.floor(Math.random() * 1000)}`,
//         amount,
//         currency,
//         receipt,
//         status: "created",
//       };
//     },
//   },
// };

// const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
//   if (isDummyMode) {
//     // Dummy rule: signature is valid if it equals `dummy_sig_<orderId>_<paymentId>`
//     const expected = `dummy_sig_${orderId}_${paymentId}`;
//     return signature === expected;
//   }
  
//   //  real razorpay verification
//   const body = `${orderId}|${paymentId}`;
//   const expectedSignature = crypto
//     .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//     .update(body)
//     .digest("hex");

//   return expectedSignature === signature;
// };

// /* --- real razorpay implementation part ---
// const Razorpay = require("razorpay");
 
// const razorpayInstance = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });
 
// module.exports = { razorpayInstance, verifyPaymentSignature, isDummyMode: false };
// */

// module.exports = {
//   razorpayInstance: dummyRazorpay,
//   verifyPaymentSignature,
//   isDummyMode,
// };



const crypto = require("crypto");
const Razorpay = require("razorpay");

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  const body = `${orderId}|${paymentId}`;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  return expectedSignature === signature;
};

module.exports = {
  razorpayInstance,
  verifyPaymentSignature,
};