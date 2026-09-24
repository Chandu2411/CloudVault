import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { getSourceAccount } from '../../api';
import { GoogleAccount } from '../../types';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sourceAccount, setSourceAccount] = useState<GoogleAccount | null>(null);

  useEffect(() => {
    getSourceAccount().then(setSourceAccount).catch(console.error);
  }, []);

  return (
    <div className="flex h-screen bg-[#f8f9fa] overflow-hidden">
      <Sidebar sourceAccount={sourceAccount} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header sourceAccount={sourceAccount} />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
