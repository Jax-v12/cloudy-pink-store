import TopupCatalog from '@/components/TopupCatalog';
import { isRobloxMethod } from '@/lib/roblox';
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ method?: string | string[] }> }) {
  const [{ slug }, { method }] = await Promise.all([params, searchParams]);
  return <TopupCatalog key={slug} type="ROBLOX" slug={slug} initialMethod={isRobloxMethod(method) ? method : 'GAMEPASS'} />;
}
