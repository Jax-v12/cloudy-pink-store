'use client';
import RobloxCheckoutWizard from './RobloxCheckoutWizard';
import type { ComponentProps } from 'react';
export default function GamepassCheckout(props: Omit<ComponentProps<typeof RobloxCheckoutWizard>, 'method'>) {
  return <RobloxCheckoutWizard {...props} method="GAMEPASS" />;
}
