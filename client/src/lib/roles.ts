import type { Role } from "@shared/schema";

export function canAccessOps(role: Role): boolean {
  return ["operations", "operations_lead", "owner"].includes(role);
}

export function canAccessAdmin(role: Role): boolean {
  return role === "owner";
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

export function canUpdateOrderStatus(role: Role): boolean {
  return ["operations", "operations_lead", "owner"].includes(role);
}

export function canAssignOps(role: Role): boolean {
  return ["operations_lead", "owner"].includes(role);
}

export function canUploadReport(role: Role): boolean {
  return ["operations_lead", "owner"].includes(role);
}

export function canManageUsers(role: Role): boolean {
  return role === "owner";
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    customer: "Customer",
    operations: "Operations",
    operations_lead: "Operations Lead",
    qa: "QA",
    developer: "Developer",
    platform: "Platform",
    owner: "Owner",
  };
  return labels[role] || role;
}

export function getDashboardPath(role: Role): string {
  if (role === "owner") return "/admin";
  if (["operations", "operations_lead"].includes(role)) return "/operations";
  if (role === "platform") return "/platform";
  if (role === "qa") return "/qa";
  if (role === "developer") return "/dev";
  return "/dashboard";
}
