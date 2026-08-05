import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-h-screen flex-col md:pl-60">
        <Header email={user.email ?? ""} firstName={null} />
        <main className="flex-1 bg-gradient-to-b from-background to-[#efeadd] p-4 sm:p-6 lg:p-8 dark:to-[#171a13]">
          {children}
        </main>
      </div>
    </div>
  );
}
