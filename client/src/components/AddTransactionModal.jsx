import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

const FAILURE_REASONS = [
  { value: 'insufficient_funds', label: 'Insufficient Funds' },
  { value: 'card_expired',       label: 'Card Expired' },
  { value: 'network_timeout',    label: 'Network Timeout' },
  { value: 'wrong_upi_pin',      label: 'Wrong UPI PIN' },
  { value: 'fraud_suspected',    label: 'Fraud Suspected' },
  { value: 'Other',              label: 'Other (Type custom reason)' },
];

const MERCHANTS = ['Zomato', 'Swiggy', 'CRED', 'Zepto', 'PhonePe', 'Blinkit', 'MakeMyTrip', 'Myntra', 'Other'];

const inputClass = `w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5
  text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-blue-600
  focus:ring-2 focus:ring-blue-100 transition-colors shadow-sm font-medium`;

const labelClass = 'block text-xs text-gray-700 uppercase tracking-wider font-bold mb-1.5';

export default function AddTransactionModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    merchant: '',
    custom_merchant: '',
    customer_email: '',
    customer_phone: '',
    amount: '',
    failure_reason: 'insufficient_funds',
    custom_failure_reason: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const finalMerchant = form.merchant === 'Other' ? form.custom_merchant.trim() : form.merchant;
    const finalFailureReason = form.failure_reason === 'Other' ? form.custom_failure_reason.trim() : form.failure_reason;

    if (!finalMerchant || !form.customer_email || !form.amount || !finalFailureReason) {
      setError('Please fill in all required fields.');
      return;
    }
    if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setError('Amount must be a valid positive number.');
      return;
    }

    setLoading(true);
    try {
      await onAdd({
        ...form,
        merchant: finalMerchant,
        failure_reason: finalFailureReason
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add transaction.');
    } finally {
      setLoading(false);
    }
  }

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md mx-4 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-slate-50 rounded-t-2xl">
          <div>
            <h2 className="text-gray-900 font-extrabold text-lg">Add Failed Transaction</h2>
            <p className="text-gray-500 text-xs mt-0.5 font-medium">Manually create a transaction for recovery</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-lg hover:bg-gray-200">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          <div>
            <label className={labelClass}>Merchant *</label>
            <select name="merchant" value={form.merchant} onChange={handleChange} className={inputClass}>
              <option value="">Select merchant...</option>
              {MERCHANTS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {form.merchant === 'Other' && (
              <input
                type="text" name="custom_merchant" value={form.custom_merchant}
                onChange={handleChange} placeholder="Type merchant name..."
                className={`${inputClass} mt-2 animate-in fade-in slide-in-from-top-2`} autoFocus
              />
            )}
          </div>

          <div>
            <label className={labelClass}>Customer Email *</label>
            <input
              type="email" name="customer_email" value={form.customer_email}
              onChange={handleChange} placeholder="customer@gmail.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Customer Phone <span className="text-gray-400 normal-case tracking-normal font-medium">(optional)</span></label>
            <input
              type="text" name="customer_phone" value={form.customer_phone}
              onChange={handleChange} placeholder="9876543210"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Amount (₹) *</label>
            <input
              type="number" name="amount" value={form.amount}
              onChange={handleChange} placeholder="e.g. 1299"
              min="1" className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Failure Reason *</label>
            <select name="failure_reason" value={form.failure_reason} onChange={handleChange} className={inputClass}>
              {FAILURE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {form.failure_reason === 'Other' && (
              <input
                type="text" name="custom_failure_reason" value={form.custom_failure_reason}
                onChange={handleChange} placeholder="Type exact error message or code..."
                className={`${inputClass} mt-2 animate-in fade-in slide-in-from-top-2`} autoFocus
              />
            )}
            {(form.failure_reason === 'fraud_suspected' || form.custom_failure_reason.toLowerCase().includes('fraud')) && (
              <p className="text-amber-600 font-bold text-xs mt-2 bg-amber-50 p-2 rounded border border-amber-100">
                ⚠ Fraud suspected transactions will be escalated to a human agent.
              </p>
            )}
          </div>

          {/* Error */}
          {error && <p className="text-red-700 font-semibold text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 bg-white
                hover:bg-gray-50 hover:text-gray-900 text-sm font-bold transition-colors shadow-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-sm
                disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Adding...' : <><Plus size={16} /> Add Transaction</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
