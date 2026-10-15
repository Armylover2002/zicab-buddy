import React, { useEffect, useState } from 'react';
import { ChevronRight, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  getStoredDriverRegistrationSession,
  saveDriverOnboardingRole,
  saveDriverRegistrationSession,
} from '../../services/registrationService';

const ROLE_OPTIONS = [
  {
    id: 'driver',
    label: 'Taxi Driver/ Parcel ',
    description: 'Drive rides and deliveries with your own vehicle.',
    Icon: UserRound,
    color: 'text-amber-500',
  },
];

const unwrap = (response) => response?.data?.data || response?.data || response;

const RoleSelection = () => {
  const navigate = useNavigate();
  const session = getStoredDriverRegistrationSession();
  const phone = String(session.phone || '').replace(/\D/g, '').slice(-10);
  const registrationId = String(session.registrationId || '').trim();
  const [selectedRole, setSelectedRole] = useState('driver');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!phone || !registrationId) {
      navigate('/taxi/driver/login', { replace: true });
    }
  }, [navigate, phone, registrationId]);

  if (!phone || !registrationId) {
    return null;
  }

  const handleContinue = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await saveDriverOnboardingRole({
        registrationId,
        phone,
        role: selectedRole,
      });
      const payload = unwrap(response);
      const nextSession = saveDriverRegistrationSession({
        ...session,
        role: selectedRole,
        roleConfirmed: payload?.session?.roleConfirmed ?? true,
        needsRoleSelection: false,
        status: payload?.session?.status || session.status || 'otp_verified',
      });

      navigate('/taxi/driver/step-personal', {
        replace: true,
        state: nextSession,
      });
    } catch (requestError) {
      setError(requestError?.message || 'Unable to continue with this role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f7f4ec_0%,#fff9ef_34%,#ffffff_100%)] px-5 pb-32 pt-8 select-none"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <main className="mx-auto max-w-sm space-y-6">
        <header className="space-y-3">
          <div className="rounded-full bg-slate-900/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 border border-slate-900/5 inline-flex">
            Step 0 of 4
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">
            Choose your role
          </h1>
          <p className="text-base font-medium leading-7 text-slate-500">
            This number is new. Pick the profile we should create for <span className="font-black text-slate-900">+91 {phone}</span>.
          </p>
        </header>

        <section className="space-y-4">
          {ROLE_OPTIONS.map(({ id, label, description, Icon, color }) => {
            const active = selectedRole === id;

            return (
              <motion.button
                key={id}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedRole(id);
                  setError('');
                }}
                className={`w-full rounded-[28px] border p-5 text-left transition-all ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white shadow-2xl shadow-slate-900/10'
                    : 'border-slate-200 bg-white text-slate-900'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${active ? 'bg-white/15 text-white' : 'bg-slate-50'} ${active ? '' : color}`}>
                    <Icon size={22} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-black tracking-tight">{label}</p>
                    <p className={`mt-1 text-sm font-medium leading-6 ${active ? 'text-white/80' : 'text-slate-500'}`}>
                      {description}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
            {error}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/90 to-transparent px-5 pb-8 pt-10">
        <div className="mx-auto max-w-sm">
          <button
            type="button"
            onClick={handleContinue}
            disabled={loading}
            className="flex h-16 w-full items-center justify-center gap-3 rounded-[24px] bg-slate-900 text-base font-black uppercase tracking-[0.18em] text-white shadow-2xl shadow-slate-900/15 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <span className="h-5 w-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
            ) : (
              <>
                <span>Continue</span>
                <ChevronRight size={20} strokeWidth={3} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
