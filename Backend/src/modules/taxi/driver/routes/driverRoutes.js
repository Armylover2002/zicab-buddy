import { Router } from "express";
import {
  buySubscription,
  getMySubscription,
  getMySubscriptionHistory,
} from "../controllers/driverSubscriptionController.js";
import { asyncHandler } from "../../../../utils/asyncHandler.js";
import { authenticate } from "../../middlewares/authMiddleware.js";
import { getPendingRideOffers } from "../controllers/rideOfferController.js";
import {
  loginRateLimit,
  otpSendRateLimit,
  otpVerifyRateLimit,
  paymentOrderRateLimit,
} from "../../middlewares/rateLimitMiddleware.js";
import {
  addDriverEmergencyContact,
  completeOnboarding,
  createDriverPaymentQr,
  getDriverPaymentUpi,
  saveDriverPaymentUpi,
  handleDriverRazorpayWalletTopupCallback,
  createDriverWithdrawalRequest,
  deleteCurrentDriverAccount,
  deleteDriverEmergencyContact,
  claimDriverIncentiveReward,
  goOffline,
  goOnline,
  getCurrentDriver,
  getDriverPaymentQrStatus,
  getDriverApprovalStatus,
  getDriverDocumentTemplates,
  getDriverVehicleFieldTemplates,
  getDriverEmergencyContacts,
  getDriverIncentives,
  getDriverNotifications,
  cancelDriverScheduledRide,
  getDriverScheduledRides,
  saveDriverFcmToken,
  getMyWallet,
  getOnboardingSession,
  getOnboardingSignupOptions,
  getServiceLocations,
  loginDriver,
  startDriverLoginOtpRequest,
  saveOnboardingDocuments,
  saveOnboardingRoleDetails,
  saveOnboardingRole,
  saveOnboardingPersonal,
  saveOnboardingReferral,
  saveOnboardingVehicle,
  verifyOnboardingLicenseDocument,
  verifyOnboardingVehicleRc,
  registerDriver,
  requestDriverAccountDeletion,
  startOnboarding,
  topUpMyWallet,
  createDriverWalletTopupOrder,
  createDriverPhonePeWalletTopupOrder,
  verifyDriverWalletTopup,
  verifyDriverPhonePeWalletTopup,
  verifyCurrentDriverBankDetails,
  verifyCurrentDriverBankDocument,
  verifyCurrentDriverUpiDetails,
  verifyCurrentDriverLicenseDocument,
  verifyCurrentDriverGstinDocument,
  verifyCurrentDriverPanDocument,
  verifyCurrentDriverRcDocument,
  updateCurrentDriver,
  updateDriverVehicle,
  verifyOnboardingOtp,
  verifyDriverLoginOtpRequest,
  updateCurrentDriverDocument,
} from "../controllers/driverController.js";
import { triggerDriverSosAlert } from '../../safety/controllers/safetyController.js';
import { listActiveSurges } from '../../services/surgeService.js';
import { Driver } from '../models/Driver.js';
import { getOpportunityMap } from '../../services/opportunityMapService.js';

export const driverRouter = Router();

driverRouter.post("/register", asyncHandler(registerDriver));
driverRouter.post("/login", loginRateLimit, asyncHandler(loginDriver));
driverRouter.post("/auth/send-otp", otpSendRateLimit, asyncHandler(startDriverLoginOtpRequest));
driverRouter.post(
  "/auth/verify-otp",
  otpVerifyRateLimit,
  asyncHandler(verifyDriverLoginOtpRequest),
);
// Offers dispatched to this driver that the socket may have missed. Polled by
// the app on reconnect and on every `ride_request` push, so a dropped socket
// no longer means a lost ride.
driverRouter.get(
  "/ride-offers",
  authenticate(["driver"]),
  asyncHandler(getPendingRideOffers),
);
driverRouter.get(
  "/me",
  authenticate(["driver"], { allowPending: true }),
  asyncHandler(getCurrentDriver),
);
driverRouter.patch(
  "/me",
  authenticate(["driver"]),
  asyncHandler(updateCurrentDriver),
);
driverRouter.post(
  "/me/bank-details/verify",
  authenticate(["driver"]),
  asyncHandler(verifyCurrentDriverBankDetails),
);
driverRouter.post(
  "/me/upi/verify",
  authenticate(["driver"]),
  asyncHandler(verifyCurrentDriverUpiDetails),
);
driverRouter.delete(
  "/me",
  authenticate(["driver"]),
  asyncHandler(deleteCurrentDriverAccount),
);
driverRouter.post(
  "/me/delete-request",
  authenticate(["driver"]),
  asyncHandler(requestDriverAccountDeletion),
);
driverRouter.post(
  "/sos",
  authenticate(["driver"]),
  asyncHandler(triggerDriverSosAlert),
);
driverRouter.get(
  "/emergency-contacts",
  authenticate(["driver"]),
  asyncHandler(getDriverEmergencyContacts),
);
driverRouter.post(
  "/emergency-contacts",
  authenticate(["driver"]),
  asyncHandler(addDriverEmergencyContact),
);
driverRouter.delete(
  "/emergency-contacts/:contactId",
  authenticate(["driver"]),
  asyncHandler(deleteDriverEmergencyContact),
);
driverRouter.patch(
  "/documents/:documentKey",
  authenticate(["driver"], { allowPending: true }),
  asyncHandler(updateCurrentDriverDocument),
);
driverRouter.post(
  "/documents/:documentKey/verify-license",
  authenticate(["driver"], { allowPending: true }),
  asyncHandler(verifyCurrentDriverLicenseDocument),
);
driverRouter.post(
  "/documents/:documentKey/verify-pan",
  authenticate(["driver"], { allowPending: true }),
  asyncHandler(verifyCurrentDriverPanDocument),
);
driverRouter.post(
  "/documents/:documentKey/verify-gst",
  authenticate(["driver"], { allowPending: true }),
  asyncHandler(verifyCurrentDriverGstinDocument),
);
driverRouter.post(
  "/documents/:documentKey/verify-rc",
  authenticate(["driver"], { allowPending: true }),
  asyncHandler(verifyCurrentDriverRcDocument),
);
driverRouter.post(
  "/documents/:documentKey/verify-bank",
  authenticate(["driver"], { allowPending: true }),
  asyncHandler(verifyCurrentDriverBankDocument),
);
driverRouter.get(
  "/notifications",
  authenticate(["driver"]),
  asyncHandler(getDriverNotifications),
);
driverRouter.get(
  "/scheduled-rides",
  authenticate(["driver"]),
  asyncHandler(getDriverScheduledRides),
);
driverRouter.post(
  "/scheduled-rides/:rideId/cancel",
  authenticate(["driver"]),
  asyncHandler(cancelDriverScheduledRide),
);
driverRouter.post(
  "/fcm-token",
  authenticate(["driver"], { allowPending: true }),
  asyncHandler(saveDriverFcmToken),
);
driverRouter.get(
  "/wallet",
  authenticate(["driver"]),
  asyncHandler(getMyWallet),
);
driverRouter.get(
  "/incentives",
  authenticate(["driver"]),
  asyncHandler(getDriverIncentives),
);
driverRouter.post(
  "/incentives/claim",
  authenticate(["driver"]),
  asyncHandler(claimDriverIncentiveReward),
);
driverRouter.post(
  "/wallet/top-up",
  authenticate(["driver"]),
  asyncHandler(topUpMyWallet),
);
driverRouter.post(
  "/wallet/top-up/razorpay/callback",
  asyncHandler(handleDriverRazorpayWalletTopupCallback),
);
driverRouter.get(
  "/wallet/top-up/razorpay/callback",
  asyncHandler(handleDriverRazorpayWalletTopupCallback),
);
driverRouter.post(
    "/wallet/top-up/razorpay/order",
    authenticate(["driver"]),
    paymentOrderRateLimit,
    asyncHandler(createDriverWalletTopupOrder),
);
driverRouter.post(
    "/wallet/top-up/phonepe/order",
    authenticate(["driver"]),
    paymentOrderRateLimit,
    asyncHandler(createDriverPhonePeWalletTopupOrder),
);
  driverRouter.post(
    "/wallet/top-up/razorpay/verify",
    authenticate(["driver"]),
    asyncHandler(verifyDriverWalletTopup),
  );
  driverRouter.get(
    "/wallet/top-up/phonepe/status/:merchantTransactionId",
    authenticate(["driver"]),
    asyncHandler(verifyDriverPhonePeWalletTopup),
  );
driverRouter.post(
  "/wallet/withdrawals",
  authenticate(["driver"]),
  asyncHandler(createDriverWithdrawalRequest),
);

driverRouter.get(
  "/me/payment-upi",
  authenticate(["driver"]),
  asyncHandler(getDriverPaymentUpi),
);
driverRouter.patch(
  "/me/payment-upi",
  authenticate(["driver"]),
  asyncHandler(saveDriverPaymentUpi),
);
driverRouter.post(
  "/payments/qr",
  authenticate(["driver"]),
  asyncHandler(createDriverPaymentQr),
);
driverRouter.get(
  "/payments/qr/status",
  authenticate(["driver"]),
  asyncHandler(getDriverPaymentQrStatus),
);
driverRouter.patch(
  "/vehicle",
  authenticate(["driver"]),
  asyncHandler(updateDriverVehicle),
);
driverRouter.get("/approval-status", asyncHandler(getDriverApprovalStatus));
driverRouter.get("/service-locations", asyncHandler(getServiceLocations));
driverRouter.get(
  "/document-templates",
  asyncHandler(getDriverDocumentTemplates),
);
driverRouter.get(
  "/vehicle-field-templates",
  asyncHandler(getDriverVehicleFieldTemplates),
);
// Limited like every other OTP route. These two were not: anyone could send
// unlimited SMS (each one paid for), and guess the 4-digit code with no cap.
driverRouter.post("/onboarding/send-otp", otpSendRateLimit, asyncHandler(startOnboarding));
driverRouter.post("/onboarding/verify-otp", otpVerifyRateLimit, asyncHandler(verifyOnboardingOtp));
driverRouter.patch("/onboarding/role", asyncHandler(saveOnboardingRole));
driverRouter.get("/onboarding/signup-options", asyncHandler(getOnboardingSignupOptions));
driverRouter.patch("/onboarding/role-details", asyncHandler(saveOnboardingRoleDetails));
driverRouter.patch(
  "/onboarding/personal",
  asyncHandler(saveOnboardingPersonal),
);
driverRouter.patch(
  "/onboarding/referral",
  asyncHandler(saveOnboardingReferral),
);
driverRouter.patch("/onboarding/vehicle", asyncHandler(saveOnboardingVehicle));
driverRouter.post("/onboarding/vehicle/verify-rc", asyncHandler(verifyOnboardingVehicleRc));
driverRouter.post(
  "/onboarding/documents/:documentKey/verify-license",
  asyncHandler(verifyOnboardingLicenseDocument),
);
driverRouter.patch(
  "/onboarding/documents",
  asyncHandler(saveOnboardingDocuments),
);
driverRouter.post("/onboarding/complete", asyncHandler(completeOnboarding));
driverRouter.get(
  "/onboarding/session/:registrationId",
  asyncHandler(getOnboardingSession),
);
// The daily pass: what it costs, buying it, and what has been paid before.
driverRouter.get("/subscription", authenticate(["driver"]), asyncHandler(getMySubscription));
driverRouter.post("/subscription/purchase", authenticate(["driver"]), asyncHandler(buySubscription));
driverRouter.get("/subscription/history", authenticate(["driver"]), asyncHandler(getMySubscriptionHistory));

driverRouter.patch("/online", authenticate(["driver"]), asyncHandler(goOnline));
// Surge hexagons near the driver, for the "Surge Fare Area" map: each carries
// its outline, multiplier and minutes left, so the app can draw it without H3.
driverRouter.get(
  "/surge-map",
  authenticate(["driver"]),
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat ?? req.query.latitude);
    const lng = Number(req.query.lng ?? req.query.longitude);
    const radiusKm = Math.min(50, Math.max(1, Number(req.query.radius_km) || 15));
    // Surge is set per vehicle type: show the driver their own vehicles'.
    const driver = await Driver.findById(req.auth.sub).select("vehicleTypeId vehicleTypeIds").lean();
    const vehicleTypeIds = [driver?.vehicleTypeId, ...(driver?.vehicleTypeIds || [])].filter(Boolean).map(String);
    const results = await listActiveSurges({ lat, lng, radiusKm, vehicleTypeIds });
    res.json({ success: true, data: { results, refreshed_at: new Date().toISOString() } });
  }),
);
// The surge & demand map: surging and busy hexagons near the driver, the best
// few places to go with what a trip pays there, and airport demand. Read-only
// over what the surge engine already computed - looking never moves a price.
// Contract: docs/surge-heatmap-implementation.md in the driver app repo.
driverRouter.get(
  "/opportunity-map",
  authenticate(["driver"]),
  asyncHandler(async (req, res) => {
    const data = await getOpportunityMap({
      driverId: req.auth?.sub,
      lat: req.query.lat ?? req.query.latitude,
      lng: req.query.lng ?? req.query.longitude,
      radiusKm: req.query.radius_km,
    });
    res.json({ success: true, data });
  }),
);
driverRouter.patch(
  "/offline",
  authenticate(["driver"]),
  asyncHandler(goOffline),
);
