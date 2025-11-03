export interface Config {
  nodeEnv: string;
  port: number;
}

export function getConfig(): Config {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
  };
}
