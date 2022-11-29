export class NanoClientFetchError extends Error {
  constructor(
    name: string,
    version: string,
    message: string
  ) {
    super(
      `Failed to fetch nano frontend ${name} version ${version} from API, ${message}`
    );
    this.name = "NanoClientFetchError";
  }
}

export class NanoClientLoadBundleError extends Error {
  constructor(name: string) {
    super(`Failed to load script for nano frontend ${name}`);
    this.name = "NanoClientLoadBundleError";
  }
}
