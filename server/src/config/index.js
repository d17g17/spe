// Centralized configuration helper
// Reads environment variables and exposes strongly-typed defaults so that
// services don’t keep their own scattered constants.
// Extend as needed for new domains.

const dotenv = require('dotenv');
// Ensure .env is read once – no-op if already loaded elsewhere
dotenv.config();

module.exports = {
  steam: {
    // Maximum concurrent Steam-API requests application-wide
    maxConcurrency: parseInt(process.env.MAX_STEAM_API_CONCURRENCY || '120', 10) // Increased from 80 to 120 for optimal proxy utilization
  },
  batch: {
    // Default items per batch when splitting large arrays
    defaultBatchSize: parseInt(process.env.DEFAULT_BATCH_SIZE || '75', 10) // Reduced from 100 to 75 for optimal processing
  },
  profile: {
    // Minutes a cached profile remains fresh
    cacheExpiryMinutes: parseInt(process.env.PROFILE_CACHE_EXPIRY_MINUTES || '60', 10)
  },
  pricing: {
    // Hours after which case prices expire and need re-fetching
    casePriceExpiryHours: parseInt(process.env.CASE_PRICE_EXPIRY_HOURS || '24', 10)
  }
};
