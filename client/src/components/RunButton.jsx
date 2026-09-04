import React from 'react';
import { Play, Loader2 } from 'lucide-react';

export default function RunButton({ isRunning, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={isRunning}
      className={`flex items-center gap-2.5 px-6 py-3 rounded-lg font-bold text-sm transition-all shadow-sm
        ${isRunning
          ? 'bg-blue-400 text-white cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95'
        }`}
    >
      {isRunning
        ? <Loader2 size={16} className="animate-spin" />
        : <Play size={16} className="fill-white" />
      }
      {isRunning ? 'Running Recovery Batch...' : 'Run Recovery Batch'}
    </button>
  );
}
