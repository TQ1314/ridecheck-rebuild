// ops_lead is a legacy alias for operations_lead that may exist in older profile rows.
// All frontend role checks accept both values so the UI behaves identically for either.
export type Role =
  | "customer"
  | "operations"
  | "operations_lead"
  | "ops_lead"
  | "inspector"
  | "qa"
  | "developer"
  | "platform"
  | "owner"
  | "ridechecker"
  | "ridechecker_active"
  | "admin";

const OPS_ROLES: Role[] = ["operations", "operations_lead", "ops_lead", "owner", "admin"];

export function canAccessOps(role: Role): boolean {
  return OPS_ROLES.includes(role);
}

export function canAccessAdmin(role: Role): boolean {
  return OPS_ROLES.includes(role);
}

export function canAccessPlatform(role: Role): boolean {
  return ["platform", "owner"].includes(role);
}

export function canAccessQA(role: Role): boolean {
  return ["qa", "owner"].includes(role);
}

export function canAccessDev(role: Role): boolean {
  return ["developer", "owner"].includes(role);
}

export function canUpdateStatus(role: Role | string): boolean {
  return ["operations", "operations_lead", "ops_lead", "owner", "admin"].includes(role);
}

export function canAssignOps(role: Role | string): boolean {
  return ["operations", "operations_lead", "ops_lead", "owner", "admin"].includes(role);
}

export function canUploadReport(role: Role | string): boolean {
  return ["operations", "operations_lead", "ops_lead", "owner", "admin"].includes(role);
}

export function canSendPayment(role: Role | string): boolean {
  return ["operations", "operations_lead", "ops_lead", "owner", "admin"].includes(role);
}

export function canManageUsers(role: Role | string): boolean {
  return ["owner", "operations_lead", "ops_lead", "admin"].includes(role);
}

export function canAccessInspector(role: Role): boolean {
  return ["inspector", "owner"].includes(role);
}

export function canAccessRideChecker(role: Role): boolean {
  return ["ridechecker", "ridechecker_active", "owner"].includes(role);
}

export function getRoleLabel(role: Role | string): string {
  const labels: Record<string, string> = {
    customer: "Customer",
    operations: "Operations",
    operations_lead: "Operations Lead",
    ops_lead: "Operations Lead",
    inspector: "RideChecker",
    qa: "QA",
    developer: "Developer",
    platform: "Platform",
    owner: "Owner",
    admin: "Admin",
    ridechecker: "RideChecker (Pending)",
    ridechecker_active: "RideChecker (Active)",
  };
  return labels[role] ?? String(role);
}

export function getDashboardPath(role: Role | string): string {
  if (role === "owner") return "/admin";
  if (["operations", "operations_lead", "ops_lead", "admin"].includes(role)) return "/admin";
  if (role === "inspector") return "/inspector";
  if (["ridechecker", "ridechecker_active"].includes(role)) return "/ridechecker/dashboard";
  if (role === "platform") return "/platform";
  if (role === "qa") return "/qa/review";
  if (role === "developer") return "/dev";
  return "/orders";
}
