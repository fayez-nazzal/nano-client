import { rest } from "msw";

import { server } from "../mocks/server";
import { NanoFrontendModuleConfig } from "../types";
import {
  getNanoFrontendModuleConfig,
  moduleConfigPromiseCacheMap,
} from "./getNanoFrontendModuleConfig";

describe("[getNanoFrontendModuleConfig]", () => {
  afterEach(() => moduleConfigPromiseCacheMap.clear());

  it("should fetch the latest config and return it", async () => {
    server.use(
      rest.get(
        "https://mock.hostname/api/nano/latest/MOCK_LIB_NAME/MOCK_LIB_VERSION",
        (_, res, ctx) =>
          res(
            ctx.status(200),
            ctx.json({
              umdBundle: "mockBundle.js",
              cssBundle: "mockBundle.css",
            } as NanoFrontendModuleConfig)
          )
      )
    );

    const nanoFrontendModuleConfig = await getNanoFrontendModuleConfig({
      name: "MOCK_LIB_NAME",
      version: "MOCK_LIB_VERSION",
      hostname: "https://mock.hostname/api",
    });

    expect(nanoFrontendModuleConfig).toEqual({
      umdBundle: "mockBundle.js",
      cssBundle: "mockBundle.css",
    });
  });

  it.each`
    status
    ${400}
    ${401}
    ${403}
    ${500}
  `("should throw an error on $status", async ({ status }) => {
    server.use(
      rest.get(
        "https://mock.hostname/api/nano/latest/MOCK_LIB_NAME/MOCK_LIB_VERSION",
        (_, res, ctx) => res(ctx.status(status))
      )
    );

    await expect(
      getNanoFrontendModuleConfig({
        name: "MOCK_LIB_NAME",
        version: "MOCK_LIB_VERSION",
        hostname: "https://mock.hostname/api",
      })
    ).rejects.toEqual(
      new Error(
        `Failed to fetch nano frontend MOCK_LIB_NAME version MOCK_LIB_VERSION from API, with status ${status} and body ''`
      )
    );
  });

  it("should throw an error on invalid JSON", async () => {
    server.use(
      rest.get(
        "https://mock.hostname/api/nano/latest/MOCK_LIB_NAME/MOCK_LIB_VERSION",
        (_, res, ctx) =>
          res(ctx.status(200), ctx.text("THIS IS NOT VALID JSON"))
      )
    );

    await expect(
      getNanoFrontendModuleConfig({
        name: "MOCK_LIB_NAME",
        version: "MOCK_LIB_VERSION",
        hostname: "https://mock.hostname/api",
      })
    ).rejects.toEqual(
      new Error(
        `Failed to fetch nano frontend MOCK_LIB_NAME version MOCK_LIB_VERSION from API, while getting JSON body`
      )
    );
  });

  it("should retry fetching when passed a retry policy", async () => {
    let count = 0;
    server.use(
      rest.get(
        "https://mock.hostname/api/nano/latest/MOCK_LIB_NAME/MOCK_LIB_VERSION",
        (_, res, ctx) => {
          if (count === 0) {
            count++;
            return res(ctx.status(400));
          }
          return res(
            ctx.status(200),
            ctx.json({
              umdBundle: "mockBundle.js",
              cssBundle: "mockBundle.css",
            } as NanoFrontendModuleConfig)
          );
        }
      )
    );

    const nanoFrontendModuleConfig = await getNanoFrontendModuleConfig({
      name: "MOCK_LIB_NAME",
      version: "MOCK_LIB_VERSION",
      hostname: "https://mock.hostname/api",
      retryPolicy: {
        maxRetries: 1,
        delayInMs: 10,
      },
    });

    expect(nanoFrontendModuleConfig).toEqual({
      umdBundle: "mockBundle.js",
      cssBundle: "mockBundle.css",
    });
  });

  describe("when using cache", () => {
    const mockGetNanoFrontendModuleConfigProps = {
      name: "MOCK_LIB_NAME",
      version: "MOCK_LIB_VERSION",
      hostname: "https://mock.hostname/api",
    };

    const expectedModuleConfig = {
      umdBundle: "mockBundle.js",
      cssBundle: "mockBundle.css",
    };

    describe("when loading the bundle succeeds", () => {
      let apiCallsCount: number;

      beforeEach(() => {
        apiCallsCount = 0;

        server.use(
          rest.get(
            "https://mock.hostname/api/nano/latest/MOCK_LIB_NAME/MOCK_LIB_VERSION",
            (_, res, ctx) => {
              apiCallsCount++;

              return res(
                ctx.status(200),
                ctx.json({
                  umdBundle: "mockBundle.js",
                  cssBundle: "mockBundle.css",
                } as NanoFrontendModuleConfig)
              );
            }
          )
        );
      });

      describe("when called in parallel", () => {
        it("should reuse results", async () => {
          const [config1, config2] = await Promise.all([
            getNanoFrontendModuleConfig(mockGetNanoFrontendModuleConfigProps),
            getNanoFrontendModuleConfig(mockGetNanoFrontendModuleConfigProps),
          ]);

          expect(config1).toEqual(config2);

          expect(apiCallsCount).toEqual(1);
        });
      });

      describe("when called in sequence", () => {
        it("should reuse results", async () => {
          const config1 = await getNanoFrontendModuleConfig(
            mockGetNanoFrontendModuleConfigProps
          );
          expect(config1).toEqual(expectedModuleConfig);

          const config2 = await getNanoFrontendModuleConfig(
            mockGetNanoFrontendModuleConfigProps
          );
          expect(config2).toEqual(expectedModuleConfig);

          expect(config1).toBe(config2);

          expect(apiCallsCount).toEqual(1);
        });
      });

      describe("when it has a ttl on the second call", () => {
        it("should expire after ttl has passed", async () => {
          const config1 = await getNanoFrontendModuleConfig(
            mockGetNanoFrontendModuleConfigProps
          );
          expect(config1).toEqual(expectedModuleConfig);

          await new Promise((resolve) => setTimeout(resolve, 20));

          const config2 = await getNanoFrontendModuleConfig({
            ...mockGetNanoFrontendModuleConfigProps,
            cacheTtlInMs: 10,
          });
          expect(config2).toEqual(expectedModuleConfig);

          expect(config1).not.toBe(config2);

          expect(apiCallsCount).toEqual(2);
        });
      });

      describe("when ttl is 0 on the second call", () => {
        it("should not use cache at all", async () => {
          const [config1, config2] = await Promise.all([
            getNanoFrontendModuleConfig(mockGetNanoFrontendModuleConfigProps),
            getNanoFrontendModuleConfig({
              ...mockGetNanoFrontendModuleConfigProps,
              cacheTtlInMs: 0,
            }),
          ]);

          expect(config1).toEqual(expectedModuleConfig);
          expect(config2).toEqual(expectedModuleConfig);
          expect(config1).not.toBe(config2);
          expect(apiCallsCount).toEqual(2);
        });
      });
    });

    describe("when loading the config fails", () => {
      describe("when called in parallel", () => {
        it("should call the server only once and fail for all", async () => {
          let apiCallsCount = 0;

          server.use(
            rest.get(
              "https://mock.hostname/api/nano/latest/MOCK_LIB_NAME/MOCK_LIB_VERSION",
              (_, res, ctx) => {
                apiCallsCount++;
                return res(ctx.status(400));
              }
            )
          );

          const promise1 = getNanoFrontendModuleConfig(
            mockGetNanoFrontendModuleConfigProps
          );
          const promise2 = getNanoFrontendModuleConfig(
            mockGetNanoFrontendModuleConfigProps
          );

          await expect(promise1).rejects.toBeDefined();
          await expect(promise2).rejects.toBeDefined();

          expect(apiCallsCount).toEqual(1);
        });
      });

      describe("when called in sequence", () => {
        it("should not cache results and call the server again the second time", async () => {
          let apiCallsCount = 0;

          server.use(
            rest.get(
              "https://mock.hostname/api/nano/latest/MOCK_LIB_NAME/MOCK_LIB_VERSION",
              (_, res, ctx) => {
                apiCallsCount++;
                return res(ctx.status(400));
              }
            )
          );

          await expect(
            getNanoFrontendModuleConfig(mockGetNanoFrontendModuleConfigProps)
          ).rejects.toBeDefined();
          await expect(
            getNanoFrontendModuleConfig(mockGetNanoFrontendModuleConfigProps)
          ).rejects.toBeDefined();

          expect(apiCallsCount).toEqual(2);
        });
      });
    });
  });
});
