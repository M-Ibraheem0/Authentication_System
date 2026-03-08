import * as dotenv from "dotenv";
dotenv.config();

import { Worker } from "bullmq";
import nodemailer from "nodemailer";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import {
  verifyEmailTemplate,
  forgotPasswordTemplate,
} from "../lib/email/templates";
import { EmailJobData } from "../lib/email/queue";

// create transporter once — reused for all emails
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT!),
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

// verify connection on startup
transporter.verify((error) => {
  if (error) {
    console.error("❌ SMTP connection failed:", error.message);
  } else {
    console.log("✅ SMTP connected and ready");
  }
});

const FROM = process.env.SMTP_FROM!;

const worker = new Worker(
  "emails",
  async (job) => {
    const data = job.data as EmailJobData;

    switch (data.type) {
      case "verify-email":
        if (process.env.NODE_ENV === "development") {
          console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.log(`📧 EMAIL → ${data.to}`);
          console.log(`📋 TYPE  → verify-email`);
          console.log(`🔑 OTP   → ${data.otp}`); // ✅ TypeScript knows otp exists here
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        }
        await transporter.sendMail({
          from: FROM,
          to: data.to,
          subject: "Verify your email — HireManager",
          html: verifyEmailTemplate(data.otp),
        });
        break;

      case "forgot-password":
        if (process.env.NODE_ENV === "development") {
          console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.log(`📧 EMAIL → ${data.to}`);
          console.log(`📋 TYPE  → forgot-password`);
          console.log(`🔗 URL   → ${data.resetUrl}`); // ✅ TypeScript knows resetUrl exists here
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        }
        await transporter.sendMail({
          from: FROM,
          to: data.to,
          subject: "Reset your password — HireManager",
          html: forgotPasswordTemplate(data.resetUrl),
        });
        break;

      case "reset-confirm":
        if (process.env.NODE_ENV === "development") {
          console.log(`📧 reset-confirm → ${data.to}`);
        }
        await transporter.sendMail({
          from: FROM,
          to: data.to,
          subject: "Your password has been reset — HireManager",
          html: `<p>Your password was successfully reset. If this wasn't you, contact support immediately.</p>`,
        });
        break;

      case "login-alert":
        if (process.env.NODE_ENV === "development") {
          console.log(`📧 login-alert → ${data.to} from ${data.ip}`);
        }
        await transporter.sendMail({
          from: FROM,
          to: data.to,
          subject: "New login detected — HireManager",
          html: `<p>New login from ${data.deviceInfo} (${data.ip})</p>`,
        });
        break;

      default:
        console.warn(`Unknown email type`);
    }
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);
worker.on("failed", async (job, err) => {
  console.error(`❌ Email job ${job?.id} failed:`, err.message);
  if (job && job.attemptsMade >= 3) {
    await prisma.failedJob.create({
      data: {
        jobName: job.name,
        payload: job.data,
        error: err.message,
      },
    });
  }
});

worker.on("completed", (job) => {
  console.log(`✅ Email sent → ${job.id}`);
});

worker.on("error", (err) => {
  console.error("❌ Worker error:", err.message);
});

export default worker;
