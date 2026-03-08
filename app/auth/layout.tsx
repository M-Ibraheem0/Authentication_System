"use client";

import { ReactNode, useEffect, useState } from "react";

const pills = [
  "Refresh rotation",
  "TOTP MFA", 
  "Bot protection",
  "Rate limiting",
  "OAuth 2.0",
  "BullMQ queues",
  "Sliding window",
  "Fingerprinting",
  "Tarpitting",
  "Redis sessions",
];

const CODE_LINES = [
  { text: "const session = await createSession({", tokens: [
    { text: "const ", color: "text-purple-400" },
    { text: "session ", color: "text-white" },
    { text: "= await ", color: "text-white/40" },
    { text: "createSession", color: "text-blue-400" },
    { text: "({", color: "text-white/60" },
  ]},
  { text: '  userId: "usr_ibrahem",', tokens: [
    { text: "  userId", color: "text-orange-300" },
    { text: ": ", color: "text-white/40" },
    { text: '"usr_ibrahem"', color: "text-green-300" },
    { text: ",", color: "text-white/40" },
  ]},
  { text: '  deviceInfo: "Chrome / macOS",', tokens: [
    { text: "  deviceInfo", color: "text-orange-300" },
    { text: ": ", color: "text-white/40" },
    { text: '"Chrome / macOS"', color: "text-green-300" },
    { text: ",", color: "text-white/40" },
  ]},
  { text: '  ip: "192.168.1.1"', tokens: [
    { text: "  ip", color: "text-orange-300" },
    { text: ": ", color: "text-white/40" },
    { text: '"192.168.1.1"', color: "text-green-300" },
  ]},
  { text: "})", tokens: [
    { text: "})", color: "text-white/60" },
  ]},
  { text: "", tokens: [] },
  { text: 'await emailQueue.add("verify-email", {', tokens: [
    { text: "await ", color: "text-purple-400" },
    { text: "emailQueue", color: "text-blue-400" },
    { text: ".", color: "text-white/60" },
    { text: "add", color: "text-yellow-300" },
    { text: "(", color: "text-white/60" },
    { text: '"verify-email"', color: "text-green-300" },
    { text: ", {", color: "text-white/40" },
  ]},
  { text: '  to: "user@example.com",', tokens: [
    { text: "  to", color: "text-orange-300" },
    { text: ": ", color: "text-white/40" },
    { text: '"user@example.com"', color: "text-green-300" },
    { text: ",", color: "text-white/40" },
  ]},
  { text: '  otp: "482910"', tokens: [
    { text: "  otp", color: "text-orange-300" },
    { text: ": ", color: "text-white/40" },
    { text: '"482910"', color: "text-green-300" },
  ]},
  { text: "})", tokens: [
    { text: "})", color: "text-white/40" },
  ]},
  { text: "", tokens: [] },
  { text: "// ✓ session created · email queued · tokens rotated", tokens: [
    { text: "// ✓ session created · email queued · tokens rotated", color: "text-white/20" },
  ]},
];

function AnimatedCodeBlock() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;

    // if current line not fully typed yet
    if (visibleLines < CODE_LINES.length) {
      const currentLine = CODE_LINES[visibleLines];

      // empty line — skip instantly
      if (currentLine.text === "") {
        const t = setTimeout(() => {
          setVisibleLines((v) => v + 1);
          setCurrentChar(0);
        }, 80);
        return () => clearTimeout(t);
      }

      // still typing current line
      if (currentChar < currentLine.text.length) {
        const speed = currentLine.text[currentChar] === " " ? 30 : 
                      currentChar === 0 ? 120 : 35;
        const t = setTimeout(() => {
          setCurrentChar((c) => c + 1);
        }, speed);
        return () => clearTimeout(t);
      }

      // line done — move to next
      const t = setTimeout(() => {
        setVisibleLines((v) => v + 1);
        setCurrentChar(0);
      }, 100);
      return () => clearTimeout(t);
    }

    // all done
    setDone(true);
  }, [visibleLines, currentChar, done]);

  const renderLine = (lineIndex: number) => {
    const line = CODE_LINES[lineIndex];
    if (!line) return null;

    // empty line
    if (line.text === "") return <div key={lineIndex} className="h-2" />;

    const isCurrentLine = lineIndex === visibleLines;
    const isFullyTyped = lineIndex < visibleLines;

    if (isFullyTyped || done) {
      // render with syntax highlighting
      return (
        <div key={lineIndex} className="flex flex-wrap">
          {line.tokens.map((token, i) => (
            <span key={i} className={token.color}>{token.text}</span>
          ))}
        </div>
      );
    }

    if (isCurrentLine) {
      // render partially typed — plain white while typing
      return (
        <div key={lineIndex} className="flex items-center">
          <span className="text-white/80">{line.text.slice(0, currentChar)}</span>
          <span className="w-1.5 h-3.5 bg-white/70 rounded-sm animate-pulse ml-px" />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/40
                    backdrop-blur-xl overflow-hidden transition-all duration-300">

      {/* window bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
        <div className="w-2 h-2 rounded-full bg-red-500/60" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
        <div className="w-2 h-2 rounded-full bg-green-500/60" />
        <span className="ml-2 text-white/20 text-xs font-mono">auth.ts</span>
      </div>

      {/* code area */}
      <div className="p-4 font-mono text-xs leading-relaxed space-y-0.5">
        {Array.from({ length: Math.min(visibleLines + 1, CODE_LINES.length) }).map((_, i) =>
          renderLine(i)
        )}

        {/* blinking cursor at end when done */}
        {done && (
          <div className="flex items-center gap-1 pt-1">
            <span className="text-white/40">{">"}</span>
            <span className="w-1.5 h-3.5 bg-white/60 rounded-sm animate-pulse" />
          </div>
        )}
      </div>

    </div>
  );
}

function PillTicker() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset((prev) => prev + 0.5);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const doubled = [...pills, ...pills];

  return (
    <div className="overflow-hidden w-full">
      <div
        className="flex gap-2 w-max"
        style={{
          transform: `translateX(-${offset % (pills.length * 115)}px)`,
        }}
      >
        {doubled.map((pill, i) => (
          <span
            key={i}
            className="px-3 py-1 rounded-full text-xs text-white/50
                       border border-white/[0.08] bg-white/[0.03]
                       whitespace-nowrap flex-shrink-0"
          >
            {pill}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen overflow-hidden relative">

      {/* FULL SCREEN ANIMATED BACKGROUND */}
      <div className="fixed inset-0 z-0" style={{ background: "oklch(0.08 0 0)" }}>
        <div className="orb-1 absolute rounded-full" />
        <div className="orb-2 absolute rounded-full" />
        <div className="orb-3 absolute rounded-full" />
        <div className="orb-4 absolute rounded-full" />
        <div className="orb-5 absolute rounded-full" />
        <div className="orb-6 absolute rounded-full" />
      </div>

      {/* CONTENT LAYER */}
      <div className="relative z-10 h-full flex">

        {/* LEFT PANEL */}
        <div className="hidden lg:flex flex-col pl-16 pr-10 py-8 flex-1 gap-6">

          {/* logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/20
                            flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-sm bg-white" />
            </div>
            <span className="text-white font-semibold text-sm tracking-tight">
              Authentication System
            </span>
          </div>

          {/* middle */}
          <div className="flex flex-col justify-center flex-1 gap-6 max-w-md">

            {/* headline */}
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-white leading-tight tracking-tight">
                Secure authentication
                <br />
                <span className="text-white/40">without the complexity.</span>
              </h1>
              <p className="text-white/50 text-sm leading-relaxed">
                Production-ready auth with sessions, MFA, and OAuth.
                Drop it in and ship faster.
              </p>
            </div>

            {/* animated code */}
            <AnimatedCodeBlock />

            {/* pill ticker */}
            <PillTicker />

          </div>

          {/* bottom — Alex Chen */}
          <div className="flex-shrink-0 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex-shrink-0" />
              <div>
                <p className="text-white/70 text-xs font-medium">Alex Chen</p>
                <p className="text-white/30 text-xs">Senior Engineer at Vercel</p>
              </div>
            </div>
            <p className="text-white/40 text-xs leading-relaxed italic">
              "The best auth system I've ever used. Clean, fast, and never gets in the way."
            </p>
          </div>

        </div>

        {/* RIGHT PANEL */}
        <div className="flex items-center justify-center p-6 lg:p-14 flex-1">
          <div className="w-full max-w-sm">
            <div className="rounded-2xl border border-white/[0.08]
                            bg-black/40 backdrop-blur-2xl p-8 shadow-2xl">
              {children}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}