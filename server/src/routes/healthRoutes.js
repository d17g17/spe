const express = require('express');
const router = express.Router();
const os = require('os');
const process = require('process');

/**
 * Health check endpoint to monitor server status
 * Returns server health metrics including load and memory usage
 */
router.get('/health', (req, res) => {
  // Explicitly set CORS headers for health endpoint
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAverage = os.loadavg();
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    
    // Calculate memory usage percentage
    const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    // Determine server health status
    let status = 'healthy';
    let warnings = [];
    
    // Check memory usage (warn if > 80%, critical if > 90%)
    if (memoryUsagePercent > 90) {
      status = 'critical';
      warnings.push('High memory usage');
    } else if (memoryUsagePercent > 80) {
      status = 'warning';
      warnings.push('Elevated memory usage');
    }
    
    // Check load average (warn if > 80% of CPU cores)
    const cpuCores = os.cpus().length;
    if (loadAverage[0] > cpuCores * 0.8) {
      if (status !== 'critical') {
        status = 'warning';
      }
      warnings.push('High CPU load');
    }
    
    // Check heap usage (warn if > 80% of heap limit)
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (heapUsagePercent > 80) {
      if (status !== 'critical') {
        status = 'warning';
      }
      warnings.push('High heap usage');
    }
    
    res.json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        usage: memoryUsage,
        systemFree: freeMemory,
        systemTotal: totalMemory,
        usagePercent: Math.round(memoryUsagePercent * 100) / 100,
        heapUsagePercent: Math.round(heapUsagePercent * 100) / 100
      },
      cpu: {
        usage: cpuUsage,
        loadAverage,
        cores: cpuCores
      },
      warnings
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Handle preflight OPTIONS requests for CORS
 */
router.options('/health', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

module.exports = router;