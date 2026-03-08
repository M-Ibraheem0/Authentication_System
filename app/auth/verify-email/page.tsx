"use client";

import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/auth/otp-input";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (otp.length === 6) handleVerify();
  }, [otp]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        setOtp("");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong.");
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendCooldown(60);
    // resend by hitting signup again with same email
    // or build a dedicated resend endpoint
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <Link
        href="/auth/signup"
        className="inline-flex items-center gap-1.5 text-xs text-white/30
                   hover:text-white/60 transition-colors"
      >
        <ArrowLeft size={13} />
        Back
      </Link>

      <div className="space-y-1.5">
        <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08]
                        flex items-center justify-center mb-4">
          <Mail size={18} className="text-white/60" />
        </div>
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Check your email
        </h2>
        <p className="text-sm text-white/40">
          We sent a 6-digit code to{" "}
          <span className="text-white/70">{email}</span>
        </p>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <OtpInput value={otp} onChange={setOtp} disabled={loading} />

        <Button
          onClick={handleVerify}
          disabled={loading || otp.length !== 6}
          className="w-full h-10 bg-white text-black font-medium hover:bg-white/90 transition-all disabled:opacity-30"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12h0a12 12 0 00-12 12h4z" />
              </svg>
              Verifying...
            </span>
          ) : "Verify email"}
        </Button>
      </div>

      <div className="text-center">
        <p className="text-xs text-white/30">
          Didnt receive it?{" "}
          {resendCooldown > 0 ? (
            <span className="text-white/20">Resend in {resendCooldown}s</span>
          ) : (
            <button
              onClick={handleResend}
              className="text-white/50 hover:text-white/80 transition-colors underline underline-offset-4"
            >
              Resend code
            </button>
          )}
        </p>
      </div>
    </motion.div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}