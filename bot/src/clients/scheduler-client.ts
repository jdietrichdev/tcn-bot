import { SchedulerClient } from "@aws-sdk/client-scheduler";

export const schedulerClient = new SchedulerClient({
  region: process.env.REGION,
});
