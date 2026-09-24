import React, { useState } from 'react';
import { Shield, Bell, Globe, RefreshCw, Trash2, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';

interface Toggle {
  id: string;
  label: string;
  description: string;
  required?: boolean;
  defaultOn: boolean;
}

const toggleSettings: Toggle[] = [
  {
    id: 'safe_cleanup',
    label: 'Safe Cleanup Mode',
    description: 'Move source files to Trash after successful transfer verification. Files can be recovered from Trash within 30 days. NEVER disabled by default.',
    required: true,
    defaultOn: true,
  },
  {
    id: 'checksum',
    label: 'Checksum Verification (Level 4)',
    description: 'Perform MD5 hash verification after upload when the Google Drive API returns a checksum. Adds extra safety but may be slower.',
    defaultOn: true,
  },
  {
    id: 'auto_retry',
    label: 'Auto-Retry on Failure',
    description: 'Automatically retry failed transfers up to 3 times using exponential backoff (2s, 4s, 8s delays). Only retries safe operations.',
    defaultOn: true,
  },
  {
    id: 'export_workspace',
    label: 'Export Google Workspace Files',
    description: 'Automatically export Google Docs, Sheets, and Slides to their Office equivalents (DOCX, XLSX, PPTX) when migrating.',
    defaultOn: true,
  },
  {
    id: 'prevent_duplicates',
    label: 'Prevent Duplicate Transfers',
    description: "Block a file from being queued for transfer if it's already in an active or completed transfer job.",
    defaultOn: true,
  },
];

const workspaceFormats = [
  { name: 'Google Docs', mime: 'application/vnd.google-apps.document', exportAs: 'DOCX', color: 'bg-blue-600 text-white' },
  { name: 'Google Sheets', mime: 'application/vnd.google-apps.spreadsheet', exportAs: 'XLSX', color: 'bg-green-600 text-white' },
  { name: 'Google Slides', mime: 'application/vnd.google-apps.presentation', exportAs: 'PPTX', color: 'bg-orange-500 text-white' },
  { name: 'Google Drawings', mime: 'application/vnd.google-apps.drawing', exportAs: 'PNG', color: 'bg-pink-500 text-white' },
  { name: 'Google Forms', mime: 'application/vnd.google-apps.form', exportAs: 'ZIP (HTML)', color: 'bg-purple-600 text-white' },
];

const securityPoints = [
  'OAuth tokens are stored server-side only — never exposed to the browser.',
  'Access tokens are AES-256 encrypted at rest in the database.',
  'Expired tokens are automatically refreshed using stored refresh tokens.',
  'Only required Google Drive scopes are requested (least privilege principle).',
  'All API requests are validated and bound to the authenticated user session.',
];

type CleanupMode = 'trash' | 'keep';

export function Settings() {
  const [toggleValues, setToggleValues] = useState<Record<string, boolean>>(
    Object.fromEntries(toggleSettings.map(s => [s.id, s.defaultOn]))
  );
  const [cleanupMode, setCleanupMode] = useState<CleanupMode>('trash');
  const [maxRetries, setMaxRetries] = useState(3);
  const [notifications, setNotifications] = useState(false);

  const toggle = (id: string, required?: boolean) => {
    if (required) return;
    setToggleValues(v => ({ ...v, [id]: !v[id] }));
  };

  const backoffSteps = ['Immediate', 'Wait 2s', 'Wait 4s', 'Wait 8s'];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure transfer behavior and safety preferences</p>
      </div>

      {/* Safety info banner */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-green-800">Safety-First Design</h3>
            <p className="text-sm text-green-700 mt-1">
              CloudVault Migrator is designed with zero data loss as the top priority. Safe Cleanup Mode cannot be disabled. Source files are NEVER permanently deleted — only moved to Trash after verification succeeds.
            </p>
          </div>
        </div>
      </div>

      {/* Transfer Safety section */}
      <div className="glass-card divide-y divide-slate-100">
        <div className="flex items-center gap-2 px-6 py-4">
          <Shield className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-700">Transfer Safety</h2>
        </div>

        {toggleSettings.map(setting => (
          <div key={setting.id} className="flex items-start justify-between gap-6 px-6 py-5">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-slate-800">{setting.label}</h3>
                {setting.required && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">Required</span>
                )}
              </div>
              <p className="text-sm text-slate-500">{setting.description}</p>
            </div>
            <button
              onClick={() => toggle(setting.id, setting.required)}
              className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none ${
                toggleValues[setting.id] ? 'bg-blue-600' : 'bg-slate-200'
              } ${setting.required ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                toggleValues[setting.id] ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        ))}
      </div>

      {/* Source Cleanup Mode */}
      <div className="glass-card divide-y divide-slate-100">
        <div className="flex items-center gap-2 px-6 py-4">
          <Trash2 className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-700">Source Cleanup Mode</h2>
        </div>

        <div className="px-6 py-5 space-y-3">
          {/* Move to Trash option */}
          <label
            className={`flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
              cleanupMode === 'trash'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="cleanupMode"
              value="trash"
              checked={cleanupMode === 'trash'}
              onChange={() => setCleanupMode('trash')}
              className="mt-0.5 accent-blue-600"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">Move to Trash</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Recommended</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                After successful transfer and verification, source files are moved to Google Drive Trash. They can be recovered within 30 days. This is the default and safest option.
              </p>
            </div>
          </label>

          {/* Keep Source option */}
          <label
            className={`flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
              cleanupMode === 'keep'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="cleanupMode"
              value="keep"
              checked={cleanupMode === 'keep'}
              onChange={() => setCleanupMode('keep')}
              className="mt-0.5 accent-blue-600"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800">Keep Source (Duplicate Mode)</span>
              <p className="text-sm text-slate-500 mt-1">
                Source files are NOT removed after transfer. Files exist in both the source and destination. Use this for pure backup without cleanup.
              </p>
            </div>
          </label>

          {/* Permanent deletion warning */}
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">
              <strong>Permanent Deletion is not available.</strong> This application does not support permanently deleting source files by default. This is by design to prevent accidental data loss.
            </p>
          </div>
        </div>
      </div>

      {/* Retry Configuration */}
      <div className="glass-card divide-y divide-slate-100">
        <div className="flex items-center gap-2 px-6 py-4">
          <RefreshCw className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-700">Retry Configuration</h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Max Retry Attempts</h3>
              <p className="text-sm text-slate-500 mt-0.5">Number of times to retry a failed upload. Uses exponential backoff.</p>
            </div>
            <div className="relative">
              <select
                value={maxRetries}
                onChange={e => setMaxRetries(Number(e.target.value))}
                className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-9 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-semibold text-blue-700 mb-3">Exponential Backoff Schedule ({maxRetries} retr{maxRetries === 1 ? 'y' : 'ies'}):</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-blue-600 font-medium">
              {backoffSteps.slice(0, maxRetries + 1).map((step, i) => (
                <React.Fragment key={i}>
                  <span>{`Attempt ${i + 1}: ${step}`}</span>
                  {i < maxRetries && <span className="text-blue-300">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Google Workspace Export Formats */}
      <div className="glass-card divide-y divide-slate-100">
        <div className="flex items-center gap-2 px-6 py-4">
          <Globe className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-700">Google Workspace Export Formats</h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-500">
            Google Workspace files (Docs, Sheets, Slides) cannot be copied natively between accounts using the Drive API. They are exported to{' '}
            <span className="text-blue-600 font-medium">standard formats</span> before upload.
          </p>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {workspaceFormats.map(fmt => (
              <div key={fmt.name} className="flex items-center justify-between px-5 py-3.5 bg-white hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{fmt.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmt.mime}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">exports as</span>
                  <span className={`rounded-md px-2.5 py-1 text-xs font-bold tracking-wide ${fmt.color}`}>
                    {fmt.exportAs}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card divide-y divide-slate-100">
        <div className="flex items-center gap-2 px-6 py-4">
          <Bell className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-700">Notifications</h2>
        </div>

        <div className="flex items-start justify-between gap-6 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Completion Notifications</h3>
            <p className="text-sm text-slate-500 mt-0.5">Show browser notifications when a transfer job completes or fails.</p>
          </div>
          <button
            onClick={() => setNotifications(v => !v)}
            className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-200 ${
              notifications ? 'bg-blue-600' : 'bg-slate-200'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
              notifications ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* Security Information */}
      <div className="glass-card divide-y divide-slate-100">
        <div className="flex items-center gap-2 px-6 py-4">
          <Shield className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-700">Security Information</h2>
        </div>

        <div className="px-6 py-5">
          <ul className="space-y-3">
            {securityPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-600">{point}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
