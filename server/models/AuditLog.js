const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  amount: { type: Number, required: true },
  ai_action: { type: String, required: true },
  ai_reasoning: { type: String, required: true },
  root_cause: { type: String, required: true },
  outcome: { type: String, required: true },
  stopped_by_rule: { type: Boolean, required: true },
  stop_reason: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
});

// Indexes per DB-5
auditLogSchema.index({ transaction_id: 1 });
auditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema, 'auditlogs');
