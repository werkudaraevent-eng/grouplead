import { MainLayout } from "@/components/layout/main-layout";
import { getActiveCompany, getUserCompanies } from "@/utils/company";
import { createClient } from "@/utils/supabase/server";
import type { CurrencySettings } from "@/types/currency";
import { DEFAULT_CURRENCY_SETTINGS } from "@/types/currency";

// App shell reads Supabase cookies/session and company-scoped settings.
// Force dynamic rendering for all authenticated app routes so Next never tries
// to prerender them and swallow cookie access behind static optimization.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialCompany = null;
  let companies: Awaited<ReturnType<typeof getUserCompanies>> = [];
  let currencySettings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS;
  let userProfile: { full_name: string | null; role: string | null; avatar_url: string | null } | null = null;

  try {
    const supabase = await createClient();
    const [activeResult, companiesResult, authResult] = await Promise.all([
      getActiveCompany(),
      getUserCompanies(),
      supabase.auth.getUser(),
    ]);
    initialCompany = activeResult;
    companies = companiesResult;

    const userId = authResult.data?.user?.id;
    const [profileResult, settingsResult] = await Promise.all([
      userId
        ? supabase.from("profiles").select("full_name, role, avatar_url").eq("id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
      initialCompany?.id
        ? supabase.from("company_settings").select("currency_format, currency_prefix").eq("company_id", initialCompany.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (profileResult.data) {
      userProfile = profileResult.data as NonNullable<typeof userProfile>;
    }
    if (settingsResult.data) {
      const data = settingsResult.data;
      currencySettings = {
        currency_format: data.currency_format as CurrencySettings["currency_format"],
        currency_prefix: data.currency_prefix as CurrencySettings["currency_prefix"],
      };
    }
  } catch (err) {
    console.warn("[AppLayout] Failed to load company context:", err);
  }

  return (
    <MainLayout initialCompany={initialCompany} companies={companies} currencySettings={currencySettings} userProfile={userProfile}>
      {children}
    </MainLayout>
  );
}