export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPort: number;
  modelProvider: string;
  modelName: string;
}

export function loadAppConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 3000),
    apiPort: Number(process.env.API_PORT ?? 4000),
    modelProvider: process.env.MODEL_PROVIDER ?? "openai",
    modelName: process.env.MODEL_NAME ?? "gpt-4.1"
  };
}

