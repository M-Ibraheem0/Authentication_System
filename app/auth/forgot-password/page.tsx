"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Turnstile } from "@marsidev/react-turnstile";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          turnstileToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-6"
      >
        <div className="space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20
                          flex items-center justify-center mb-4">
            <CheckCircle size={18} className="text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Check your email
          </h2>
          <p className="text-sm text-white/40 leading-relaxed">
            If{" "}
            <span className="text-white/70">{email}</span>{" "}
            has an account, a reset link has been sent. Check your inbox.
          </p>
        </div>
        <Link href="/auth/signin">
          <Button
            variant="outline"
            className="w-full h-10 bg-white/[0.04] border-white/[0.08] text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
          >
            Back to sign in
          </Button>
        </Link>
      </motion.div>
    );
  }

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
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Forgot password?
        </h2>
        <p className="text-sm text-white/40">
          Enter your email and we will send you a reset link.
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

        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs font-medium">Email</Label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 bg-white/[0.04] border-white/[0.08] text-white
                       placeholder:text-white/20 focus:border-white/30
                       focus:ring-0 focus:bg-white/[0.06] transition-all"
            disabled={loading}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        {/* Turnstile captcha */}
        <Turnstile
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          onSuccess={(token) => setTurnstileToken(token)}
          onExpire={() => setTurnstileToken("")}
          onError={() => setTurnstileToken("")}
          options={{ theme: "dark", size: "flexible" }}
        />

        <button
          onClick={handleSubmit}
          disabled={loading || !email || !turnstileToken}
          className="relative w-full h-10 bg-white text-black font-medium rounded-lg overflow-hidden disabled:opacity-30 group transition-all duration-200"
        >
          <span
            className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[200%] transition-transform duration-700 pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(168,85,247,0.5), rgba(236,72,153,0.4), rgba(251,146,60,0.3), transparent)",
            }}
          />
          <span className="relative">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12h0a12 12 0 00-12 12h4z" />
                </svg>
                Sending...
              </span>
            ) : (
              "Send reset link"
            )}
          </span>
        </button>
      </div>
    </motion.div>
  );
}