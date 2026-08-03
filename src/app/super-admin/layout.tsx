import DashboardLayout from "@/components/common/DashboardLayout";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout role="super_admin" title="Super Admin Control Panel">
      {children}
    </DashboardLayout>
  );
}
