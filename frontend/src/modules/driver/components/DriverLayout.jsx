import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    getCurrentDriver,
    getLocalDriverToken,
    getStoredDriverRole,
} from '../services/registrationService';
import DriverRideRequestListener from './DriverRideRequestListener';

const unwrapDriver = (response) => response?.data?.data || response?.data || response;

const isDriverApproved = (driver) => {
    if (!driver) {
        return false;
    }

    const approval = String(driver.approve ?? '').toLowerCase();
    const status = String(driver.status || '').toLowerCase();

    return (
        driver.approve === true ||
        driver.approve === 1 ||
        ['true', '1', 'yes', 'approved'].includes(approval) ||
        ['approved', 'active', 'verified'].includes(status)
    );
};

const onboardingRoutes = new Set([
    '/taxi/driver/lang-select',
    '/taxi/driver/welcome',
    '/taxi/driver/login',
    '/taxi/driver/terms',
    '/taxi/driver/privacy',
    '/taxi/driver/support',
    '/taxi/driver/reg-phone',
    '/taxi/driver/otp-verify',
    '/taxi/driver/select-role',
    '/taxi/driver/step-personal',
    '/taxi/driver/step-referral',
    '/taxi/driver/step-vehicle',
    '/taxi/driver/step-documents',
    '/taxi/driver/role-signup',
    '/taxi/driver/registration-status',
    '/taxi/driver/status',
]);

const isOnboardingRoute = (pathname = '') => onboardingRoutes.has(pathname);

const softEntryRoutes = new Set([
    '/taxi/driver/welcome',
    '/taxi/driver/login',
    '/taxi/driver/reg-phone',
]);

const redirectToDriverLogin = (navigate) => {
    navigate('/taxi/driver/login', { replace: true });
};

const getStoredRole = () => String(getStoredDriverRole() || 'driver').toLowerCase();

const getAuthenticatedDriverHome = () => '/taxi/driver/home';

const getPendingDriverRoute = () => '/taxi/driver/registration-status';
const isPendingAllowedRoute = (pathname = '') =>
    [
        '/taxi/driver/documents',
        '/taxi/driver/support',
        '/taxi/driver/help-support',
        '/taxi/driver/support/chat',
        '/taxi/driver/support/tickets',
    ].includes(pathname);

const DriverLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(false);
    const [isAllowed, setIsAllowed] = useState(true);
    const verifiedTokenRef = useRef('');
    const verifiedApprovalRef = useRef(false);

    useEffect(() => {
        const currentPath = location.pathname;
        const onboardingState = location.state || {};
        const token = getLocalDriverToken();
        const authenticatedHome = getAuthenticatedDriverHome();
        const shouldVerifyOnboardingRoute =
            Boolean(token)
            && (
                softEntryRoutes.has(currentPath)
                || (
                    currentPath === '/taxi/driver/lang-select'
                    && !onboardingState.registrationFlow
                    && !onboardingState.allowAuthenticated
                )
            );

        if (isOnboardingRoute(currentPath) && !shouldVerifyOnboardingRoute) {
            setIsAllowed(true);
            setIsChecking(false);
            return;
        }

        if (!token) {
            setIsAllowed(false);
            verifiedTokenRef.current = '';
            verifiedApprovalRef.current = false;
            redirectToDriverLogin(navigate);
            return;
        }

        if (verifiedTokenRef.current === token && verifiedApprovalRef.current && isAllowed) {
            setIsChecking(false);
            return;
        }

        let active = true;

        const verifyDriver = async () => {
            setIsChecking(true);

            try {
                const response = await getCurrentDriver();
                const driver = unwrapDriver(response);
                const isApproved = isDriverApproved(driver);

                if (!active) {
                    return;
                }

                if (!isApproved) {
                    if (isPendingAllowedRoute(currentPath)) {
                        setIsAllowed(true);
                        verifiedTokenRef.current = '';
                        verifiedApprovalRef.current = false;
                        setIsChecking(false);
                        return;
                    }

                    setIsAllowed(false);
                    verifiedTokenRef.current = '';
                    verifiedApprovalRef.current = false;
                    navigate(getPendingDriverRoute(), { replace: true });
                    return;
                }

                setIsAllowed(true);
                verifiedTokenRef.current = token;
                verifiedApprovalRef.current = true;

                if (softEntryRoutes.has(currentPath)) {
                    navigate(authenticatedHome, { replace: true });
                    return;
                }

                if (
                    currentPath === '/taxi/driver/lang-select'
                    && !onboardingState.registrationFlow
                    && !onboardingState.allowAuthenticated
                ) {
                    navigate(authenticatedHome, { replace: true });
                }
            } catch (error) {
                if (!active) {
                    return;
                }

                setIsAllowed(false);
                verifiedTokenRef.current = '';
                verifiedApprovalRef.current = false;

                if (error?.status === 401) {
                    redirectToDriverLogin(navigate);
                    return;
                }

                if (error?.status === 404) {
                    redirectToDriverLogin(navigate);
                    return;
                }

                navigate(getPendingDriverRoute(), { replace: true });
            } finally {
                if (active) {
                    setIsChecking(false);
                }
            }
        };

        verifyDriver();

        return () => {
            active = false;
        };
    }, [isAllowed, location.pathname, location.state, navigate]);

    return (
        <div className="driver-theme min-h-screen">
            {isChecking && !isOnboardingRoute(location.pathname) ? (
                <div className="min-h-screen flex items-center justify-center bg-white">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    <Outlet context={{ isAllowed }} />
                    {isAllowed && getStoredRole() === 'driver' && <DriverRideRequestListener />}
                </>
            )}
        </div>
    );
};

export default DriverLayout;
