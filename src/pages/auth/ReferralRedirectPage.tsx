import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";

export const REFERRAL_STORAGE_KEY = "megsy_referral_code";

/**
 * Captures a referral code from /ref/:code, stores it in localStorage
 * (non-sensitive — just a code pending signup), and forwards the user
 * to the landing page. The signup flow reads this value and binds the
 * new account to the referrer on the server side.
 */
const ReferralRedirectPage = () => {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) return;
    try {
      const clean = code.trim().toUpperCase().slice(0, 64);
      if (clean) {
        localStorage.setItem(
          REFERRAL_STORAGE_KEY,
          JSON.stringify({ code: clean, ts: Date.now() }),
        );
      }
    } catch {}
  }, [code]);

  return <Navigate to="/" replace />;
};

export default ReferralRedirectPage;
