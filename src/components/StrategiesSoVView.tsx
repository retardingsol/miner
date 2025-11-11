import { useState } from 'react';
import { StrategiesView } from './StrategiesView';
import { SoVView } from './SoVView';

export function StrategiesSoVView() {
  const [activeTab, setActiveTab] = useState<'strategies' | 'sov'>('strategies');

  return (
    <div className="min-h-screen bg-black">
      {/* Toggle Header */}
      <div className="sticky top-[65px] z-40 bg-black border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setActiveTab('strategies')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'strategies'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Strategies
              </div>
            </button>
            <button
              onClick={() => setActiveTab('sov')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'sov'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Store of Value
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'strategies' ? <StrategiesView /> : <SoVView />}
    </div>
  );
}

