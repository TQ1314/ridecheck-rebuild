import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const providerMocks = vi.hoisted(() => ({
  resendSend: vi.fn(),
  resendConstructor: vi.fn(),
  twilioCreate: vi.fn(),
  twilioFactory: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: providerMocks.resendSend };
    constructor(...args: unknown[]) {
      providerMocks.resendConstructor(...args);
    }
  },
}));

vi.mock("twilio", () => ({
  default: (...args: unknown[]) => {
    providerMocks.twilioFactory(...args);
    return { messages: { create: providerMocks.twilioCreate } };
  },
}));

const stagingProjectRef = "mdbcdxmtbscapvnduxqu";
let captureDirectory: string;

beforeEach(async () => {
  vi.resetModules();
  providerMocks.resendSend.mockReset();
  providerMocks.resendConstructor.mockReset();
  providerMocks.twilioCreate.mockReset();
  providerMocks.twilioFactory.mockReset();

  captureDirectory = await mkdtemp(path.join(os.tmpdir(), "ridecheck-wrapper-capture-"));
  vi.stubEnv("APP_ENV", "staging");
  vi.stubEnv("STAGING_NOTIFICATION_CAPTURE", "true");
  vi.stubEnv("STAGING_SUPABASE_PROJECT_REF", stagingProjectRef);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${stagingProjectRef}.supabase.co`);
  vi.stubEnv("STAGING_NOTIFICATION_CAPTURE_FILE", path.join(captureDirectory, "captures.jsonl"));

  // Deliberately present provider credentials: capture mode must still prevent
  // calls to either provider client.
  vi.stubEnv("RESEND_API_KEY", "mock-resend-credential");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "mock-twilio-account");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "mock-twilio-token");
  vi.stubEnv("TWILIO_PHONE_NUMBER", "+15555550123");
  vi.stubEnv("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("PRODUCTION_SUPABASE_ANON_KEY", "");
  vi.stubEnv("PRODUCTION_RESEND_API_KEY", "");
  vi.stubEnv("PRODUCTION_TWILIO_ACCOUNT_SID", "");
  vi.stubEnv("PRODUCTION_TWILIO_AUTH_TOKEN", "");
  vi.stubEnv("PRODUCTION_SUPABASE_URL", "");
  vi.stubEnv("PRODUCTION_NEXT_PUBLIC_SUPABASE_URL", "");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();
  await rm(captureDirectory, { recursive: true, force: true });
});

async function expectCapture(channel: "email" | "sms") {
  const contents = await readFile(path.join(captureDirectory, "captures.jsonl"), "utf8");
  const record = JSON.parse(contents.trim());
  expect(record).toMatchObject({
    channel,
    event: channel === "email" ? "email.send" : "sms.send",
    template: channel === "email" ? "email.send" : "sms.send",
    orderId: null,
  });
  expect(record.timestamp).toBeTruthy();
  expect(record.recipient).toBeTruthy();
  expect(record.content).toBeTruthy();
}

describe("notification wrappers in staging capture mode", () => {
  it("captures through lib/notifications/email without calling Resend", async () => {
    const { sendEmail } = await import("./email");
    const result = await sendEmail({
      to: "ops@example.test",
      subject: "Staging test",
      html: "<p>captured email</p>",
    });

    expect(result).toMatchObject({ success: true, dev: true });
    expect(providerMocks.resendSend).not.toHaveBeenCalled();
    await expectCapture("email");
  });

  it("captures through lib/email/resend without calling Resend", async () => {
    const { sendEmail } = await import("../email/resend");
    const result = await sendEmail({
      to: "buyer@example.test",
      subject: "Staging test",
      html: "<p>captured email</p>",
    });

    expect(result).toMatchObject({ success: true, dev: true });
    expect(providerMocks.resendSend).not.toHaveBeenCalled();
    await expectCapture("email");
  });

  it("captures through lib/notifications/sms without calling Twilio", async () => {
    const { sendSMS } = await import("./sms");
    const result = await sendSMS({ to: "+15555550100", body: "captured SMS" });

    expect(result).toMatchObject({ success: true, dev: true });
    expect(providerMocks.twilioFactory).not.toHaveBeenCalled();
    expect(providerMocks.twilioCreate).not.toHaveBeenCalled();
    await expectCapture("sms");
  });

  it("captures through lib/sms/twilio without calling Twilio", async () => {
    const { sendSMS } = await import("../sms/twilio");
    const result = await sendSMS({ to: "+15555550101", body: "captured SMS" });

    expect(result).toMatchObject({ success: true, dev: true });
    expect(providerMocks.twilioFactory).not.toHaveBeenCalled();
    expect(providerMocks.twilioCreate).not.toHaveBeenCalled();
    await expectCapture("sms");
  });

  it("rejects staging sends when capture is explicitly disabled", async () => {
    vi.stubEnv("STAGING_NOTIFICATION_CAPTURE", "false");
    const notificationsEmail = await import("./email");
    const resendEmail = await import("../email/resend");
    const notificationsSms = await import("./sms");
    const twilioSms = await import("../sms/twilio");

    await expect(notificationsEmail.sendEmail({
      to: "ops@example.test",
      subject: "Blocked staging test",
      html: "<p>must not send</p>",
    })).rejects.toThrow(/requires notification capture/);
    await expect(resendEmail.sendEmail({
      to: "ops@example.test",
      subject: "Blocked staging test",
      html: "<p>must not send</p>",
    })).rejects.toThrow(/requires notification capture/);
    await expect(notificationsSms.sendSMS({
      to: "+15555550100",
      body: "must not send",
    })).rejects.toThrow(/requires notification capture/);
    await expect(twilioSms.sendSMS({
      to: "+15555550100",
      body: "must not send",
    })).rejects.toThrow(/requires notification capture/);

    expect(providerMocks.resendSend).not.toHaveBeenCalled();
    expect(providerMocks.twilioFactory).not.toHaveBeenCalled();
    expect(providerMocks.twilioCreate).not.toHaveBeenCalled();
  });
});