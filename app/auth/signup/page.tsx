"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Turnstile } from "@marsidev/react-turnstile";
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation";
export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [startTime] = useState(Date.now());
  const [turnstileToken,setTurnstileToken] = useState('')
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"
  const router = useRouter()
  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          turnstileToken, // replace with real turnstile
          honeypot: "",
          formFillTime: Date.now() - startTime,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      if (data.requiresMfa) {
        router.push(`/auth/mfa?token=${data.tempToken}&callbackUrl=${callbackUrl}`)
        return
      }
      router.push(callbackUrl)
      // redirect to verify email
      window.location.href = `/auth/verify-email?email=${encodeURIComponent(email)}`;
    } catch {
      setError("Something went wrong. Try again.");
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
      {/* header */}
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Create an account
        </h2>
        <p className="text-sm text-white/40">
          Already have one?{" "}
          <Link
            href="/auth/signin"
            className="text-white/70 hover:text-white transition-colors underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>

      {/* oauth */}
      <OAuthButtons mode="signup" />

      {/* divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/[0.06]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-xs text-white/25">
            or continue with email
          </span>
        </div>
      </div>

      {/* form */}
      <div className="space-y-4">
        {/* error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.2 }}
              className="px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20
                         text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* honeypot — hidden */}
        <input
          type="text"
          name="website"
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
        />

        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs font-medium">
            Email
          </Label>
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

        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs font-medium">
            Password
          </Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 bg-white/[0.04] border-white/[0.08] text-white
                         placeholder:text-white/20 focus:border-white/30
                         focus:ring-0 focus:bg-white/[0.06] transition-all pr-10"
              disabled={loading}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2
                         text-white/25 hover:text-white/60 transition-colors"
            >
              {showPassword
                ? <EyeOff size={15} />
                : <Eye size={15} />
              }
            </button>
          </div>
        </div>
          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
            onSuccess={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken("")}
            onError={() => setError("Captcha failed. Please refresh.")}
            options={{
              theme: "dark",
              size: "flexible",
            }}
          />
        <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="relative w-full h-10 bg-white text-black font-medium
            rounded-lg overflow-hidden
            disabled:opacity-30 disabled:cursor-not-allowed
            group transition-all duration-200
            hover:scale-[1.015] active:scale-[0.985]
            hover:brightness-105
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 cursor-pointer"
            >
            <span
                className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg]
                group-hover:translate-x-[200%]
                transition-transform duration-700 ease-in-out
                pointer-events-none"
                style={{
                background:
                    "linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(168,85,247,0.5), rgba(236,72,153,0.4), rgba(251,146,60,0.3), transparent)"
                }}
            />

            {loading ? (
                <span className="relative flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" fill="none"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" className="opacity-75" fill="none"/>
                </svg>
                Creating Account...
                </span>
            ) : (
                <span className="relative">Create Account</span>
            )}
            </button>
      </div>

      <p className="text-xs text-white/20 text-center leading-relaxed">
        By creating an account, you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-4 hover:text-white/40 transition-colors">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-white/40 transition-colors">
          Privacy Policy
        </Link>
      </p>
    </motion.div>
  );
}