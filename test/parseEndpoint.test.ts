import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  endpointUsesBearer,
  parseEndpoint,
} from "../src/engine/parseEndpoint.js";

describe("parseEndpoint access parsing", () => {
  test("Protected alone on first line yields access protected and bearer auth", () => {
    const raw = "Protected\nGET /users/me";
    const parsed = parseEndpoint(raw);

    assert.equal(parsed.access, "protected");
    assert.equal(parsed.method, "GET");
    assert.equal(parsed.url, "<<BASE_URL>>/users/me");
    assert.equal(endpointUsesBearer(parsed.access), true);
  });

  test("Protected (JWT) on first line with method and URL on following lines", () => {
    const raw = "Protected (JWT)\nGET /users/me";
    const parsed = parseEndpoint(raw);

    assert.equal(parsed.access, "protected");
    assert.equal(parsed.method, "GET");
    assert.equal(parsed.url, "<<BASE_URL>>/users/me");
    assert.equal(endpointUsesBearer(parsed.access), true);
  });

  test("Protected - needs login on first line yields access protected", () => {
    const raw = "Protected - needs login\nPOST /orders";
    const parsed = parseEndpoint(raw);

    assert.equal(parsed.access, "protected");
    assert.equal(parsed.method, "POST");
    assert.equal(parsed.url, "<<BASE_URL>>/orders");
    assert.equal(endpointUsesBearer(parsed.access), true);
  });

  test("Public with trailing note on first line still parses as public", () => {
    const raw = "Public (no auth)\nGET /health";
    const parsed = parseEndpoint(raw);

    assert.equal(parsed.access, "public");
    assert.equal(parsed.method, "GET");
    assert.equal(parsed.url, "<<BASE_URL>>/health");
    assert.equal(endpointUsesBearer(parsed.access), false);
  });
});
