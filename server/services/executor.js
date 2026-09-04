const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const { diagnoseTransaction, sleep } = require('./aiAgent');
const { sendReminderEmail, sendEscalationEmail } = require('./emailService');

/**
 * executeRecovery(transaction)
 *
 * The core recovery pipeline for a single transaction.
 * This is the "executor" layer — it sits between the AI brain and the database.
 *
 * Flow:
 *   1. PRE-CHECKS (deterministic guardrails — fire BEFORE calling AI)
 *      → If retry_count >= 3 → skip immediately, no AI call
 *      → If amount < 50     → skip immediately, no AI call
 *   2. DIAGNOSE — call AI agent for root cause + action
 *   3. EXECUTE  — run the action, update transaction status
 *   4. LOG      — write an immutable AuditLog entry for EVERY transaction
 *   5. RETURN   — { transaction, auditEntry, decision }
 *
 * Rules enforced: DB-2, DB-3, DB-4, AI-2 from orchestrator.md
 */
async function executeRecovery(transaction) {
  let decision = null;
  let outcome = null;
  let stoppedByRule = false;
  let stopReason = null;

  // ─── STEP 1: DETERMINISTIC PRE-CHECKS ────────────────────────────────────
  // These are HARD stops. The AI is never called if these fire.
  // Rule AI-2 from orchestrator.md.

  if (transaction.retry_count >= 3) {
    stoppedByRule = true;
    stopReason = 'max_retries_exceeded';
    decision = {
      root_cause: 'Transaction has been retried the maximum number of times.',
      action: 'skip',
      reasoning: 'Hard stop: retry_count >= 3. No further attempts allowed.',
      should_stop: true,
      stop_reason: stopReason
    };
  } else if (transaction.amount < 50) {
    stoppedByRule = true;
    stopReason = 'amount_below_minimum';
    decision = {
      root_cause: 'Transaction amount is below the minimum recovery threshold.',
      action: 'skip',
      reasoning: 'Hard stop: amount < ₹50. Recovery cost exceeds transaction value.',
      should_stop: true,
      stop_reason: stopReason
    };
  }

  // ─── STEP 2: AI DIAGNOSIS (only if not stopped by pre-checks) ────────────
  if (!stoppedByRule) {
    decision = await diagnoseTransaction(transaction);
    // 500ms sleep after every AI call — Rule AI-5, BE-4
    await sleep(500);
  }

  // ─── STEP 3: EXECUTE ACTION ───────────────────────────────────────────────
  // Map AI decision to a real status change on the transaction.
  // Rule DB-2: status only flows in one direction.
  // Rule DB-3: retry_count increments ONLY on retry_payment.

  const action = decision.action;

  switch (action) {
    case 'retry_payment': {
      // Simulate payment gateway retry — 70% success rate
      const success = Math.random() > 0.3;
      if (success) {
        transaction.status = 'recovered';
        outcome = 'recovered';
      } else {
        // Retry failed — status stays "failed", retry_count increments
        // so the next batch run will try again (up to the cap of 3)
        transaction.status = 'failed';
        outcome = 'retry_failed';
      }
      // Rule DB-3: only increment on retry_payment action
      transaction.retry_count += 1;
      break;
    }

    case 'send_reminder_email': {
      // Actually send the email using Nodemailer (Ethereal or Gmail)
      await sendReminderEmail(transaction);

      transaction.status = 'reminder_sent';
      outcome = 'reminder_sent';
      // Rule DB-3: do NOT increment retry_count
      break;
    }

    case 'escalate_human': {
      // Send an alert to your internal team about this issue (e.g. Fraud)
      await sendEscalationEmail(transaction, decision.reasoning);

      transaction.status = 'escalated';
      outcome = 'escalated';
      // Rule DB-3: do NOT increment retry_count
      break;
    }

    case 'skip':
    default: {
      transaction.status = 'skipped';
      outcome = 'skipped';
      // Rule DB-3: do NOT increment retry_count
      break;
    }
  }

  // Rule DB-4: save updated transaction (only status + retry_count change)
  await transaction.save();

  // ─── STEP 4: WRITE AUDIT LOG ──────────────────────────────────────────────
  // Rule: AuditLog created for EVERY transaction — even skipped/stopped ones.
  // Rule DB-4: append-only, never update or delete.

  const auditEntry = await AuditLog.create({
    transaction_id: transaction._id,
    amount: transaction.amount,
    ai_action: action,
    ai_reasoning: decision.reasoning,
    root_cause: decision.root_cause,
    outcome: outcome,
    stopped_by_rule: stoppedByRule,
    stop_reason: stopReason,
    timestamp: new Date()
  });

  // ─── STEP 5: RETURN RESULT ────────────────────────────────────────────────
  return {
    transaction,
    auditEntry,
    decision
  };
}

module.exports = { executeRecovery };
