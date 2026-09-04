const express = require('express');
const router = express.Router();

const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const { detectAtRiskTransactions } = require('../services/detector');
const { executeRecovery } = require('../services/executor');
const { sleep } = require('../services/aiAgent');
const { faker } = require('@faker-js/faker');

// Module-level flag to prevent concurrent batch runs — Rule BE-4
let isRunning = false;

// ─── POST /api/transactions ───────────────────────────────────────────────────
// Creates a single new failed transaction manually (for demo / manual input)
router.post('/transactions', async (req, res) => {
  try {
    const { merchant, customer_email, customer_phone, amount, failure_reason } = req.body;

    // Basic validation
    if (!merchant || !customer_email || !amount || !failure_reason) {
      return res.status(400).json({ success: false, error: 'merchant, customer_email, amount, and failure_reason are required' });
    }

    const tx = await Transaction.create({
      merchant,
      customer_email,
      customer_phone: customer_phone || '',
      amount: Number(amount),
      failure_reason,
      retry_count: 0,
      status: 'failed'
    });

    res.status(201).json({ success: true, data: tx });
  } catch (err) {
    console.error('[POST /transactions]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/transactions/bulk ──────────────────────────────────────────────
// Accepts an array of transactions from a CSV/Excel import and bulk inserts them
router.post('/transactions/bulk', async (req, res) => {
  try {
    const { transactions } = req.body;
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ success: false, error: 'No transactions provided' });
    }

    const docs = transactions.map(t => {
      // Map and normalize fields, ensuring required ones exist
      return {
        merchant: t.merchant || 'Imported Merchant',
        customer_email: t.customer_email || t.email || 'no-email@provided.com',
        customer_phone: t.customer_phone || t.phone || '',
        amount: Number(t.amount) || Number(t.amount_inr) || 0,
        failure_reason: t.failure_reason || t.reason || 'network_timeout',
        retry_count: 0,
        status: 'failed'
      };
    }).filter(t => t.amount > 0); // Drop completely invalid rows

    if (docs.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid transactions found in file' });
    }

    const inserted = await Transaction.insertMany(docs);
    res.status(201).json({ success: true, count: inserted.length });
  } catch (err) {
    console.error('[POST /transactions/bulk]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/seed/reset ─────────────────────────────────────────────────────
// Wipes all transactions + audit logs and re-seeds 20 fresh failed transactions.
// USE ONLY FOR DEMO RESET — this is the one place we allow deletion (seed reset).
router.post('/seed/reset', async (req, res) => {
  try {
    const MERCHANTS = ['Zomato', 'Swiggy', 'CRED', 'Zepto', 'PhonePe', 'Blinkit', 'MakeMyTrip', 'Myntra'];
    await Transaction.deleteMany({});
    await AuditLog.deleteMany({});
    
    res.json({ success: true, message: 'Database completely cleared.' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset database' });
  }
});

// Returns all transactions sorted by created_at descending
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find({}).sort({ created_at: -1 });
    res.json({ success: true, data: transactions });
  } catch (err) {
    console.error('[GET /transactions]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/audit ───────────────────────────────────────────────────────────
// Returns all audit logs sorted by timestamp descending (most recent first)
router.get('/audit', async (req, res) => {
  try {
    const logs = await AuditLog.find({}).sort({ timestamp: -1 });
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[GET /audit]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/metrics ─────────────────────────────────────────────────────────
// Returns aggregate recovery metrics for the dashboard MetricsBar
router.get('/metrics', async (req, res) => {
  try {
    const allTransactions = await Transaction.find({});

    const total_transactions = allTransactions.length;
    const total_at_risk_amount = allTransactions.reduce((sum, t) => sum + t.amount, 0);

    const recovered     = allTransactions.filter(t => t.status === 'recovered');
    const escalated     = allTransactions.filter(t => t.status === 'escalated');
    const skipped       = allTransactions.filter(t => t.status === 'skipped');
    const reminderSent  = allTransactions.filter(t => t.status === 'reminder_sent');
    const failed        = allTransactions.filter(t => t.status === 'failed');

    const total_recovered_amount = recovered.reduce((sum, t) => sum + t.amount, 0);
    const recovery_rate = total_at_risk_amount > 0
      ? parseFloat(((total_recovered_amount / total_at_risk_amount) * 100).toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        total_at_risk_amount,
        total_recovered_amount,
        recovery_rate,
        count_recovered:  recovered.length,
        count_escalated:  escalated.length,
        count_skipped:    skipped.length,
        count_reminder:   reminderSent.length,
        count_failed:     failed.length,
        total_transactions
      }
    });
  } catch (err) {
    console.error('[GET /metrics]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/recover ────────────────────────────────────────────────────────
// Triggers the full recovery batch pipeline on all "failed" transactions.
// Runs sequentially with 500ms between AI calls to avoid rate limits — Rule BE-4.
// Returns 409 if a batch is already in progress — Rule BE-4.
router.post('/recover', async (req, res) => {
  if (isRunning) {
    return res.status(409).json({ success: false, error: 'Batch already in progress' });
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    // Step 1: Detect all at-risk transactions
    const atRiskTransactions = await detectAtRiskTransactions();

    // Also handle the transactions excluded by detector (amount < 50, retry >= 3)
    // detector already filters these — executor handles them via pre-checks if needed
    const summary = {
      processed: 0,
      recovered: 0,
      escalated: 0,
      skipped: 0,
      reminder_sent: 0,
      retry_failed: 0,
      total_recovered_amount: 0,
      duration_ms: 0
    };

    // Step 2: Run each transaction through the full pipeline sequentially
    for (const transaction of atRiskTransactions) {
      try {
        const result = await executeRecovery(transaction);
        summary.processed++;

        switch (result.auditEntry.outcome) {
          case 'recovered':      summary.recovered++;      summary.total_recovered_amount += transaction.amount; break;
          case 'escalated':      summary.escalated++;      break;
          case 'skipped':        summary.skipped++;        break;
          case 'reminder_sent':  summary.reminder_sent++;  break;
          case 'retry_failed':   summary.retry_failed++;   break;
        }
      } catch (txErr) {
        // Rule BE-6: AI call failure → log error, mark as skipped, continue batch (never crash)
        console.error(`[POST /recover] Error processing transaction ${transaction._id}:`, txErr.message);
        summary.processed++;
        summary.skipped++;
        // Still write an audit log for the failed processing attempt
        try {
          await AuditLog.create({
            transaction_id: transaction._id,
            amount: transaction.amount,
            ai_action: 'skip',
            ai_reasoning: 'Processing error — transaction skipped to protect batch integrity.',
            root_cause: 'Internal processing error',
            outcome: 'skipped',
            stopped_by_rule: false,
            stop_reason: 'processing_error',
            timestamp: new Date()
          });
          await Transaction.findByIdAndUpdate(transaction._id, { status: 'skipped' });
        } catch (auditErr) {
          console.error('[POST /recover] Failed to write error audit log:', auditErr.message);
        }
      }

      // 500ms delay between each AI call — Rule BE-4, AI-5
      await sleep(500);
    }

    summary.duration_ms = Date.now() - startTime;

    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('[POST /recover]', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    // Always release the lock, even if an error occurs
    isRunning = false;
  }
});

// ─── GET /api/audit/export ────────────────────────────────────────────────────
// Returns a downloadable CSV of all audit logs for merchant transparency.
// CSV columns: timestamp, transaction_id, amount, ai_action, root_cause, outcome, stopped_by_rule
router.get('/audit/export', async (req, res) => {
  try {
    const logs = await AuditLog.find({}).sort({ timestamp: -1 });

    const headers = ['timestamp', 'transaction_id', 'amount', 'ai_action', 'root_cause', 'outcome', 'stopped_by_rule', 'stop_reason', 'ai_reasoning'];

    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.transaction_id?.toString() || '',
      log.amount,
      log.ai_action,
      `"${(log.root_cause || '').replace(/"/g, '""')}"`,
      log.outcome,
      log.stopped_by_rule,
      log.stop_reason || '',
      `"${(log.ai_reasoning || '').replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-trail.csv"');
    res.send(csv);
  } catch (err) {
    console.error('[GET /audit/export]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
