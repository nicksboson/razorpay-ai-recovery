const { Groq } = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Utility sleep function — used for rate limit handling and spacing calls
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * diagnoseTransaction(transaction)
 *
 * Sends a failed transaction to Groq LLM for contextual diagnosis.
 * The AI acts as the "brain" — it interprets the failure and recommends
 * a recovery action based on reasoning, NOT hardcoded if/then logic.
 *
 * Returns a structured JSON object with:
 *   - root_cause:  why the payment failed
 *   - action:      what the agent should do (retry | remind | escalate | skip)
 *   - reasoning:   why the AI chose that action
 *   - should_stop: whether the stopping rules apply
 *   - stop_reason: if should_stop, why
 *
 * All stopping rules are ALSO enforced by executor.js BEFORE this is called.
 * The AI reinforces them — the executor enforces them as a hard guarantee.
 */
async function diagnoseTransaction(transaction) {

  const systemMessage = `You are an AI revenue recovery agent for Razorpay.
Your job is to analyze failed payment transactions and decide the best recovery action.
Always respond with valid JSON only. No markdown. No explanation outside the JSON object.`;

  const userMessage = `Analyze this failed payment transaction and decide the recovery action.

TRANSACTION DATA:
${JSON.stringify({
  id: transaction._id,
  merchant: transaction.merchant,
  amount_inr: transaction.amount,
  failure_reason: transaction.failure_reason,
  retry_count: transaction.retry_count,
  customer_email: transaction.customer_email
}, null, 2)}

RETURN THIS EXACT JSON STRUCTURE:
{
  "root_cause": "one sentence explaining why this payment failed",
  "action": "retry_payment OR send_reminder_email OR escalate_human OR skip",
  "reasoning": "one sentence explaining why you chose this action",
  "should_stop": true or false,
  "stop_reason": "reason if should_stop is true, otherwise null"
}

RULES YOU MUST FOLLOW:
- failure_reason is "fraud_suspected" → action MUST be "escalate_human"
- retry_count >= 3 → should_stop MUST be true, action MUST be "skip"
- amount_inr < 50 → action MUST be "skip"
- "insufficient_funds" or "wrong_upi_pin" → try "retry_payment" first
- "card_expired" → use "send_reminder_email" (retry won't help)
- "network_timeout" → use "retry_payment" (likely transient)`;

  // Safe fallback if AI call or JSON parse fails — never crash the batch
  const fallback = {
    root_cause: "AI diagnosis unavailable",
    action: "skip",
    reasoning: "Fallback due to AI error",
    should_stop: true,
    stop_reason: "ai_parse_error"
  };

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user",   content: userMessage }
      ],
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      temperature: 0.1,           // Low temperature = consistent, deterministic JSON
      max_completion_tokens: 300, // Diagnosis needs very few tokens
      top_p: 1,
      stream: false,              // NO streaming — we need the full JSON at once
      reasoning_effort: "medium",
      stop: null
    });

    const raw = chatCompletion.choices[0]?.message?.content || "";

    try {
      return JSON.parse(raw);
    } catch (parseError) {
      console.error("[aiAgent] JSON parse failed for transaction", transaction._id, "| raw:", raw);
      return fallback;
    }

  } catch (error) {
    // Rule AI-5: Handle Groq 429 rate limit — wait 2s and retry once
    if (error?.status === 429) {
      console.error("[aiAgent] Groq rate limited — retrying in 2s...");
      await sleep(2000);
      try {
        const retry = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemMessage },
            { role: "user",   content: userMessage }
          ],
          model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
          temperature: 0.1,
          max_completion_tokens: 300,
          top_p: 1,
          stream: false,
          reasoning_effort: "medium",
          stop: null
        });
        const retryRaw = retry.choices[0]?.message?.content || "{}";
        try {
          return JSON.parse(retryRaw);
        } catch {
          console.error("[aiAgent] Retry JSON parse also failed. Using fallback.");
          return fallback;
        }
      } catch (retryError) {
        console.error("[aiAgent] Retry after 429 also failed:", retryError.message);
        return fallback;
      }
    }

    console.error("[aiAgent] Groq call failed:", error.message);
    return fallback;
  }
}

module.exports = { diagnoseTransaction, sleep };
