/**
 * BatchOperationService
 * Handles all batch processing operations with concurrency control
 */
const pLimit = require('p-limit').default;
const logger = require('../utils/logger');

// Default batch processing settings
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_CONCURRENCY = 15;

/**
 * Process an array of items in batches with controlled concurrency
 * @param {Array<any>} items - Array of items to process
 * @param {Function} processingFunction - Function to process each item
 * @param {Object} options - Batch processing options
 * @returns {Promise<Object>} - Processing results
 */
const processBatches = async (items, processingFunction, options = {}) => {
  // Configuration with defaults
  const {
    batchSize = DEFAULT_BATCH_SIZE,
    concurrency = DEFAULT_CONCURRENCY,
    onBatchComplete = null,
    onBatchStart = null,
    onItemComplete = null,
    context = {}
  } = options;
  
  // Start timer for overall process
  const overallStartTime = Date.now();
  
  // Create concurrency limiter
  const limit = pLimit(concurrency);
  
  // Create batches of items to process
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  // Track metrics
  const metrics = {
    totalItems: items.length,
    totalBatches: batches.length,
    processingTimeMs: 0,
    itemProcessingTimes: [],
    batchTimes: [],
    successfulItems: 0,
    failedItems: 0
  };
  
  // Process all batches sequentially (but items within batch in parallel)
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchStartTime = Date.now();
    
    // Call batch start callback if provided
    if (onBatchStart) {
      await onBatchStart(batch, batchIndex, metrics, context);
    }
    
    logger.debug('BATCH', `Processing batch ${batchIndex + 1}/${batches.length}: ${batch.length} items`);
    
    // Process all items in this batch in parallel with concurrency limit
    const itemPromises = batch.map(item => 
      limit(async () => {
        const itemStartTime = Date.now();
        try {
          // Process the item
          const result = await processingFunction(item, context);
          
          // Record successful processing
          metrics.successfulItems++;
          metrics.itemProcessingTimes.push(Date.now() - itemStartTime);
          
          // Call item complete callback if provided
          if (onItemComplete) {
            await onItemComplete(item, result, true, null, metrics, context);
          }
          
          return { item, success: true, result };
        } catch (error) {
          // Record failed processing
          metrics.failedItems++;
          metrics.itemProcessingTimes.push(Date.now() - itemStartTime);
          
          // Log error but continue processing
          logger.error('BATCH', `Error processing item: ${error.message}`);
          
          // Call item complete callback if provided
          if (onItemComplete) {
            await onItemComplete(item, null, false, error, metrics, context);
          }
          
          return { item, success: false, error };
        }
      })
    );
    
    // Wait for all items in this batch to complete
    const batchResults = await Promise.all(itemPromises);
    const batchTimeMs = Date.now() - batchStartTime;
    
    // Record batch processing time
    metrics.batchTimes.push({
      batchIndex,
      size: batch.length,
      successCount: batchResults.filter(r => r.success).length,
      failureCount: batchResults.filter(r => !r.success).length,
      timeMs: batchTimeMs
    });
    
    // Log batch completion
    logger.debug('BATCH', 
      `Completed batch ${batchIndex + 1}/${batches.length}. ` +
      `Success: ${batchResults.filter(r => r.success).length}/${batch.length}. ` +
      `Time: ${batchTimeMs}ms`
    );
    
    // Call batch complete callback if provided
    if (onBatchComplete) {
      await onBatchComplete(batch, batchResults, batchIndex, metrics, context);
    }
  }
  
  // Calculate final metrics
  metrics.processingTimeMs = Date.now() - overallStartTime;
  metrics.avgItemProcessingTimeMs = metrics.itemProcessingTimes.length > 0
    ? metrics.itemProcessingTimes.reduce((sum, time) => sum + time, 0) / metrics.itemProcessingTimes.length
    : 0;
  metrics.avgBatchProcessingTimeMs = metrics.batchTimes.length > 0
    ? metrics.batchTimes.reduce((sum, b) => sum + b.timeMs, 0) / metrics.batchTimes.length
    : 0;
  metrics.throughputItemsPerSecond = metrics.processingTimeMs > 0
    ? (metrics.successfulItems / (metrics.processingTimeMs / 1000))
    : 0;
  
  // Return final results
  return {
    success: metrics.failedItems === 0,
    metrics,
    successCount: metrics.successfulItems,
    failureCount: metrics.failedItems,
    totalCount: metrics.totalItems,
    processingTimeMs: metrics.processingTimeMs
  };
};

/**
 * Process a single batch of items with controlled concurrency
 * @param {Array<any>} items - Array of items to process
 * @param {Function} processingFunction - Function to process each item
 * @param {number} concurrency - Maximum number of parallel operations
 * @param {Object} context - Context data to pass to processing function
 * @returns {Promise<Object>} - Batch processing results
 */
const processSingleBatch = async (items, processingFunction, concurrency = DEFAULT_CONCURRENCY, context = {}) => {
  const batchStartTime = Date.now();
  const limit = pLimit(concurrency);
  
  const itemPromises = items.map(item => 
    limit(async () => {
      try {
        const result = await processingFunction(item, context);
        return { item, success: true, result };
      } catch (error) {
        logger.error('BATCH', `Error processing item: ${error.message}`);
        return { item, success: false, error };
      }
    })
  );
  
  const results = await Promise.all(itemPromises);
  
  return {
    batch: items,
    results,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length,
    processingTimeMs: Date.now() - batchStartTime
  };
};

module.exports = {
  processBatches,
  processSingleBatch,
  // executeWithConcurrency removed – use processBatches or pLimit directly where needed
};
