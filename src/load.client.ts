import { NanoClientLoadBundleError } from "./errors";
import { LoadNanoFrontendOptions, NanoFrontendModuleConfig } from "./types";
import { getNanoFrontendModuleConfig } from "./utils/getNanoFrontendModuleConfig";
import { loadUmdBundleClientWithCache } from "./utils/loadUmdBundle";

export const loadNanoFrontendClient = async <T>({
  name,
  version,
  nanoApiEndpoint,
  dependenciesMap = {},
  loadingOptions = {},
}: LoadNanoFrontendOptions): Promise<T> => {
  const { retryPolicy, cacheTtlInMs = 2 * 60 * 1_000 } = loadingOptions;

  const nanoFrontendModuleConfigFromSsr = (
    window as unknown as Record<string, NanoFrontendModuleConfig | undefined>
  )[`nanoFrontend${name}Config`];

  const nanoFrontendModuleConfig =
    nanoFrontendModuleConfigFromSsr ??
    (await getNanoFrontendModuleConfig({
      name: name,
      version,
      hostname: nanoApiEndpoint,
      retryPolicy,
      cacheTtlInMs,
    }));

  if (nanoFrontendModuleConfig.cssBundle) {
    const cssBundleUrl = `${nanoApiEndpoint}/nano/bundle/${nanoFrontendModuleConfig.cssBundle}`;
    if (!hasStylesheet(cssBundleUrl)) {
      const cssElement = document.createElement("link");
      cssElement.rel = "stylesheet";
      cssElement.href = cssBundleUrl;
      document.head.appendChild(cssElement);
    }
  }

  try {
    return await loadUmdBundleClientWithCache({
      bundleUrl: `${nanoApiEndpoint}/nano/bundle/${nanoFrontendModuleConfig.umdBundle}`,
      name: name,
      dependenciesMap,
      baseCacheKey: `${name}-${version}`,
      retryPolicy,
    });
  } catch (err) {
    console.error(err);
    throw new NanoClientLoadBundleError(name);
  }
};

const hasStylesheet = (stylesheetHref: string): boolean =>
  !!document.querySelector(`link[rel="stylesheet"][href="${stylesheetHref}"]`);
