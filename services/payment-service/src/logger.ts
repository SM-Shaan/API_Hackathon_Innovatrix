import pino from 'pino';

export const createLogger = (serviceName: string) => {
  return pino({
    name: serviceName,
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
};

export type Logger = ReturnType<typeof createLogger>;
