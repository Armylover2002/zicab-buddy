import { Vehicle } from '../admin/models/Vehicle.js';
import { DriverSubscription } from '../driver/models/DriverSubscription.js';
import '../driver/models/Driver.js';
import { getCycleWindow, resolveDriverSubscriptionSettings } from '../driver/services/driverSubscriptionService.js';

/**
 * The daily-pass subscribers report on Admin > Payments > Subscribers.
 *
 * A "day" is the pass day - the 6 AM to 6 AM cycle a pass covers - so the list
 * is exactly who could drive that day: a pass bought at 11 PM is on that
 * day's list, not the next. The 6 PM closing counts passes paid by 6 PM IST
 * on the day, by payment time, because that is when the money arrived.
 *
 * Passes taken with the joining bonus are subscribers but not collection: no
 * money changed hands, so they are counted apart as "free".
 */

const CLASSES = ['auto', 'bike', 'car'];
const CLOSING_HOUR = 18;
const FREE_METHODS = new Set(['bonus']);

const round = (value) => Math.round(Number(value || 0) * 100) / 100;

/** The UTC instant at which the wall clock in `timezone` reads y-m-d h:00. */
const wallClockToDate = (year, month, day, hour, timezone) => {
  const guess = Date.UTC(year, month - 1, day, hour, 0, 0);
  // The offset is measured, not assumed, so it holds for any timezone.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(guess)).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = Number(part.value);
    return acc;
  }, {});
  const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour === 24 ? 0 : parts.hour, parts.minute);
  return new Date(guess - (shown - guess));
};

/** The pass day for `date` (YYYY-MM-DD), or the current one. */
const passDay = (settings, date) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '').trim());
  if (!match) {
    const { startsAt, expiresAt } = getCycleWindow(settings);
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: settings.timezone }).format(startsAt);
    const [year, month, day] = local.split('-').map(Number);
    return { startsAt, expiresAt, year, month, day };
  }
  const [year, month, day] = match.slice(1).map(Number);
  const startsAt = wallClockToDate(year, month, day, settings.cycleStartHour, settings.timezone);
  return { startsAt, expiresAt: new Date(startsAt.getTime() + 24 * 60 * 60 * 1000), year, month, day };
};

const emptyBucket = () => ({ subscribers: 0, plan29: 0, plan49: 0, otherPlans: 0, free: 0, collection: 0 });

const addTo = (bucket, row) => {
  bucket.subscribers += 1;
  if (row.free) bucket.free += 1;
  else if (row.amount === 29) bucket.plan29 += 1;
  else if (row.amount === 49) bucket.plan49 += 1;
  else bucket.otherPlans += 1;
  bucket.collection = round(bucket.collection + row.collected);
};

/**
 * @param date           YYYY-MM-DD of the pass day; the current one when empty
 * @param vehicleClass   auto | bike | car, or empty for all
 * @param vehicleTypeId  a vehicle type (the "service": Non-AC, AC, Airport...)
 */
export const getSubscriberReport = async ({ date = '', vehicleClass = '', vehicleTypeId = '' } = {}) => {
  const settings = await resolveDriverSubscriptionSettings();
  const day = passDay(settings, date);
  const closingAt = wallClockToDate(day.year, day.month, day.day, CLOSING_HOUR, settings.timezone);

  const [passes, vehicles] = await Promise.all([
    DriverSubscription.find({
      paidAt: { $ne: null },
      startsAt: { $gte: day.startsAt, $lt: day.expiresAt },
    })
      .populate('driverId', 'name phone vehicleNumber vehicleType vehicleTypeId vehicleTypeIds')
      .sort({ paidAt: -1 })
      .lean(),
    Vehicle.find({}).select('name category').lean(),
  ]);
  const vehicleById = new Map(vehicles.map((v) => [String(v._id), v]));

  let rows = passes.map((pass) => {
    const driver = pass.driverId || {};
    const typeIds = [...new Set([driver.vehicleTypeId, ...(driver.vehicleTypeIds || [])].filter(Boolean).map(String))];
    const primary = vehicleById.get(typeIds[0] || '');
    const covered = (pass.vehicleClasses || []).map((value) => String(value).toLowerCase());
    // The class of the vehicle they drive; the pass's own class when that is
    // all there is to go on.
    const primaryClass = String(primary?.category || '').toLowerCase();
    const klass = CLASSES.includes(primaryClass)
      ? primaryClass
      : (covered.length === 1 && CLASSES.includes(covered[0]) ? covered[0] : 'other');
    const method = String(pass.paymentMethod || 'wallet').toLowerCase();
    const free = FREE_METHODS.has(method);
    const amount = Number(pass.amount || 0);

    return {
      id: String(pass._id),
      driver_id: driver._id ? String(driver._id) : '',
      driver_name: driver.name || 'Driver',
      phone: driver.phone || '',
      vehicle_number: driver.vehicleNumber || '',
      vehicle_class: klass,
      vehicle_type_ids: typeIds,
      vehicle_types: typeIds.map((id) => vehicleById.get(id)?.name).filter(Boolean),
      plan_name: pass.planName || 'Daily pass',
      amount,
      free,
      collected: free ? 0 : amount,
      payment_method: method,
      payment_status: pass.status === 'cancelled' ? 'cancelled' : 'paid',
      pass_status: pass.expiresAt && new Date(pass.expiresAt) > new Date() && pass.status === 'active' ? 'active' : 'expired',
      paid_at: pass.paidAt,
      starts_at: pass.startsAt,
      expires_at: pass.expiresAt,
      reference: pass.paymentReference || '',
    };
  });

  const classFilter = String(vehicleClass || '').trim().toLowerCase();
  const typeFilter = String(vehicleTypeId || '').trim();
  if (classFilter) rows = rows.filter((row) => row.vehicle_class === classFilter);
  if (typeFilter) rows = rows.filter((row) => row.vehicle_type_ids.includes(typeFilter));

  const totals = emptyBucket();
  const byClass = Object.fromEntries([...CLASSES, 'other'].map((key) => [key, emptyBucket()]));
  const byService = new Map();
  const byPlan = new Map();
  const closing = emptyBucket();

  for (const row of rows) {
    addTo(totals, row);
    addTo(byClass[row.vehicle_class] || byClass.other, row);
    for (const id of row.vehicle_type_ids.length ? row.vehicle_type_ids : ['none']) {
      if (!byService.has(id)) {
        byService.set(id, { vehicle_type_id: id === 'none' ? '' : id, name: vehicleById.get(id)?.name || 'No vehicle type', ...emptyBucket() });
      }
      addTo(byService.get(id), row);
    }
    const planKey = `${row.plan_name}|${row.amount}|${row.free}`;
    if (!byPlan.has(planKey)) byPlan.set(planKey, { plan_name: row.plan_name, amount: row.amount, free: row.free, subscribers: 0, collection: 0 });
    const plan = byPlan.get(planKey);
    plan.subscribers += 1;
    plan.collection = round(plan.collection + row.collected);
    if (row.paid_at && new Date(row.paid_at) <= closingAt) addTo(closing, row);
  }

  return {
    day: {
      date: `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`,
      starts_at: day.startsAt.toISOString(),
      ends_at: day.expiresAt.toISOString(),
      closing_at: closingAt.toISOString(),
      closing_done: Date.now() >= closingAt.getTime(),
      timezone: settings.timezone,
    },
    totals,
    closing,
    by_class: CLASSES.map((key) => ({ vehicle_class: key, ...byClass[key] }))
      .concat(byClass.other.subscribers ? [{ vehicle_class: 'other', ...byClass.other }] : []),
    by_service: [...byService.values()].sort((a, b) => b.subscribers - a.subscribers),
    by_plan: [...byPlan.values()].sort((a, b) => b.subscribers - a.subscribers),
    subscribers: rows,
  };
};
