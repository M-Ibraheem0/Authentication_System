import { Queue } from "bullmq";
import { redis } from "../redis";

export const emailQueue = new Queue("emails", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, //2min - 4min -8min 
    },
    removeOnComplete: 100,   //complete email sent redis removal
    removeOnFail: 500,     //5ms remove redis 
  },
});

export type EmailJobData =
  | { type: "verify-email"; to: string; otp: string }
  | { type: "forgot-password"; to: string; resetUrl: string }
  | { type: "reset-confirm"; to: string }
  | { type: "login-alert"; to: string; deviceInfo: string; ip: string };

export async function sendEmailJob(
  data: EmailJobData,
  deduplicationKey?: string
) {
  await emailQueue.add(data.type, data, {
    jobId: deduplicationKey,
  });
}