import crypto from 'node:crypto';
import { ApiError } from '../../../../utils/ApiError.js';
import { env } from '../../../../config/env.js';
import { Driver } from '../models/Driver.js';
import { DriverLoginSession } from '../models/DriverLoginSession.js';
import { signAccessToken } from './authService.js';
import { sendOtpSms } from '../../services/smsService.js';
import { resolveDemoOtpForPhone } from '../../services/demoLoginService.js';

const LOGIN_OTP_TTL_MS = 10 * 60 * 1000;

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '').trim();
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

const buildPhoneCandidates = (phone) => {
  const normalizedPhone = normalizePhone(phone);
  const candidates = new Set();

  if (normalizedPhone) {
    candidates.add(normalizedPhone);
    candidates.add(`91${normalizedPhone}`);
    candidates.add(`+91${normalizedPhone}`);
  }

  return [...candidates];
};

const generateOtp = () => String(Math.floor(1000 + Math.random() * 9000));
const normalizeRole = () => 'driver';

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');
const getVisibleOtp = (otp) => (process.env.NODE_ENV !== 'production' ? String(otp) : null);
const isTruthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
const TEST_LOGIN_OTP_PHONE = '6268423925';
const TEST_LOGIN_OTP_CODE = '0000';
// Specific driver phones that always log in with a fixed OTP, independent of
// the single staticOtpPhone/Code env pair above - e.g. a number that can't
// reliably receive SMS.
const FIXED_OTP_BY_PHONE = {
  '7470311228': '1234',
};
const getStaticDriverOtpConfig = () => ({
  phone: normalizePhone(env.sms?.staticOtpPhone || TEST_LOGIN_OTP_PHONE),
  otp: String(env.sms?.staticOtpCode || TEST_LOGIN_OTP_CODE).trim(),
});
const resolveDriverLoginOtpForPhone = (phone) => {
  const normalizedPhone = normalizePhone(phone);
  const staticOtpConfig = getStaticDriverOtpConfig();
  const defaultOtpEnabled = isTruthy(env.sms?.useDefaultOtp);

  if (defaultOtpEnabled && staticOtpConfig.otp) {
    return {
      otp: staticOtpConfig.otp,
      isStatic: true,
    };
  }

  if (staticOtpConfig.phone && staticOtpConfig.otp && normalizedPhone === staticOtpConfig.phone) {
    return {
      otp: staticOtpConfig.otp,
      isStatic: true,
    };
  }

  if (FIXED_OTP_BY_PHONE[normalizedPhone]) {
    return {
      otp: FIXED_OTP_BY_PHONE[normalizedPhone],
      isStatic: true,
    };
  }

  // Review and demo numbers from DEMO_LOGIN_PHONES, shared with the rider app
  // so one number can open both for an app-store reviewer.
  const demoOtp = resolveDemoOtpForPhone(normalizedPhone);
  if (demoOtp) {
    return {
      otp: demoOtp,
      isStatic: true,
    };
  }

  return {
    otp: generateOtp(),
    isStatic: false,
  };
};

const getSession = async (phone) => {
  const session = await DriverLoginSession.findOne({ phone: normalizePhone(phone) }).select('+otpHash');

  if (!session) {
    throw new ApiError(404, 'Login session not found');
  }

  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    await DriverLoginSession.deleteOne({ _id: session._id });
    throw new ApiError(410, 'Login session expired');
  }

  return session;
};

const publicSessionPayload = (session, debugOtp = null) => ({
  phone: session.phone,
  status: 'otp_sent',
  debugOtp,
});

const publicDriverPayload = (driver) => ({
  id: driver._id,
  name: driver.name,
  phone: driver.phone,
  email: driver.email,
  gender: driver.gender,
  vehicleType: driver.vehicleType,
  registerFor: driver.registerFor,
  vehicleNumber: driver.vehicleNumber,
  vehicleColor: driver.vehicleColor,
  city: driver.city,
  approve: driver.approve,
  status: driver.status,
  rating: driver.rating,
  isOnline: driver.isOnline,
  isOnRide: driver.isOnRide,
});

const LOGIN_ROLE_PRIORITY = ['driver'];

const isApprovedDriver = (driver) =>
  Boolean(driver) &&
  driver.approve !== false &&
  String(driver.status || '').toLowerCase() !== 'pending';

export const findDriverPortalAccountByPhone = async ({ phone } = {}) => {
  const normalizedRole = 'driver';
  const phoneCandidates = buildPhoneCandidates(phone);

  if (!phoneCandidates.length) {
    return null;
  }

  const account = await Driver.findOne({ phone: { $in: phoneCandidates } });

  return account ? { role: normalizedRole, account } : null;
};

const buildDriverPortalExistenceQuery = (role, phoneCandidates) =>
  Driver.findOne({ phone: { $in: phoneCandidates } }).select('_id').lean();

export const findPreferredDriverPortalAccountByPhone = async (phone) => {
  const phoneCandidates = buildPhoneCandidates(phone);

  if (!phoneCandidates.length) {
    return null;
  }

  const account = await buildDriverPortalExistenceQuery('driver', phoneCandidates);
  return account ? { role: 'driver', account } : null;
};

export const findAllDriverPortalAccountsByPhone = async (phone) => {
  const phoneCandidates = buildPhoneCandidates(phone);

  if (!phoneCandidates.length) {
    return [];
  }

  const account = await buildDriverPortalExistenceQuery('driver', phoneCandidates);
  return account ? [{ role: 'driver', id: account._id }] : [];
};

export const startDriverLoginOtp = async ({ phone }) => {
  const normalizedPhone = normalizePhone(phone);
  const normalizedRole = 'driver';

  if (!normalizedPhone || normalizedPhone.length !== 10) {
    throw new ApiError(400, 'A valid 10-digit mobile number is required');
  }

  const match = await findDriverPortalAccountByPhone({ phone: normalizedPhone });
  const account = match?.account;

  if (!account) {
    throw new ApiError(404, 'Driver account not found');
  }

  const { otp, isStatic } = resolveDriverLoginOtpForPhone(normalizedPhone);
  const now = Date.now();

  const session = await DriverLoginSession.findOneAndUpdate(
    { phone: normalizedPhone },
    {
      phone: normalizedPhone,
      driverId: account._id,
      accountRole: normalizedRole,
      otpHash: hashOtp(otp),
      otpExpiresAt: new Date(now + LOGIN_OTP_TTL_MS),
      verifiedAt: null,
      expiresAt: new Date(now + LOGIN_OTP_TTL_MS),
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );

  const smsDispatch = isStatic
    ? {
        mode: 'static',
        message: 'Static OTP enabled',
      }
    : await sendOtpSms({
        phone: normalizedPhone,
        otp,
        purpose: 'driver login OTP',
      });
  const debugOtp = getVisibleOtp(otp);

  if (debugOtp) {
    console.log(`[loginOtpService] OTP for ${normalizedPhone} = ${debugOtp} (${smsDispatch.mode})`);
  }

  return {
    message: smsDispatch.mode === 'live' ? 'OTP sent successfully' : 'OTP generated successfully',
    session: publicSessionPayload(session, debugOtp),
    availableRoles: ['driver'],
  };
};

export const verifyDriverLoginOtp = async ({ phone, otp }) => {
  const session = await getSession(phone);

  if (!otp || String(otp).trim().length !== 4) {
    throw new ApiError(400, 'A valid 4-digit OTP is required');
  }

  if (!session.otpExpiresAt || new Date(session.otpExpiresAt).getTime() < Date.now()) {
    throw new ApiError(410, 'OTP has expired');
  }

  if (session.otpHash !== hashOtp(otp)) {
    throw new ApiError(401, 'Invalid OTP');
  }

  const normalizedRole = 'driver';
  const account = await Driver.findById(session.driverId);

  if (!account) {
    throw new ApiError(404, 'Driver account not found');
  }

  session.verifiedAt = new Date();
  session.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await session.save();
  await DriverLoginSession.deleteOne({ _id: session._id });

  return {
    message: 'OTP verified successfully',
    token: signAccessToken({ sub: String(account._id), role: normalizedRole }),
    role: normalizedRole,
    driver: publicDriverPayload(account),
  };
};
