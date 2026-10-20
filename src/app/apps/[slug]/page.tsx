import AppsCatalog from '@/components/AppsCatalog';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <AppsCatalog slug={(await params).slug} />;
}
