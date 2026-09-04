import React from 'react';

const STATUS_STYLES = {
  failed: 'bg-red-50 text-red-700 border-red-200',
  recovered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reminder_sent: 'bg-blue-50 text-blue-700 border-blue-200',
  escalated: 'bg-amber-50 text-amber-700 border-amber-200',
  skipped: 'bg-gray-100 text-gray-700 border-gray-200'
};

export default function TransactionTable({ transactions }) {
  if (!transactions?.length) {
    return (
      <div className="py-20 text-center border border-dashed border-gray-300 rounded-2xl bg-white shadow-sm">
        <p className="text-gray-500 font-medium">No transactions found. Add or generate some data.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-widest font-bold">
            <tr>
              <th className="px-6 py-4">Merchant</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Failure Reason</th>
              <th className="px-6 py-4">Retries</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map(tx => (
              <tr key={tx._id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-gray-900">{tx.merchant}</td>
                <td className="px-6 py-4 text-gray-600">
                  <div className="font-medium text-gray-900">{tx.customer_email}</div>
                  {tx.customer_phone && (
                    <div className="text-xs text-gray-500 mt-0.5">{tx.customer_phone}</div>
                  )}
                </td>
                <td className="px-6 py-4 font-bold text-gray-900 tracking-tight">₹{tx.amount.toLocaleString('en-IN')}</td>
                <td className="px-6 py-4 text-gray-600 capitalize">
                  {tx.failure_reason.replace(/_/g, ' ')}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold border
                    ${tx.retry_count >= 3 ? 'bg-red-50 text-red-700 border-red-200' : 
                      tx.retry_count > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                      'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {tx.retry_count} / 3
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border capitalize ${STATUS_STYLES[tx.status] || STATUS_STYLES.skipped}`}>
                    {tx.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
