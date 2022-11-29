import { NanoClientFetchError } from "../errors";
import { NanoFrontendModuleConfig } from "../types";
import { retry, RetryPolicy } from "./retry";

interface GetNanoFrontendModuleConfigProps
  extends GetNanoFrontendModuleConfigBaseProps {
  cacheTtlInMs?: number;
  retryPolicy?: RetryPolicy;
}

interface ModuleConfigCacheItem {
  promise: Promise<NanoFrontendModuleConfig>;
  timestamp: number;
}

const isCacheItemValid = ({
  timestamp,
  ttlInMs,
}: {
  timestamp: number;
  ttlInMs?: number;
}) => ttlInMs == null || Date.now() - timestamp < ttlInMs;

export const moduleConfigPromiseCacheMap = new Map<
  string,
  ModuleConfigCacheItem
>();

export const getNanoFrontendModuleConfig = async ({
  name,
  version,
  hostname,
  retryPolicy = {
    maxRetries: 0,
    delayInMs: 0,
  },
  cacheTtlInMs,
}: GetNanoFrontendModuleConfigProps): Promise<NanoFrontendModuleConfig> => {
  const cacheKey = `${name}-${version}-${hostname}`;

  const cacheItem = moduleConfigPromiseCacheMap.get(cacheKey);
  if (
    cacheItem &&
    isCacheItemValid({
      ttlInMs: cacheTtlInMs,
      timestamp: cacheItem.timestamp,
    })
  ) {
    return cacheItem.promise;
  }

  const moduleConfigPromise = retry(
    () =>
      getNanoFrontendModuleConfigBase({
        name,
        version: version,
        hostname,
      }),
    retryPolicy
  ).catch((err) => {
    moduleConfigPromiseCacheMap.delete(cacheKey);
    throw err;
  });

  moduleConfigPromiseCacheMap.set(cacheKey, {
    promise: moduleConfigPromise,
    timestamp: Date.now(),
  });

  return moduleConfigPromise;
};

interface GetNanoFrontendModuleConfigBaseProps {
  name: string;
  version: string;
  hostname: string;
  retryPolicy?: RetryPolicy;
}

const getNanoFrontendModuleConfigBase = async ({
  name,
  version,
  hostname,
}: GetNanoFrontendModuleConfigBaseProps): Promise<NanoFrontendModuleConfig> => {
  let response;

  try {
    response = await fetch(
      `${hostname}/nano/latest/${name}/${version}`,
      { mode: "cors" }
    );
  } catch (err) {
    throw new NanoClientFetchError(
      name,
      version,
      `with error: ${(err as Record<string, string>)?.message}`
    );
  }

  if (response.status >= 400) {
    throw new NanoClientFetchError(
      name,
      version,
      `with status ${response.status} and body '${await response.text()}'`
    );
  }

  let responseJson: NanoFrontendModuleConfig;

  try {
    responseJson = await response.json();
  } catch (err) {
    throw new NanoClientFetchError(
      name,
      version,
      `while getting JSON body`
    );
  }

  return responseJson;
};
