import { Worker } from "bullmq";
import { Resend } from "resend";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import {
  verifyEmailTemplate,
  forgotPasswordTemplate,
} from "../lib/email/templates";
import { EmailJobData } from "../lib/email/queue";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM!;

const worker = new Worker(
  "emails",
  async (job) => {
    const data = job.data as EmailJobData;

    switch (data.type) {
      case "verify-email":
        await resend.emails.send({
          from: FROM,
          to: data.to,
          subject: "Verify your email",
          html: verifyEmailTemplate(data.otp),
        });
        break;

      case "forgot-password":
        await resend.emails.send({
          from: FROM,
          to: data.to,
          subject: "Reset your password",
          html: forgotPasswordTemplate(data.resetUrl),
        });
        break;
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
  console.error(`Email job ${job?.id} failed:`, err);
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
  console.log(`Email job ${job.id} completed`);
});

export default worker;