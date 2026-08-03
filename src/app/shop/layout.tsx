import DashboardLayout from "@/components/common/DashboardLayout";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout role="shop_user" title="Jeweller Dashboard">
      {children}
    </DashboardLayout>
  );
}
