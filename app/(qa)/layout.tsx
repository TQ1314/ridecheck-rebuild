import { AppShell } from "@/components/layout/AppShell";

export default function QALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
