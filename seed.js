
/**
 * @fileoverview Seed manager
 * @date Created: Nov 22, 2024
 * @lastUpdated Last Updated: Dec 01, 2025
 * 
 */


let currentSeed = null;

/**
 * Generate a random seed
 * @returns {string} A random hexadecimal seed
 */
function generateRandomSeed() {
  return Math.floor(Math.random() * 0xffffffff).toString(16);
}

/**
 * Hash a string into a numeric value
 * @param {string} str - The string to hash
 * @returns {number} A numeric hash value
 */
function hashStringToNumber(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash * 31 + char) >>> 0; // Ensure 32-bit unsigned integer
  }
  return hash;
}

/**
 * Set the random seed
 * @param {string|null} seed - The seed to set (or null to generate a new random seed)
 */
export function setSeed(seed = null) {
  if (!seed) {
    currentSeed = generateRandomSeed();
  } else if (/^[0-9a-fA-F]+$/.test(seed)) {
    // If the seed is a valid hexadecimal string
    currentSeed = seed;
  } else {
    // Hash non-hexadecimal strings into a consistent numeric seed
    currentSeed = hashStringToNumber(seed).toString(16);
  }

  //console.log(`Seed: ${currentSeed}`);
  randomSeed(currentSeed); // Update random functions
}

/**
 * Get the current seed
 * @returns {string|null} The current seed
 */
export function getSeed() {
  return currentSeed;
}

/**
 * Initialize and override random functions with a seedable generator
 * @param {string} seed - The seed value
 */
function randomSeed(seed) {
  let s = parseInt(seed, 16) || 0x1;
  const m = 0x100000000; // 2^32
  const a = 1664525;
  const c = 1013904223;

  // Seeded random generator
  Math.random = () => {
    s = (a * s + c) % m;
    return s / m;
  };

  // Custom random functions
  random.next = Math.random;
  random.range = (min, max) => min + (max - min) * random.next();
  random.pick = (array) => array[Math.floor(random.next() * array.length)];
}

// Default export for random functions
export const random = {
  next: Math.random,
  range: (min, max) => Math.random() * (max - min) + min,
  pick: (array) => array[Math.floor(Math.random() * array.length)],
};

// Example usage
//setSeed(); // Generates a random seed
//setSeed("9d77ac94"); // Uses a provided hexadecimal seed
//setSeed("randomword"); // Hashes a string into a hexadecimal seed

// Set seed
setSeed();
console.log(`Internal hexadecimal seed: ${getSeed()}`);
