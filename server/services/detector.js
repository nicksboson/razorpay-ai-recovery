const Transaction = require('../models/Transaction');

/**
 * detectAtRiskTransactions()
 * Fetches ALL "failed" transactions from the DB so the executor can process them.
 * (The executor itself applies the amount < 50 and retry >= 3 rules so that
 * an Audit Log is properly generated for skipped transactions).
 *
 * Returns: array of full transaction documents, sorted by amount descending
 */
async function detectAtRiskTransactions() {
  const transactions = await Transaction.find({
    status: 'failed'
  }).sort({ amount: -1 });

  return transactions;
}

module.exports = { detectAtRiskTransactions };
