import { RetryPolicy } from "./utils/retry";

export interface LoadingOptions {
  cacheTtlInMs?: number;
  retryPolicy?: RetryPolicy;
}

export interface LoadNanoFrontendOptions {
  name: string;
  version: string;
  nanoApiEndpoint: string;
  dependenciesMap?: Record<string, unknown>;
  loadingOptions?: LoadingOptions;
}

export interface NanoFrontendModuleConfig {
  umdBundle: string;
  cssBundle?: string;
}

export interface NanoFrontendSsrConfig {
  jsBundle: string;
  moduleConfigScript: string;
  cssBundle?: string;
}
