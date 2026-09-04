const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
require('dotenv').config();

const Transaction = require('./models/Transaction');
const AuditLog = require('./models/AuditLog');

const MERCHANTS = ['Zomato', 'Swiggy', 'CRED', 'Zepto', 'PhonePe', 'Blinkit', 'MakeMyTrip', 'Myntra'];

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("Missing MONGODB_URI in .env");
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for seeding...");

    // Clear existing data
    await Transaction.deleteMany({});
    await AuditLog.deleteMany({});
    console.log("Cleared existing collections.");

    const transactions = [];

    // Distribution: 6 insufficient_funds, 4 card_expired, 4 network_timeout, 3 wrong_upi_pin, 2 fraud_suspected, 1 under ₹50
    const failureDistribution = [
      ...Array(6).fill('insufficient_funds'),
      ...Array(4).fill('card_expired'),
      ...Array(4).fill('network_timeout'),
      ...Array(3).fill('wrong_upi_pin'),
      ...Array(2).fill('fraud_suspected'),
      'insufficient_funds' // This will be the 1 under ₹50
    ];

    let totalAmount = 0;

    for (let i = 0; i < 20; i++) {
      const reason = failureDistribution[i];
      let amount = faker.number.int({ min: 99, max: 9999 });
      
      // Ensure the last one is under ₹50
      if (i === 19) {
        amount = faker.number.int({ min: 10, max: 49 });
      }

      // Ensure at least 2 transactions with retry_count: 2 (we'll make the first 2 network_timeouts have retry_count 2)
      let retryCount = 0;
      if (i >= 10 && i < 12) { // 10 and 11 are network_timeout
        retryCount = 2;
      }

      const tx = new Transaction({
        merchant: faker.helpers.arrayElement(MERCHANTS),
        customer_email: faker.internet.email(),
        customer_phone: faker.phone.number({ style: 'national' }),
        amount: amount,
        failure_reason: reason,
        retry_count: retryCount,
        status: 'failed'
      });

      transactions.push(tx);
      totalAmount += amount;
    }

    await Transaction.insertMany(transactions);
    console.log(`✅ Seeded exactly 20 transactions.`);
    console.log(`💰 Total ₹ At Risk: ₹${totalAmount.toLocaleString('en-IN')}`);
    
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seed();
