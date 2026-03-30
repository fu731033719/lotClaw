export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPort: number;
  modelProvider: string;
  modelName: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  minimaxApiKey?: string;
  minimaxBaseUrl?: string;
  minimaxModel?: string;
  qwenApiKey?: string;
  qwenBaseUrl?: string;
  qwenModel?: string;
}

export function loadAppConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 3000),
    apiPort: Number(process.env.API_PORT ?? 4000),
    modelProvider: process.env.MODEL_PROVIDER ?? "stub",
    modelName: process.env.MODEL_NAME ?? "gpt-5.4",
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    minimaxApiKey: process.env.MINIMAX_API_KEY,
    minimaxBaseUrl: process.env.MINIMAX_BASE_URL,
    minimaxModel: process.env.MINIMAX_MODEL ?? "MiniMax-M2.5",
    qwenApiKey: process.env.QWEN_API_KEY,
    qwenBaseUrl: process.env.QWEN_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    qwenModel: process.env.QWEN_MODEL ?? "qwen-plus"
  };
}
