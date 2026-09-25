import React from 'react';
import { Cloud, Send } from 'lucide-react';
import { authSourceUrl } from '../api';

export function Login() {
  return (
    <div className="min-h-screen flex font-sans bg-white">
      {/* Left Side - Brand/Illustration */}
      <div className="hidden lg:flex w-1/2 bg-blue-600 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative background shapes */}
        <div className="absolute top-20 left-20 w-32 h-12 bg-white/10 rounded-full blur-sm"></div>
        <div className="absolute bottom-40 right-20 w-48 h-16 bg-white/10 rounded-full blur-sm"></div>
        <div className="absolute top-1/3 right-1/4 w-24 h-8 bg-white/10 rounded-full blur-sm"></div>

        <div className="z-10 flex flex-col items-center text-center text-white max-w-md">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md mb-8 shadow-xl border border-white/20">
            <Send className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Start your next<br/><span className="text-orange-400">great migration.</span></h1>
          <p className="text-blue-100 mb-12">
            Join thousands of users who plan, track, and optimize their Google Drive storage effortlessly with CloudVault.
          </p>
          
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 text-left w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-blue-600 shadow-sm">
                CR
              </div>
              <div>
                <p className="text-sm font-bold text-white">"CloudVault changed everything!"</p>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => <span key={i} className="text-orange-400 text-xs">★</span>)}
                </div>
              </div>
            </div>
            <p className="text-sm text-blue-50 italic">
              "The most seamless storage migration experience. I love how easy it is to split my heavy files across backup accounts."
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 lg:p-24 relative">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-12 lg:hidden">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Cloud className="text-white h-5 w-5" />
            </div>
            <span className="font-bold text-xl text-slate-800">CloudVault</span>
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Welcome back</h2>
          <p className="text-slate-500 mb-8">Access your account to continue your migration.</p>

          <div className="space-y-4">
            <a 
              href="http://localhost:9090/api/oauth/google/LOGIN"
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
