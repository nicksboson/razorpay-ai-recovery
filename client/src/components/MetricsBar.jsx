import React from 'react';
import { DollarSign, CheckCircle, AlertTriangle, Mail } from 'lucide-react';

export default function MetricsBar({ metrics }) {
  const fmt = (num) => Number(num || 0).toLocaleString('en-IN');

  const cards = [
    {
      label: 'Total Recovered',
      value: `₹${fmt(metrics?.total_recovered_amount)}`,
      icon: <DollarSign size={20} className="text-emerald-600" />,
      color: 'bg-emerald-50 border-emerald-200',
      textColor: 'text-emerald-700',
    },
    {
      label: 'Recovered Count',
      value: metrics?.count_recovered ?? 0,
      icon: <CheckCircle size={20} className="text-blue-600" />,
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-700',
    },
    {
      label: 'Escalated to Human',
      value: metrics?.count_escalated ?? 0,
      icon: <AlertTriangle size={20} className="text-amber-600" />,
      color: 'bg-amber-50 border-amber-200',
      textColor: 'text-amber-700',
    },
    {
      label: 'Reminders Sent',
      value: metrics?.count_reminder ?? 0,
      icon: <Mail size={20} className="text-indigo-600" />,
      color: 'bg-indigo-50 border-indigo-200',
      textColor: 'text-indigo-700',
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <div key={i} className={`p-5 rounded-xl border bg-white shadow-sm flex items-center justify-between`}>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{c.label}</p>
            <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{c.value}</p>
          </div>
          <div className={`p-3 rounded-xl ${c.color}`}>
            {c.icon}
          </div>
        </div>
      ))}
    </div>
  );
}
