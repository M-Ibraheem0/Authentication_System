"use client";

import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/auth/otp-input";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

function MfaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get("tempToken") ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (code.length === 6) handleVerify();
  }, [code]);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        setCode("");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong.");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <Link
        href="/auth/signin"
        className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        <ArrowLeft size={13} />
        Back
      </Link>

      <div className="space-y-1.5">
        <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-4">
          <ShieldCheck size={18} className="text-white/60" />
        </div>
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Two-factor auth
        </h2>
        <p className="text-sm text-white/40">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="wait">
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

        <OtpInput value={code} onChange={setCode} disabled={loading} />

        <Button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
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
          ) : "Verify"}
        </Button>
      </div>

      <p className="text-xs text-white/25 text-center">
        Lost access to your authenticator?{" "}
        <Link href="/support" className="underline underline-offset-4 hover:text-white/50 transition-colors">
          Get help
        </Link>
      </p>
    </motion.div>
  );
}

export default function MfaPage() {
  return (
    <Suspense>
      <MfaContent />
    </Suspense>
  );
}