import { redirect } from "next/navigation";

import { isDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email = "demo@lartdevivre.fr";

  if (!isDemo()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
    email = user.email ?? "";
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-h-screen flex-col md:pl-60">
        <Header email={email} firstName={null} />
        {isDemo() && (
          <div className="border-b border-champagne/40 bg-champagne-100/70 px-4 py-2 text-center text-xs font-medium text-champagne-foreground dark:bg-champagne-100 dark:text-champagne">
            Mode démonstration — données fictives. Renseigner les variables Supabase sur Vercel
            pour passer en réel.
          </div>
        )}
        <main className="flex-1 bg-gradient-to-b from-background to-[#efeadd] p-4 sm:p-6 lg:p-8 dark:to-[#171a13]">
          {children}
        </main>
      </div>
    </div>
  );
}
