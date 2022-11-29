import fetch from "cross-fetch"; // Import fetch implementation ( so it works also for nodejs - we need it for jest )

global.fetch = fetch; // Set fetch as global fetch

import { server } from "./src/mocks/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
