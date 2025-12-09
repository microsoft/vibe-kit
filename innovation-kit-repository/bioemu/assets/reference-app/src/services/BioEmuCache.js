// Sample protein data cache to avoid API calls during development
// Updated to use localStorage for persistence across browser sessions
const CACHE_KEY = 'bioemu-protein-cache';
const CACHE_VERSION = '1.0';

// Sample protein sequences to cache
const SAMPLE_SEQUENCES = [
  'LSDEDFKAVFGMTRSAFANLPLWKQQNLKKEKGLF', // HP35
  'NLYIQWLKDGGPSSGRPPPS'                  // Trp-cage
];

// Initialize cache from localStorage or create empty cache
const initializeCache = () => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.version === CACHE_VERSION) {
        return parsed.data;
      }
    }
  } catch (error) {
    console.warn('Error loading cache from localStorage:', error);
  }

  // Create empty cache - entries will be created as needed with sequence + samples keys
  return {};
};

// Cache data structure
export const CACHED_PROTEIN_DATA = initializeCache();

// Save cache to localStorage
const saveCache = () => {
  try {
    const cacheData = {
      version: CACHE_VERSION,
      data: CACHED_PROTEIN_DATA,
      lastUpdated: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Error saving cache to localStorage:', error);
  }
};

export const getCachedData = (sequence, numSamples = 10) => {
  const cacheKey = `${sequence}_samples_${numSamples}`;
  const cached = CACHED_PROTEIN_DATA[cacheKey];
  if (cached && cached.data && cached.timestamp) {
    const hoursSinceCache = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
    // Use cache for 24 hours
    if (hoursSinceCache < 24) {
      return cached.data;
    }
  }
  return null;
};

export const setCachedData = (sequence, data, numSamples = 10) => {
  const cacheKey = `${sequence}_samples_${numSamples}`;
  // Cache all sequences, not just sample ones
  CACHED_PROTEIN_DATA[cacheKey] = {
    data: data,
    timestamp: Date.now(),
    numSamples: numSamples
  };
  saveCache(); // Persist to localStorage
};

export const clearCache = () => {
  // Clear all cached data by removing all keys
  Object.keys(CACHED_PROTEIN_DATA).forEach(cacheKey => {
    delete CACHED_PROTEIN_DATA[cacheKey];
  });

  saveCache();
};

export const getCacheStatus = () => {
  const status = {};

  // Check all cached sequences, not just sample ones
  Object.keys(CACHED_PROTEIN_DATA).forEach(cacheKey => {
    const cached = CACHED_PROTEIN_DATA[cacheKey];
    if (cached && cached.data && cached.timestamp) {
      const hoursSinceCache = (Date.now() - cached.timestamp) / (1000 * 60 * 60);

      // Extract sequence from cache key (format: sequence_samples_N)
      const parts = cacheKey.split('_samples_');
      const sequence = parts[0];
      const numSamples = parts[1] ? parseInt(parts[1]) : 'unknown';

      status[cacheKey] = {
        sequence: sequence.substring(0, 20) + (sequence.length > 20 ? '...' : ''),
        numSamples: numSamples,
        cached: true,
        hoursOld: hoursSinceCache,
        valid: hoursSinceCache < 24,
        isSample: SAMPLE_SEQUENCES.includes(sequence)
      };
    } else {
      status[cacheKey] = {
        cached: false,
        hoursOld: null,
        valid: false
      };
    }
  });

  return status;
};
