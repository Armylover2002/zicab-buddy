import { Navigate, Route } from 'react-router-dom';
import DriverLayout from '../modules/driver/components/DriverLayout';
import { getLocalDriverToken } from '../modules/driver/services/registrationService';
import {
  ActiveTrip,
  ApplicationStatus,
  Chat,
  DriverBankDetailsPage,
  DriverDeleteAccount,
  DriverDocuments,
  DriverHelpSupportOptions,
  DriverHome,
  DriverIncentives,
  DriverProfile,
  DriverSupportChat,
  DriverWallet,
  EditProfile,
  LegalPage,
  Notifications,
  OTPVerification,
  PhoneRegistration,
  PortalSupportPage,
  PayoutMethods,
  Referral,
  RegistrationStatus,
  RideRequests,
  RoleSelection,
  SecuritySOS,
  StepDocuments,
  StepPersonal,
  StepReferral,
  StepVehicle,
  SupportTicketDetail,
  SupportTickets,
  VehicleFleet,
} from './lazyPages';

export const DriverEntryRedirect = () => {
  const token = getLocalDriverToken();

  if (!token) {
    return <Navigate to="/taxi/driver/login" replace />;
  }

  return <Navigate to="/taxi/driver/home" replace />;
};

const driverRoutes = (
  <Route path="/taxi/driver" element={<DriverLayout />}>
    <Route index element={<DriverEntryRedirect />} />
    <Route path="lang-select" element={<Navigate to="/taxi/driver/login" replace />} />
    <Route path="welcome" element={<Navigate to="/taxi/driver/login" replace />} />
    <Route path="login" element={<PhoneRegistration />} />
    <Route path="terms" element={<LegalPage />} />
    <Route path="privacy" element={<LegalPage />} />
    <Route path="reg-phone" element={<Navigate to="/taxi/driver/login" replace />} />
    <Route path="otp-verify" element={<OTPVerification />} />
    <Route path="select-role" element={<RoleSelection />} />
    <Route path="step-personal" element={<StepPersonal />} />
    <Route path="step-referral" element={<StepReferral />} />
    <Route path="step-vehicle" element={<StepVehicle />} />
    <Route path="step-documents" element={<StepDocuments />} />
    <Route path="registration-status" element={<RegistrationStatus />} />
    <Route path="status" element={<ApplicationStatus />} />

    <Route path="home" element={<DriverHome />} />
    <Route path="dashboard" element={<DriverHome />} />
    <Route path="active-trip" element={<ActiveTrip />} />
    <Route path="chat" element={<Chat />} />
    <Route path="wallet" element={<DriverWallet />} />
    <Route path="profile" element={<DriverProfile />} />
    <Route path="profile/bank-details" element={<DriverBankDetailsPage />} />
    <Route path="history" element={<RideRequests />} />
    <Route path="incentives" element={<DriverIncentives />} />

    <Route path="edit-profile" element={<EditProfile />} />
    <Route path="documents" element={<DriverDocuments />} />
    <Route path="notifications" element={<Notifications />} />
    <Route path="payout-methods" element={<PayoutMethods />} />
    <Route path="referral" element={<Referral />} />
    <Route path="delete-account" element={<DriverDeleteAccount />} />
    <Route path="security" element={<SecuritySOS />} />
    <Route path="support" element={<PortalSupportPage />} />
    <Route path="help-support" element={<DriverHelpSupportOptions />} />
    <Route path="support/chat" element={<DriverSupportChat />} />
    <Route path="support/tickets" element={<SupportTickets />} />
    <Route path="support/ticket/:id" element={<SupportTicketDetail />} />
    <Route path="vehicle-fleet" element={<VehicleFleet />} />
    <Route path="vehicle-fleet/edit/:vehicleId" element={<VehicleFleet />} />
  </Route>
);

export default driverRoutes;
