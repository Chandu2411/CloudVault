import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { getSourceAccount, getDestinations } from '../../api';
import { GoogleAccount } from '../../types';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [sourceAccount, setSourceAccount] = useState<GoogleAccount | null>(null);
  const [destAccounts, setDestAccounts] = useState<GoogleAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    Promise.all([
      getSourceAccount(),
      getDestinations()
    ])
      .then(([account, dests]) => {
        if (!account) {
          navigate('/');
        } else {
          setSourceAccount(account);
          setDestAccounts(dests || []);
        }
      })
      .catch(err => {
        console.error(err);
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8f9fa] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header sourceAccount={sourceAccount} destAccounts={destAccounts} />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
