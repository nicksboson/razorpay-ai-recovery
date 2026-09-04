const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  merchant: { type: String, required: true },
  customer_email: { type: String, required: true },
  customer_phone: { type: String, default: '' },
  amount: { type: Number, required: true },
  failure_reason: { type: String, required: true },
  retry_count: { type: Number, default: 0 },
  status: { type: String, default: 'failed', enum: ['failed', 'recovered', 'reminder_sent', 'escalated', 'skipped'] },
  created_at: { type: Date, default: Date.now }
});

// Indexes per DB-5
transactionSchema.index({ status: 1 });
transactionSchema.index({ retry_count: 1 });

module.exports = mongoose.model('Transaction', transactionSchema, 'transactions');
