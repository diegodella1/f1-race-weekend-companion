import type { ReactNode } from 'react';
import { ApexMasthead } from './apex-masthead';
import { PrimaryNavigation } from './navigation';

export function ApexScreen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`app-shell apex-screen ${className}`.trim()}>
      <ApexMasthead />
      {children}
      <PrimaryNavigation />
    </div>
  );
}
