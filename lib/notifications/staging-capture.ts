import { constants } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";

export interface NotificationCapture {
  recipient: string;
  channel: "email" | "sms";
  event: string;
  template: string;
  orderId?: string | null;
  timestamp?: string;
  content: string;
  payload: Record<string, unknown>;
}

type CaptureEnvironment = Record<string, string | undefined>;

// Public project refs are identifiers, not credentials. Keep this fixed so a
// mistyped staging configuration cannot silently point at the live project.
const STAGING_PROJECT_REF = "mdbcdxmtbscapvnduxqu";

const PRODUCTION_KEY_PAIRS: Array<[string, string]> = [
  ["SUPABASE_SERVICE_ROLE_KEY", "PRODUCTION_SUPABASE_SERVICE_ROLE_KEY"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "PRODUCTION_SUPABASE_ANON_KEY"],
  ["RESEND_API_KEY", "PRODUCTION_RESEND_API_KEY"],
  ["TWILIO_ACCOUNT_SID", "PRODUCTION_TWILIO_ACCOUNT_SID"],
  ["TWILIO_AUTH_TOKEN", "PRODUCTION_TWILIO_AUTH_TOKEN"],
];

export function stagingCaptureEnabled(env: CaptureEnvironment = process.env): boolean {
  const flag = env.STAGING_NOTIFICATION_CAPTURE;
  if (env.APP_ENV === "staging" && flag !== "true") {
    throw new Error("Staging requires notification capture; outbound delivery is blocked.");
  }
  if (flag === undefined || flag === "" || flag === "false") return false;
  if (flag !== "true") {
    throw new Error("Invalid staging notification capture flag; use true or false.");
  }
  validateStagingCaptureEnvironment(env);
  return true;
}

export function validateStagingCaptureEnvironment(env: CaptureEnvironment = process.env): {
  filePath: string;
} {
  if (env.APP_ENV !== "staging") {
    throw new Error("Staging notification capture requires APP_ENV=staging.");
  }

  const projectRef = env.STAGING_SUPABASE_PROJECT_REF;
  if (projectRef !== STAGING_PROJECT_REF) {
    throw new Error("Staging notification capture requires the approved staging project.");
  }

  const configuredUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl || "");
  } catch {
    throw new Error("Staging notification capture requires a valid staging Supabase URL.");
  }
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== `${projectRef}.supabase.co` ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error("Supabase URL does not match STAGING_SUPABASE_PROJECT_REF.");
  }

  const productionUrl = env.PRODUCTION_SUPABASE_URL || env.PRODUCTION_NEXT_PUBLIC_SUPABASE_URL;
  if (productionUrl && productionUrl === configuredUrl) {
    throw new Error("Staging notification capture cannot use the production Supabase URL.");
  }
  for (const [activeName, productionName] of PRODUCTION_KEY_PAIRS) {
    const activeValue = env[activeName];
    const productionValue = env[productionName];
    if (activeValue && productionValue && activeValue === productionValue) {
      throw new Error("Staging notification capture cannot use a production credential.");
    }
  }

  const filePath = env.STAGING_NOTIFICATION_CAPTURE_FILE;
  if (!filePath || !path.isAbsolute(filePath)) {
    throw new Error("Staging notification capture requires an absolute STAGING_NOTIFICATION_CAPTURE_FILE path.");
  }
  return { filePath };
}

/**
 * Writes only to a separately configured local JSONL sink; it never uses Supabase
 * or a provider. Deployments with ephemeral filesystems must collect this file
 * through their staging host's persistent storage/log artifact mechanism.
 */
export async function captureStagingNotification(
  capture: NotificationCapture,
  env: CaptureEnvironment = process.env,
): Promise<void> {
  if (!stagingCaptureEnabled(env)) {
    throw new Error("Staging capture is not enabled.");
  }
  const { filePath } = validateStagingCaptureEnvironment(env);
  const serialized = `${JSON.stringify({
    ...capture,
    orderId: capture.orderId ?? null,
    timestamp: capture.timestamp ?? new Date().toISOString(),
  })}\n`;

  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const file = await open(
    filePath,
    constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await file.chmod(0o600);
    await file.writeFile(serialized, "utf8");
  } finally {
    await file.close();
  }
}