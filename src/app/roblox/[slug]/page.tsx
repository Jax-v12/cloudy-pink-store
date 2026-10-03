import TopupCatalog from '@/components/TopupCatalog';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <TopupCatalog key={slug} type="ROBLOX" slug={slug} />; }
