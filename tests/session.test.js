import test from "node:test";
import assert from "node:assert/strict";
import { signVectorStoreId, verifyVectorStoreToken } from "../api/_lib/session.js";

test("signs and verifies private vector store ids", () => {
  process.env.APP_SESSION_SECRET = "test-secret-that-is-long-enough-for-tests";
  const token = signVectorStoreId("vs_test_123");
  assert.equal(verifyVectorStoreToken(token), "vs_test_123");
  assert.equal(verifyVectorStoreToken(token + "tampered"), null);
});
