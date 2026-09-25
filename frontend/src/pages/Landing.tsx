import React from 'react';
import { Link } from 'react-router-dom';
import { Cloud, ArrowRight, ShieldCheck, Zap, Database } from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Cloud className="text-white h-5 w-5" />
          </div>
          <span className="font-bold text-xl text-slate-800 tracking-tight">CloudVault</span>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-600">
          <a href="#" className="hover:text-blue-600 transition-colors">Home</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Features</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Security</a>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-semibold text-slate-700 hover:text-blue-600">Log in</Link>
          <Link to="/login" className="text-sm font-semibold bg-blue-600 text-white px-5 py-2 rounded-full shadow-md shadow-blue-500/30 hover:bg-blue-700 transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-8 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold border border-blue-100">
            <Zap className="h-4 w-4" />
            Intelligent Drive Migration
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
            Migrate <span className="text-blue-600">Smarter.</span><br/>
            Store <span className="text-blue-600">Better.</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-lg leading-relaxed">
            Your all-in-one cloud companion that plans, transfers, and optimizes your Google Drive storage — powered by intelligent algorithms for a stress-free migration.
          </p>
          
          <div className="flex items-center gap-4 pt-4">
            <Link to="/login" className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3.5 rounded-full font-semibold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors">
              Start Migrating <ArrowRight className="h-4 w-4" />
            </Link>
            <button className="flex items-center gap-2 bg-white text-slate-700 px-6 py-3.5 rounded-full font-semibold border border-slate-200 hover:bg-slate-50 transition-colors">
              <ShieldCheck className="h-4 w-4 text-slate-400" /> Secure & Safe
            </button>
          </div>
        </div>

        <div className="relative">
          {/* Decorative floating elements */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-100 rounded-full blur-3xl opacity-60"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-100 rounded-full blur-3xl opacity-60"></div>
          
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 relative z-10">
            <div className="aspect-[4/3] bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Database className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Unified Cloud Storage</h3>
              <p className="text-sm text-slate-500 max-w-xs">Seamlessly distribute your heavy files across multiple Google accounts to free up your primary Drive.</p>
            </div>
            
            {/* Floating badges */}
            <div className="absolute -left-6 top-1/4 bg-white p-3 rounded-xl shadow-lg border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold text-xs">A</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Account 1</p>
                <p className="text-[10px] text-slate-500">15GB Free</p>
              </div>
            </div>
            <div className="absolute -right-6 bottom-1/4 bg-white p-3 rounded-xl shadow-lg border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold text-xs">B</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Account 2</p>
                <p className="text-[10px] text-slate-500">15GB Free</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
