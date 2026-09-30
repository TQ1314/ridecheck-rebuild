import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  captureStagingNotification,
  stagingCaptureEnabled,
  validateStagingCaptureEnvironment,
} from "./staging-capture";

const projectRef = "mdbcdxmtbscapvnduxqu";
let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
  }
});

async function validEnvironment() {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "ridecheck-notification-capture-"));
  return {
    STAGING_NOTIFICATION_CAPTURE: "true",
    APP_ENV: "staging",
    STAGING_SUPABASE_PROJECT_REF: projectRef,
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    STAGING_NOTIFICATION_CAPTURE_FILE: path.join(temporaryDirectory, "captures.jsonl"),
  };
}

describe("staging notification capture guard", () => {
  it("leaves capture disabled unless its explicit flag is set", () => {
    expect(stagingCaptureEnabled({})).toBe(false);
    expect(stagingCaptureEnabled({ STAGING_NOTIFICATION_CAPTURE: "false" })).toBe(false);
  });

  it("rejects APP_ENV=staging when notification capture is not enabled", () => {
    expect(() => stagingCaptureEnabled({ APP_ENV: "staging" }))
      .toThrow(/requires notification capture/);
    expect(() => stagingCaptureEnabled({
      APP_ENV: "staging",
      STAGING_NOTIFICATION_CAPTURE: "false",
    })).toThrow(/requires notification capture/);
  });

  it("fails closed when staging identity or sink settings are invalid", () => {
    expect(() => stagingCaptureEnabled({ STAGING_NOTIFICATION_CAPTURE: "true" }))
      .toThrow(/APP_ENV=staging/);
    expect(() => validateStagingCaptureEnvironment({
      APP_ENV: "staging",
      STAGING_SUPABASE_PROJECT_REF: "smwjnekinbepxrzuqegk",
      NEXT_PUBLIC_SUPABASE_URL: "https://smwjnekinbepxrzuqegk.supabase.co",
      STAGING_NOTIFICATION_CAPTURE_FILE: "/tmp/captures.jsonl",
    })).toThrow(/approved staging project/);
    expect(() => validateStagingCaptureEnvironment({
      APP_ENV: "staging",
      STAGING_SUPABASE_PROJECT_REF: projectRef,
      NEXT_PUBLIC_SUPABASE_URL: "https://production-ref.supabase.co",
      STAGING_NOTIFICATION_CAPTURE_FILE: "/tmp/captures.jsonl",
    })).toThrow(/does not match/);
    expect(() => stagingCaptureEnabled({ STAGING_NOTIFICATION_CAPTURE: "yes" }))
      .toThrow(/flag/);
  });

  it("rejects a known production credential match without revealing its value", () => {
    const secret = "sensitive-production-value";
    expect(() => validateStagingCaptureEnvironment({
      APP_ENV: "staging",
      STAGING_SUPABASE_PROJECT_REF: projectRef,
      NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
      STAGING_NOTIFICATION_CAPTURE_FILE: "/tmp/captures.jsonl",
      RESEND_API_KEY: secret,
      PRODUCTION_RESEND_API_KEY: secret,
    })).toThrow(/production credential/);
  });

  it("appends structured notification content only to the configured staging file", async () => {
    const env = await validEnvironment();
    expect(stagingCaptureEnabled(env)).toBe(true);

    await captureStagingNotification({
      recipient: "ops@example.test",
      channel: "email",
      event: "order.created",
      template: "new-order-ops",
      orderId: "order-42",
      content: "<p>Private message</p>",
      payload: { subject: "New order", html: "<p>Private message</p>" },
    }, env);

    const filePath = validateStagingCaptureEnvironment(env).filePath;
    const rows = (await readFile(filePath, "utf8")).trim().split("\n");
    expect(rows).toHaveLength(1);
    const record = JSON.parse(rows[0]);
    expect(record).toMatchObject({
      recipient: "ops@example.test",
      channel: "email",
      event: "order.created",
      template: "new-order-ops",
      orderId: "order-42",
      content: "<p>Private message</p>",
    });
    expect(record.timestamp).toBeTruthy();
    expect(record.payload.html).toBe("<p>Private message</p>");
  });

  it("does not silently fall back when the capture sink cannot be configured", async () => {
    await expect(captureStagingNotification({
      recipient: "+15555550123",
      channel: "sms",
      event: "sms.send",
      template: "sms.send",
      content: "message",
      payload: { body: "message" },
    }, {
      STAGING_NOTIFICATION_CAPTURE: "true",
      APP_ENV: "staging",
      STAGING_SUPABASE_PROJECT_REF: projectRef,
      NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    })).rejects.toThrow(/STAGING_NOTIFICATION_CAPTURE_FILE/);
  });
});