import pino from 'pino';

export const createLogger = (serviceName: string) => {
  return pino({
    name: serviceName,
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
};

export type Logger = ReturnType<typeof createLogger>;
