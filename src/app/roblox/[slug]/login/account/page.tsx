import LoginFlow from '@/components/LoginFlow';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LoginFlow slug={slug} stage="account" />;
}
