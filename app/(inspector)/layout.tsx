import { AppShell } from "@/components/layout/AppShell";

export default function InspectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
