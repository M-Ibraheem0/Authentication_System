"use client";

import { useState, useEffect } from "react";
import { Shield, Key, Eye, EyeOff, CheckCircle, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatePresence, motion } from "framer-motion";
import { OtpInput } from "@/components/auth/otp-input";

export default function SecurityPage() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [setupStep, setSetupStep] = useState<"idle" | "scan" | "confirm">("idle");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [mfaSuccess, setMfaSuccess] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((d) => setMfaEnabled(d.user?.mfaEnabled ?? false));
  }, []);

  const handleMfaSetup = async () => {
    setMfaLoading(true);
    setMfaError("");
    try {
      const res = await fetch("/api/auth/mfa/setup");
      const data = await res.json();
      if (!res.ok) {
        setMfaError(data.error);
        return;
      }
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setSetupStep("scan");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaConfirm = async () => {
    if (mfaCode.length !== 6) return;
    setMfaLoading(true);
    setMfaError("");
    try {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMfaError(data.error);
        setMfaCode("");
        return;
      }
      setMfaEnabled(true);
      setSetupStep("idle");
      setMfaSuccess("MFA enabled successfully");
      setTimeout(() => setMfaSuccess(""), 3000);
    } finally {
      setMfaLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwError("");
    setPwSuccess("");

    if (newPassword !== confirmPassword) {
      setPwError("Passwords don't match");
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error);
        return;
      }
      setPwSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSuccess(""), 3000);
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">

      {/* header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          Security
        </h1>
        <p className="text-white/40 text-sm">
          Manage your password and two-factor authentication
        </p>
      </div>

      {/* MFA card */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Shield size={15} className="text-white/40" />
            <h2 className="text-sm font-medium text-white/80">
              Two-Factor Authentication
            </h2>
            {mfaEnabled && (
              <span className="ml-auto flex items-center gap-1.5
                               text-xs text-green-400">
                <CheckCircle size={12} />
                Enabled
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-5">

          <AnimatePresence mode="wait">
            {mfaSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3.5 py-2.5 rounded-lg bg-green-500/10
                           border border-green-500/20 text-green-400 text-sm"
              >
                {mfaSuccess}
              </motion.div>
            )}
            {mfaError && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3.5 py-2.5 rounded-lg bg-red-500/10
                           border border-red-500/20 text-red-400 text-sm"
              >
                {mfaError}
              </motion.div>
            )}
          </AnimatePresence>

          {!mfaEnabled && setupStep === "idle" && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04]
                              border border-white/[0.06]
                              flex items-center justify-center flex-shrink-0">
                <Smartphone size={16} className="text-white/40" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-white/70 text-sm font-medium">
                    Authenticator App
                  </p>
                  <p className="text-white/30 text-xs mt-0.5 leading-relaxed">
                    Use an authenticator app like Google Authenticator
                    or Authy to generate one-time codes.
                  </p>
                </div>
                <button
                  onClick={handleMfaSetup}
                  disabled={mfaLoading}
                  className="px-4 py-2 rounded-lg bg-white/[0.06]
                             border border-white/[0.08] text-white/70
                             hover:bg-white/[0.10] hover:text-white
                             text-sm transition-all duration-150
                             disabled:opacity-40"
                >
                  {mfaLoading ? "Setting up..." : "Set up MFA"}
                </button>
              </div>
            </div>
          )}

          {setupStep === "scan" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <p className="text-white/70 text-sm font-medium">
                  Step 1 — Scan QR code
                </p>
                <p className="text-white/30 text-xs leading-relaxed">
                  Open your authenticator app and scan this QR code.
                </p>
              </div>

              {/* QR code */}
              <div className="flex justify-center">
                <div className="p-4 rounded-xl bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="MFA QR Code" className="w-40 h-40" />
                </div>
              </div>

              {/* manual secret */}
              <div className="space-y-1.5">
                <p className="text-white/30 text-xs">
                  Cant scan? Enter this code manually:
                </p>
                <div className="px-3 py-2 rounded-lg bg-white/[0.04]
                                border border-white/[0.06]
                                font-mono text-xs text-white/50
                                tracking-widest text-center">
                  {secret}
                </div>
              </div>

              <button
                onClick={() => setSetupStep("confirm")}
                className="w-full h-10 rounded-lg bg-white text-black
                           text-sm font-medium hover:bg-white/90
                           transition-all duration-150"
              >
                I have scanned it →
              </button>
            </motion.div>
          )}

          {setupStep === "confirm" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <p className="text-white/70 text-sm font-medium">
                  Step 2 — Confirm code
                </p>
                <p className="text-white/30 text-xs">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>

              <OtpInput
                value={mfaCode}
                onChange={setMfaCode}
                disabled={mfaLoading}
              />

              <button
                onClick={handleMfaConfirm}
                disabled={mfaLoading || mfaCode.length !== 6}
                className="w-full h-10 rounded-lg bg-white text-black
                           text-sm font-medium hover:bg-white/90
                           transition-all duration-150
                           disabled:opacity-30"
              >
                {mfaLoading ? "Verifying..." : "Enable MFA"}
              </button>

              <button
                onClick={() => {
                  setSetupStep("scan");
                  setMfaCode("");
                }}
                className="w-full text-xs text-white/25
                           hover:text-white/50 transition-colors"
              >
                ← Back to QR code
              </button>
            </motion.div>
          )}

          {mfaEnabled && setupStep === "idle" && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm font-medium">
                  Authenticator App
                </p>
                <p className="text-white/30 text-xs mt-0.5">
                  Your account is protected with MFA
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5
                              rounded-full bg-green-500/10
                              border border-green-500/20">
                <CheckCircle size={12} className="text-green-400" />
                <span className="text-green-400 text-xs">Active</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* change password card */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Key size={15} className="text-white/40" />
            <h2 className="text-sm font-medium text-white/80">
              Change Password
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-4">

          <AnimatePresence>
            {pwSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3.5 py-2.5 rounded-lg bg-green-500/10
                           border border-green-500/20 text-green-400 text-sm"
              >
                {pwSuccess}
              </motion.div>
            )}
            {pwError && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3.5 py-2.5 rounded-lg bg-red-500/10
                           border border-red-500/20 text-red-400 text-sm"
              >
                {pwError}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <Label className="text-white/50 text-xs font-medium">
              Current password
            </Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="h-10 bg-white/[0.03] border-white/[0.06]
                           text-white placeholder:text-white/20
                           focus:border-white/20 focus:ring-0 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-white/20 hover:text-white/50 transition-colors"
              >
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/50 text-xs font-medium">
              New password
            </Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="h-10 bg-white/[0.03] border-white/[0.06]
                           text-white placeholder:text-white/20
                           focus:border-white/20 focus:ring-0 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-white/20 hover:text-white/50 transition-colors"
              >
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/50 text-xs font-medium">
              Confirm new password
            </Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className="h-10 bg-white/[0.03] border-white/[0.06]
                         text-white placeholder:text-white/20
                         focus:border-white/20 focus:ring-0"
              onKeyDown={(e) => e.key === "Enter" && handlePasswordChange()}
            />
          </div>

          <button
            onClick={handlePasswordChange}
            disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
            className="relative h-10 px-5 rounded-lg bg-white text-black
                       text-sm font-medium overflow-hidden
                       disabled:opacity-30 disabled:cursor-not-allowed
                       group transition-all duration-150"
          >
            <span
              className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg]
                         group-hover:translate-x-[200%]
                         transition-transform duration-700 ease-in-out
                         pointer-events-none"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(168,85,247,0.5), rgba(236,72,153,0.4), rgba(251,146,60,0.3), transparent)"
              }}
            />
            <span className="relative">
              {pwLoading ? "Saving..." : "Update password"}
            </span>
          </button>

        </div>
      </div>

    </div>
  );
}