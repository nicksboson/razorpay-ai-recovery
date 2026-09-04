import React from 'react';
import { ShieldAlert, Download, Bot, CheckCircle2, Info } from 'lucide-react';

export default function AuditTrail({ auditLogs, apiUrl }) {
  if (!auditLogs?.length) {
    return (
      <div className="py-20 text-center border border-dashed border-gray-300 rounded-2xl bg-white shadow-sm">
        <p className="text-gray-500 font-medium">No audit logs available yet.</p>
      </div>
    );
  }

  const handleExport = () => {
    window.open(`${apiUrl}/api/audit/export`, '_blank');
  };

  const getActionIcon = (action) => {
    switch(action) {
      case 'escalate_human': return <ShieldAlert size={16} className="text-amber-600" />;
      case 'recovered': return <CheckCircle2 size={16} className="text-emerald-600" />;
      case 'retry_payment': return <Bot size={16} className="text-blue-600" />;
      default: return <Info size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg shadow-sm transition-colors"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      <div className="space-y-4">
        {auditLogs.map(log => (
          <div key={log._id} className="p-5 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-slate-50 border border-gray-100`}>
                  {getActionIcon(log.ai_action)}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 capitalize text-sm">
                    {log.ai_action?.replace(/_/g, ' ')}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-gray-900 text-sm">₹{log.amount?.toLocaleString('en-IN')}</span>
                <div className="mt-1">
                  {log.stopped_by_rule ? (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">Stopped by Rule</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">AI Decided</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">Root Cause</span>
                <p className="text-gray-900 font-medium">{log.root_cause}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">Agent Reasoning</span>
                <p className="text-gray-900 font-medium italic">"{log.ai_reasoning}"</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 font-medium">
              <span>Final Outcome:</span>
              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 font-bold capitalize border border-gray-200">
                {log.outcome?.replace('_', ' ')}
              </span>
              {log.stop_reason && (
                <>
                  <span className="mx-2">•</span>
                  <span>Rule Triggered:</span>
                  <span className="px-2 py-1 rounded bg-red-50 text-red-700 font-bold border border-red-100">
                    {log.stop_reason.replace(/_/g, ' ')}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
