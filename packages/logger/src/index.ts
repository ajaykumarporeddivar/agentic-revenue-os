import pino from "pino";

type LogContext = {
  service: string;
  tenantId?: string;
  userId?: string;
  traceId?: string;
  route?: string;
  jobId?: string;
  agentName?: string;
};

type LogCategory =
  | "api.request"
  | "api.error"
  | "job.started"
  | "job.completed"
  | "job.failed"
  | "agent.started"
  | "agent.completed"
  | "agent.failed"
  | "db.error"
  | "auth.error"
  | "stripe.webhook";

function createLogger(context: LogContext) {
  const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    formatters: {
      level(label) { return { level: label }; },
    },
    base: {
      service: context.service,
      ...(context.tenantId && { tenant_id: context.tenantId }),
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "api_key",
        "apiKey",
        "secret",
        "password",
        "token",
        "authorization",
        "prompt", // Don't log full prompts containing sensitive data
      ],
      censor: "[REDACTED]",
    },
  });

  return {
    info(category: LogCategory, msg: string, data?: Record<string, unknown>) {
      logger.info({ category, ...data, ...context }, msg);
    },
    warn(category: LogCategory, msg: string, data?: Record<string, unknown>) {
      logger.warn({ category, ...data, ...context }, msg);
    },
    error(category: LogCategory, msg: string, data?: Record<string, unknown>) {
      logger.error({ category, ...data, ...context }, msg);
    },
    debug(category: LogCategory, msg: string, data?: Record<string, unknown>) {
      logger.debug({ category, ...data, ...context }, msg);
    },
    child(additionalContext: Partial<LogContext>) {
      return createLogger({ ...context, ...additionalContext });
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
export { createLogger };
export type { LogContext, LogCategory };
