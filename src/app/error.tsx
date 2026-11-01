'use client';

import StoreRecovery from '@/components/StoreRecovery';

export default function ErrorPage({ retry }: { retry: () => void }) {
  return <StoreRecovery retry={retry} />;
}
