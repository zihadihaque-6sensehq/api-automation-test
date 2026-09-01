import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { checkApiTarget } from "../src/testConnections.js";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function setLoginEnv(): void {
  process.env.SPREADSHEET_ID = "test-sheet-id";
  process.env.BASE_URL = "https://api.example.com";
  process.env.LOGIN_ENDPOINT = "/auth/login";
  process.env.EMAIL = "test@example.com";
  process.env.PASSWORD = "secret";
}

describe("checkApiTarget API login verification", () => {
  beforeEach(() => {
    setLoginEnv();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  test("fails when GET would succeed but POST login returns no token", async () => {
    globalThis.fetch = async (_url, init) => {
      if (init?.method === "GET") {
        return new Response("ok", { status: 200 });
      }
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ message: "Invalid credentials" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected method: ${init?.method ?? "none"}`);
    };

    const result = await checkApiTarget();

    assert.equal(result.name, "API login");
    assert.equal(result.ok, false);
    assert.match(result.detail, /access token/i);
  });

  test("passes when POST login returns an access token", async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "https://api.example.com/auth/login");
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body, {
        emailAddress: "test@example.com",
        password: "secret",
      });

      return new Response(JSON.stringify({ accessToken: "tok123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await checkApiTarget();

    assert.equal(result.name, "API login");
    assert.equal(result.ok, true);
    assert.match(result.detail, /login verified/);
  });
});
