"use client";

import { useState, useEffect } from "react";
import { Monitor, Smartphone, Globe, Trash2, ShieldOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Session {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const fetchSessions = async () => {
    const res = await fetch("/api/auth/sessions");
    const data = await res.json();
    setSessions(data.sessions ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const fetchSessions = async () => {
        try {
        const res = await fetch("/api/auth/sessions");
        const data = await res.json();
        setSessions(data.sessions ?? []);
        } catch (err) {
        console.error("Failed to fetch sessions:", err);
        } finally {
        setLoading(false);
        }
    };

    fetchSessions();
    }, []);

  const revokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    await fetch(`/api/auth/sessions?sessionId=${sessionId}`, {
      method: "DELETE",
    });
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setRevoking(null);
  };

  const revokeAll = async () => {
    setRevokingAll(true);
    await fetch("/api/auth/sessions?all=true", { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    setRevokingAll(false);
  };

  const getDeviceIcon = (deviceInfo: string) => {
    if (/mobile|android|iphone/i.test(deviceInfo)) {
      return <Smartphone size={14} className="text-white/40" />;
    }
    return <Monitor size={14} className="text-white/40" />;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="space-y-8 max-w-2xl">

      {/* header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Sessions
          </h1>
          <p className="text-white/40 text-sm">
            Manage devices that are signed in to your account
          </p>
        </div>

        {otherSessions.length > 0 && (
          <button
            onClick={revokeAll}
            disabled={revokingAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg
                       border border-red-500/20 bg-red-500/[0.06]
                       text-red-400/80 hover:text-red-400
                       hover:bg-red-500/[0.10] text-xs
                       transition-all duration-150 disabled:opacity-40"
          >
            <ShieldOff size={13} />
            {revokingAll ? "Revoking..." : "Revoke all others"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-white/[0.06]
                         bg-white/[0.02] animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, height: 0 }}
                transition={{ duration: 0.2 }}
                className={`
                  flex items-center gap-4 px-5 py-4 rounded-xl
                  border transition-all duration-150
                  ${session.isCurrent
                    ? "border-white/[0.10] bg-white/[0.04]"
                    : "border-white/[0.06] bg-white/[0.02]"
                  }
                `}
              >
                {/* icon */}
                <div className="w-9 h-9 rounded-lg bg-white/[0.05]
                                border border-white/[0.07]
                                flex items-center justify-center flex-shrink-0">
                  {getDeviceIcon(session.deviceInfo ?? "")}
                </div>

                {/* info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-white/70 text-sm font-medium truncate">
                      {session.deviceInfo?.split("|")[0]?.trim() ?? "Unknown device"}
                    </p>
                    {session.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-xs
                                       bg-green-500/10 border border-green-500/20
                                       text-green-400 flex-shrink-0">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Globe size={11} className="text-white/20" />
                      <span className="text-white/25 text-xs">
                        {session.ipAddress ?? "Unknown IP"}
                      </span>
                    </div>
                    <span className="text-white/15 text-xs">·</span>
                    <span className="text-white/25 text-xs">
                      {formatDate(session.createdAt)}
                    </span>
                  </div>
                </div>

                {/* revoke */}
                {!session.isCurrent && (
                  <button
                    onClick={() => revokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="flex items-center gap-1.5 px-3 py-1.5
                               rounded-lg text-xs text-white/30
                               hover:text-red-400 hover:bg-red-500/[0.08]
                               border border-transparent
                               hover:border-red-500/20
                               transition-all duration-150
                               disabled:opacity-40 flex-shrink-0"
                  >
                    <Trash2 size={12} />
                    {revoking === session.id ? "..." : "Revoke"}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {sessions.length === 0 && (
            <div className="text-center py-12 text-white/20 text-sm">
              No active sessions found
            </div>
          )}
        </div>
      )}

    </div>
  );
}