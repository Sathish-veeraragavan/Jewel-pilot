import DashboardLayout from "@/components/common/DashboardLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout role="admin" title="Sales Admin Portal">
      {children}
    </DashboardLayout>
  );
}
