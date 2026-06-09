import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

export type JobType =
  | "scan.market"
  | "pain.detect"
  | "opportunity.score"
  | "offer.design"
  | "outreach.write"
  | "proposal.write"
  | "qa.review";

export const JOB_QUEUES = {
  AGENT: "agent-jobs",
  QA: "qa-jobs",
  MAINTENANCE: "maintenance-jobs",
} as const;

export interface JobPayload {
  tenantId: string;
  workflowId?: string;
  entityId: string;
  requestedByUserId: string;
}

function getRedisConnection() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

const connectionPromise = getRedisConnection;

const queues = new Map<string, Queue>();

function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(name, new Queue(name, { connection: connectionPromise() }));
  }
  return queues.get(name)!;
}

export async function enqueueJob(
  queueName: string,
  jobType: JobType,
  payload: JobPayload,
  opts?: { delay?: number; attempts?: number },
) {
  const queue = getQueue(queueName);
  return queue.add(jobType, payload, {
    attempts: opts?.attempts ?? 3,
    backoff: { type: "exponential", delay: 2000 },
    delay: opts?.delay,
  });
}

const workers: Map<string, Worker> = new Map();

export function createWorker(
  queueName: string,
  handler: (job: Job<JobPayload>) => Promise<void>,
  concurrency = 5,
) {
  const worker = new Worker(queueName, handler, {
    connection: connectionPromise(),
    concurrency,
    limiter: { max: 10, duration: 1000 },
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  workers.set(queueName, worker);
  return worker;
}

export async function closeAll() {
  for (const worker of workers.values()) await worker.close();
  for (const queue of queues.values()) await queue.close();
  await connectionPromise().quit();
}

export { Queue, Worker };
export type { Job };
