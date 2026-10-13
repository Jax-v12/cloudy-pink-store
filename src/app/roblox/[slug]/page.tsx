import TopupCatalog from '@/components/TopupCatalog';
import { isRobloxMethod, type RobloxMethodKey } from '@/lib/roblox';

export default async function Page({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ method?: string | string[]; region?: string | string[] }>;
}) {
  const [{ slug }, { method }] = await Promise.all([params, searchParams]);
  const methodKey: RobloxMethodKey | null = isRobloxMethod(method) ? method : null;
  return <TopupCatalog key={slug} type="ROBLOX" slug={slug} initialMethod={methodKey} />;
}
