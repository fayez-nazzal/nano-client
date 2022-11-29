import "@ungap/global-this";

import { NanoClientLoadBundleError } from "./errors";
import { LoadNanoFrontendOptions, NanoFrontendSsrConfig } from "./types";
import { getNanoFrontendModuleConfig } from "./utils/getNanoFrontendModuleConfig";
import { loadUmdBundleServerWithCache } from "./utils/loadUmdBundle";

export interface NanoFrontendServerResponse<T> {
  nanoFrontend: T;
  nanoFrontendStringToAddToSsrResult: string;
  nanoFrontendSsrConfig: NanoFrontendSsrConfig;
}

export const loadNanoFrontendServer = async <T>({
  name,
  version,
  nanoApiEndpoint,
  dependenciesMap = {},
  loadingOptions = {},
}: LoadNanoFrontendOptions): Promise<NanoFrontendServerResponse<T>> => {
  const { retryPolicy, cacheTtlInMs = 2 * 60 * 1_000 } = loadingOptions;

  const nanoFrontendModuleConfig = await getNanoFrontendModuleConfig({
    name: name,
    version,
    hostname: nanoApiEndpoint,
    retryPolicy,
    cacheTtlInMs,
  });

  const umdBundleUrl = `${nanoApiEndpoint}/nano/bundle/${nanoFrontendModuleConfig.umdBundle}`;
  const cssBundleUrl = nanoFrontendModuleConfig.cssBundle
    ? `${nanoApiEndpoint}/nano/bundle/${nanoFrontendModuleConfig.cssBundle}`
    : undefined;

  try {
    const nanoFrontend = await loadUmdBundleServerWithCache<T>({
      bundleUrl: umdBundleUrl,
      name: name,
      dependenciesMap,
      baseCacheKey: `${name}-${version}`,
      retryPolicy,
    });

    const moduleConfigScript = `window["nanoFrontend${name}Config"] = ${JSON.stringify(
      nanoFrontendModuleConfig
    )}`;

    const nanoFrontendStringToAddToSsrResult = `
${cssBundleUrl ? `<link rel="stylesheet" href="${cssBundleUrl}">` : ""}
<link rel="preload" href="${umdBundleUrl}" as="script">
<script>${moduleConfigScript}</script>`;

    const nanoFrontendSsrConfig: NanoFrontendSsrConfig = {
      cssBundle: cssBundleUrl,
      jsBundle: umdBundleUrl,
      moduleConfigScript,
    };

    return {
      nanoFrontend,
      nanoFrontendStringToAddToSsrResult,
      nanoFrontendSsrConfig,
    };
  } catch (err) {
    console.error(err);
    throw new NanoClientLoadBundleError(name);
  }
};
