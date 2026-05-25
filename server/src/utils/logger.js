/**
 * Enhanced Human-Readable Logging System
 * Designed for maximum clarity and understanding of application flow
 */

const fs = require('fs');
const path = require('path');

// Enhanced color palette for better visual distinction
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Primary colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Bright colors
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m'
};

// Comprehensive log levels with clear visual hierarchy
const LOG_LEVELS = {
  TRACE: { 
    priority: 0, 
    icon: '🔍', 
    color: colors.brightBlack, 
    label: 'TRACE',
    description: 'Detailed execution flow'
  },
  DEBUG: { 
    priority: 1, 
    icon: '🐛', 
    color: colors.cyan, 
    label: 'DEBUG',
    description: 'Development information'
  },
  INFO: { 
    priority: 2, 
    icon: '💡', 
    color: colors.blue, 
    label: 'INFO',
    description: 'General information'
  },
  SUCCESS: { 
    priority: 3, 
    icon: '✅', 
    color: colors.green, 
    label: 'SUCCESS',
    description: 'Successful operations'
  },
  WARN: { 
    priority: 4, 
    icon: '⚠️', 
    color: colors.yellow, 
    label: 'WARN',
    description: 'Warning conditions'
  },
  ERROR: { 
    priority: 5, 
    icon: '❌', 
    color: colors.red, 
    label: 'ERROR',
    description: 'Error conditions'
  },
  FATAL: { 
    priority: 6, 
    icon: '💀', 
    color: colors.brightRed, 
    label: 'FATAL',
    description: 'Critical system errors'
  }
};

// Specialized context categories for better organization
const CONTEXTS = {
  // Core System
  SYSTEM: { icon: '⚙️', color: colors.brightMagenta, label: 'SYSTEM' },
  SERVER: { icon: '🖥️', color: colors.brightBlue, label: 'SERVER' },
  DATABASE: { icon: '🗃️', color: colors.magenta, label: 'DATABASE' },
  
  // External APIs
  STEAM_API: { icon: '🎮', color: colors.cyan, label: 'STEAM-API' },
  PROXY: { icon: '🔄', color: colors.brightCyan, label: 'PROXY' },
  
  // Business Logic
  INVENTORY: { icon: '🎒', color: colors.green, label: 'INVENTORY' },
  PRICING: { icon: '💰', color: colors.yellow, label: 'PRICING' },
  FRIENDS: { icon: '👥', color: colors.blue, label: 'FRIENDS' },
  PROFILE: { icon: '👤', color: colors.brightGreen, label: 'PROFILE' },
  
  // Communication
  WEBSOCKET: { icon: '🔌', color: colors.brightYellow, label: 'WEBSOCKET' },
  HTTP: { icon: '🌐', color: colors.brightBlue, label: 'HTTP' },
  
  // Operations
  CACHE: { icon: '💾', color: colors.brightMagenta, label: 'CACHE' },
  BATCH: { icon: '📦', color: colors.magenta, label: 'BATCH' },
  PERFORMANCE: { icon: '⚡', color: colors.brightCyan, label: 'PERFORMANCE' },
  SECURITY: { icon: '🔒', color: colors.red, label: 'SECURITY' }
};

// Configuration
const config = {
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'WARN' : 'INFO'),
  enableColors: process.env.NO_COLOR !== '1',
  enableTimestamps: false,
  enableContext: true,
  maxMessageLength: 200,
  enableFileLogging: process.env.ENABLE_FILE_LOGGING === '1',
  logDirectory: process.env.LOG_DIRECTORY || path.join(process.cwd(), 'logs'),
  enableDeduplication: true,
  deduplicationWindow: 5000, // 5 seconds
  enableStatistics: true
};

// Internal state
const state = {
  messageCache: new Map(),
  statistics: {
    totalMessages: 0,
    messagesByLevel: {},
    messagesByContext: {},
    duplicatesSkipped: 0,
    startTime: Date.now()
  },
  fileStream: null
};

/**
 * Initialize file logging if enabled
 */
function initializeFileLogging() {
  if (!config.enableFileLogging) return;
  
  try {
    if (!fs.existsSync(config.logDirectory)) {
      fs.mkdirSync(config.logDirectory, { recursive: true });
    }
    
    const logFile = path.join(config.logDirectory, `app-${new Date().toISOString().split('T')[0]}.log`);
    state.fileStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    // Handle stream errors
    state.fileStream.on('error', (err) => {
      console.error('Log file stream error:', err.message);
    });
    
  } catch (error) {
    console.error('Failed to initialize file logging:', error.message);
  }
}

/**
 * Format timestamp for human readability
 */
function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Format memory usage in human-readable format
 */
function formatMemory(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)}${units[unitIndex]}`;
}

/**
 * Generate cache key for deduplication
 */
function generateCacheKey(level, context, message) {
  return `${level}:${context}:${message.substring(0, 50)}`;
}

/**
 * Clean expired cache entries
 */
function cleanMessageCache() {
  const now = Date.now();
  const expired = [];
  
  for (const [key, timestamp] of state.messageCache.entries()) {
    if (now - timestamp > config.deduplicationWindow) {
      expired.push(key);
    }
  }
  
  expired.forEach(key => state.messageCache.delete(key));
}

/**
 * Check if message should be deduplicated
 */
function shouldDeduplicate(level, context, message) {
  if (!config.enableDeduplication) return false;
  
  const cacheKey = generateCacheKey(level, context, message);
  const now = Date.now();
  
  if (state.messageCache.has(cacheKey)) {
    state.statistics.duplicatesSkipped++;
    return true;
  }
  
  state.messageCache.set(cacheKey, now);
  return false;
}

/**
 * Format context with appropriate styling
 */
function formatContext(contextName, level = null) {
  // Ensure contextName is a string
  const contextStr = typeof contextName === 'string' ? contextName : String(contextName);
  
  const context = CONTEXTS[contextStr] || { 
    icon: '📝', 
    color: colors.white, 
    label: contextStr.toUpperCase() 
  };
  
  // Override color for inventory errors
  let contextColor = context.color;
  if (contextStr === 'INVENTORY' && level && (level === 'ERROR' || level === 'FATAL')) {
    contextColor = colors.red;
  }
  
  if (!config.enableColors) {
    return `[${context.label}]`;
  }
  
  return `${contextColor}${context.icon} ${context.label}${colors.reset}`;
}

/**
 * Format log level with appropriate styling
 */
function formatLevel(level) {
  const levelConfig = LOG_LEVELS[level];
  
  if (!config.enableColors) {
    return `[${levelConfig.label}]`;
  }
  
  return `${levelConfig.color}${levelConfig.icon} ${levelConfig.label}${colors.reset}`;
}

/**
 * Truncate message if too long
 */
function truncateMessage(message) {
  if (message.length <= config.maxMessageLength) {
    return message;
  }
  
  return message.substring(0, config.maxMessageLength - 3) + '...';
}

/**
 * Format additional data for display
 */
function formatData(data) {
  if (!data) return '';
  
  if (typeof data === 'string') {
    return data;
  }
  
  if (typeof data === 'object') {
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return '[Circular Object]';
    }
  }
  
  return String(data);
}

/**
 * Core logging function
 */
function log(level, context, message, data = null, options = {}) {
  // Check log level
  if (LOG_LEVELS[level].priority < LOG_LEVELS[config.logLevel].priority) {
    return;
  }
  
  // Clean cache periodically
  if (Math.random() < 0.01) { // 1% chance
    cleanMessageCache();
  }
  
  // Check for deduplication
  if (shouldDeduplicate(level, context, message) && !options.force) {
    return;
  }
  
  // Update statistics
  state.statistics.totalMessages++;
  state.statistics.messagesByLevel[level] = (state.statistics.messagesByLevel[level] || 0) + 1;
  state.statistics.messagesByContext[context] = (state.statistics.messagesByContext[context] || 0) + 1;
  
  // Format message components
  const timestamp = config.enableTimestamps ? formatTimestamp() : '';
  const formattedLevel = formatLevel(level);
  const formattedContext = config.enableContext ? formatContext(context, level) : '';
  const truncatedMessage = truncateMessage(message);
  
  // Build log line
  const parts = [];
  
  if (timestamp) {
    parts.push(config.enableColors ? `${colors.dim}${timestamp}${colors.reset}` : timestamp);
  }
  
  parts.push(formattedLevel);
  
  if (formattedContext) {
    parts.push(formattedContext);
  }
  
  if (config.enableColors) {
    parts.push(`${colors.dim}│${colors.reset}`);
  } else {
    parts.push('|');
  }
  
  parts.push(truncatedMessage);
  
  const logLine = parts.join(' ');
  
  // Output to console with spacing for better readability
  console.log(logLine);
  
  // Add subtle spacing between log entries for better readability
  if (config.enableColors && Math.random() < 0.3) { // 30% chance for spacing
    console.log(`${colors.dim}${colors.reset}`);
  }
  
  // Output additional data if provided
  if (data) {
    const formattedData = formatData(data);
    const dataLines = formattedData.split('\n');
    
    dataLines.forEach(line => {
      if (line.trim()) {
        const prefix = config.enableColors ? `${colors.dim}    ▸ ${colors.reset}` : '    > ';
        console.log(prefix + line);
      }
    });
  }
  
  // Write to file if enabled
  if (state.fileStream) {
    const plainLogLine = logLine.replace(/\x1b\[[0-9;]*m/g, ''); // Remove ANSI codes
    state.fileStream.write(plainLogLine + '\n');
    
    if (data) {
      const plainData = formatData(data).replace(/\x1b\[[0-9;]*m/g, '');
      state.fileStream.write('    ' + plainData + '\n');
    }
  }
}

/**
 * Enhanced helper functions for common logging patterns
 */
const helpers = {
  /**
   * Format operation with status and timing
   */
  operation(name, status, duration = null, details = {}) {
    const parts = [`${name}: ${status}`];
    
    if (duration !== null) {
      parts.push(`(${formatDuration(duration)})`);
    }
    
    if (Object.keys(details).length > 0) {
      const detailStr = Object.entries(details)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');
      parts.push(`[${detailStr}]`);
    }
    
    return parts.join(' ');
  },
  
  /**
   * Format request information
   */
  request(method, url, status = null, duration = null) {
    const parts = [`${method} ${url}`];
    
    if (status !== null) {
      parts.push(`→ ${status}`);
    }
    
    if (duration !== null) {
      parts.push(`(${formatDuration(duration)})`);
    }
    
    return parts.join(' ');
  },
  
  /**
   * Format database operation
   */
  database(operation, table, affected = null, duration = null) {
    const parts = [`${operation} ${table}`];
    
    if (affected !== null) {
      parts.push(`[${affected} rows]`);
    }
    
    if (duration !== null) {
      parts.push(`(${formatDuration(duration)})`);
    }
    
    return parts.join(' ');
  },
  
  /**
   * Format statistics
   */
  stats(stats) {
    return Object.entries(stats)
      .map(([key, value]) => {
        if (typeof value === 'number' && value > 1024 && key.toLowerCase().includes('memory')) {
          return `${key}: ${formatMemory(value)}`;
        }
        return `${key}: ${value}`;
      })
      .join(', ');
  },
  
  /**
   * Format error with stack trace
   */
  error(error, context = {}) {
    const parts = [error.message || 'Unknown error'];
    
    if (error.code) {
      parts.push(`[${error.code}]`);
    }
    
    if (Object.keys(context).length > 0) {
      const contextStr = Object.entries(context)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');
      parts.push(`{${contextStr}}`);
    }
    
    return parts.join(' ');
  },
  
  /**
   * Format progress information
   */
  progress(current, total, operation = 'Processing') {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    return `${operation}: ${current}/${total} (${percentage}%)`;
  }
};

/**
 * Create a child logger with fixed context
 */
function createChildLogger(fixedContext) {
  return {
    trace: (message, data) => log('TRACE', fixedContext, message, data),
    debug: (message, data) => log('DEBUG', fixedContext, message, data),
    info: (message, data) => log('INFO', fixedContext, message, data),
    success: (message, data) => log('SUCCESS', fixedContext, message, data),
    warn: (message, data) => log('WARN', fixedContext, message, data),
    error: (message, data) => log('ERROR', fixedContext, message, data),
    fatal: (message, data) => log('FATAL', fixedContext, message, data),
    helpers
  };
}

/**
 * Time an operation and log the result
 */
async function timeOperation(context, operationName, asyncFn, logLevel = 'INFO') {
  const startTime = Date.now();
  
  try {
    log('TRACE', context, helpers.operation(operationName, 'STARTED'));
    
    const result = await asyncFn();
    const duration = Date.now() - startTime;
    
    log(logLevel, context, helpers.operation(operationName, 'COMPLETED', duration));
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    log('ERROR', context, helpers.operation(operationName, 'FAILED', duration), {
      error: helpers.error(error)
    });
    
    throw error;
  }
}

/**
 * Get current logging statistics
 */
function getStatistics() {
  const uptime = Date.now() - state.statistics.startTime;
  
  return {
    ...state.statistics,
    uptime: formatDuration(uptime),
    cacheSize: state.messageCache.size,
    currentLogLevel: config.logLevel,
    memoryUsage: process.memoryUsage()
  };
}

/**
 * Set log level
 */
function setLogLevel(level) {
  if (LOG_LEVELS[level]) {
    config.logLevel = level;
    log('INFO', 'SYSTEM', `Log level changed to ${level}`, null, { force: true });
  } else {
    log('WARN', 'SYSTEM', `Invalid log level: ${level}. Available levels: ${Object.keys(LOG_LEVELS).join(', ')}`);
  }
}

/**
 * Print system information
 */
function printSystemInfo() {
  const stats = getStatistics();
  
  log('INFO', 'SYSTEM', 'Logging system initialized', {
    logLevel: config.logLevel,
    colorsEnabled: config.enableColors,
    fileLogging: config.enableFileLogging,
    deduplication: config.enableDeduplication,
    nodeVersion: process.version,
    platform: process.platform,
    memory: helpers.stats({
      'Heap Used': formatMemory(stats.memoryUsage.heapUsed),
      'Heap Total': formatMemory(stats.memoryUsage.heapTotal),
      'RSS': formatMemory(stats.memoryUsage.rss)
    })
  });
}

// Main logger interface
const logger = {
  // Core logging methods
  trace: (context, message, data) => log('TRACE', context, message, data),
  debug: (context, message, data) => log('DEBUG', context, message, data),
  info: (context, message, data) => log('INFO', context, message, data),
  success: (context, message, data) => log('SUCCESS', context, message, data),
  warn: (context, message, data) => log('WARN', context, message, data),
  error: (context, message, data) => log('ERROR', context, message, data),
  fatal: (context, message, data) => log('FATAL', context, message, data),
  
  // Convenience methods for common contexts
  system: createChildLogger('SYSTEM'),
  server: createChildLogger('SERVER'),
  database: createChildLogger('DATABASE'),
  steam: createChildLogger('STEAM_API'),
  proxy: createChildLogger('PROXY'),
  inventory: createChildLogger('INVENTORY'),
  pricing: createChildLogger('PRICING'),
  friends: createChildLogger('FRIENDS'),
  profile: createChildLogger('PROFILE'),
  websocket: createChildLogger('WEBSOCKET'),
  http: createChildLogger('HTTP'),
  cache: createChildLogger('CACHE'),
  batch: createChildLogger('BATCH'),
  performance: createChildLogger('PERFORMANCE'),
  security: createChildLogger('SECURITY'),
  
  // Legacy compatibility (for existing code)
  db: (context, message, data) => log('DEBUG', 'DATABASE', `${context}: ${message}`, data),
  api: (context, message, data) => log('INFO', 'HTTP', `${context}: ${message}`, data),
  socket: (context, message, data) => log('INFO', 'WEBSOCKET', `${context}: ${message}`, data),
  price: (context, message, data) => log('INFO', 'PRICING', `${context}: ${message}`, data),
  timer: (context, message, data) => log('INFO', 'PERFORMANCE', `${context}: ${message}`, data),
  
  // Utility methods
  helpers,
  child: createChildLogger,
  time: timeOperation,
  timed: async (id, asyncFn, options = {}) => {
    const { context = 'SYSTEM', operation = 'Operation', metadata = {} } = options;
    const startTime = Date.now();
    
    try {
      log('TRACE', context, `${operation} started`, { id, ...metadata });
      
      const result = await asyncFn();
      const duration = Date.now() - startTime;
      
      log('INFO', context, `${operation} completed`, { 
        id, 
        duration: formatDuration(duration),
        ...metadata 
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      log('ERROR', context, `${operation} failed`, {
        id,
        duration: formatDuration(duration),
        error: helpers.error(error),
        ...metadata
      });
      
      throw error;
    }
  },
  setLogLevel,
  getStats: getStatistics,
  printSystemInfo,
  
  // Force logging (bypass deduplication and level checks)
  force: (level, context, message, data) => log(level, context, message, data, { force: true })
};

// Initialize file logging
initializeFileLogging();

// Print system info on startup
if (process.env.NODE_ENV !== 'test') {
  setTimeout(() => printSystemInfo(), 100);
}

// Cleanup on process exit
process.on('exit', () => {
  if (state.fileStream) {
    state.fileStream.end();
  }
});

process.on('SIGINT', () => {
  logger.system.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.system.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

module.exports = logger;
