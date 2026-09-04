const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const recoveryRoutes = require('./routes/recovery');

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
// Allow ALL origins for the hackathon deployment to prevent any CORS blockages
app.use(cors());
app.use(express.json());

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api', recoveryRoutes);

// Health check — useful for Render deployment monitoring
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ─── DATABASE + SERVER START ──────────────────────────────────────────────────
// Rule BE-6: MongoDB connection failure → exit process with code 1
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
