import { LoginDraftProvider } from '@/context/LoginDraftContext';

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LoginDraftProvider key={slug}>{children}</LoginDraftProvider>;
}
