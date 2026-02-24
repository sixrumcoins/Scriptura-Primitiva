/**
 * @fileoverview Shared configuration and utility functions
 * @date Created: Nov 13, 2024
 * @lastUpdated Last Updated: Dec 01, 2025
 * 
 */


// =============================
// DEBUG
// =============================

const CONSOLE_LOG_seedCheck = false;
const CONSOLE_LOG_dimentionsSendReceive = false;
const CONSOLE_LOG_renderChunkAsShader = false;
const CONSOLE_LOG_loadSliceAndRenderMultiple = false;
const CONSOLE_LOG_createTransparentChunk = false;
const CONSOLE_LOG_renderChunksInGrid = true;
const CONSOLE_LOG_canvas2dGrid = false;
const SCREEN_LOG_finalCanvas = false;


// =============================
// IMPORTS
// =============================

import * as THREE from 'three';

import { random, setSeed, getSeed } from './seed.js';

const fixedSeed = getSeed(); // Use a fixed seed for deterministic results.
setSeed(fixedSeed);
if (CONSOLE_LOG_seedCheck) console.log(`Config received seed: ${getSeed()}`);

//import { IMAGE_DATASET } from './base64ImageDataset.js';

const IMAGE_DATASET = [
  new URL('./images/2000-134-1.jpg', import.meta.url).href,
  new URL('./images/2000-134-2.jpg', import.meta.url).href,
  new URL('./images/2000-135-2.jpg', import.meta.url).href,
  new URL('./images/2000-136-3.jpg', import.meta.url).href,
  new URL('./images/2000-137-1.jpg', import.meta.url).href,
];


// =============================
// UTILITY FUNCTIONS
// =============================

// Non-monotonous random with deviation
function getRandomRangeWithDeviation(n, m, previousValue, deviation = 2) {
  let value;
  do {
    value = Math.floor(random.range(n, m));
  } while (Math.abs(value - previousValue) < deviation);
  return value;
}

// Deterministic shuffle function based on seed
function deterministicShuffle(array, seed) {
  const result = [...array];
  setSeed(seed); // Reset seed before shuffling

  for (let pass = 0; pass < 3; pass++) { // Perform 3 shuffle passes
    for (let i = result.length - 1; i > 0; i--) {
      // Use a deterministic offset based on the current index
      const offset = Math.floor(random.next() * result.length);
      const j = (Math.floor(random.next() * (i + 1)) + offset) % (i + 1);

      [result[i], result[j]] = [result[j], result[i]];
    }
  }

  return result;
}


// =============================
// COLORS
// =============================

// Color Schemes
const colorSchemes = {
  technicolor: ['#000000', '#0000ff', '#ff0000'],
  radioaxiom: ['#2a2a2a', '#297138', '#41a657', '#b5e9b5'],
  amaranthblue: ['#2a2a2a', '#28706f', '#41a6a4', '#b5e8df'],
  midnightblues: ['#2a2a2a', '#285b70', '#4187a6', '#b5d9e8'],
  inkonfingertips: ['#2a2a2a', '#402870', '#6241a6', '#b7b7b7'],
  shallowwaters: ['#2a2a2a', '#3a3d40', '#585b60', '#dde8b5'],
  shallowwatersaxiom: ['#2a2a2a', '#3a3d40', '#585b60', '#b5e9b5'],
  shallowwatersblues: ['#2a2a2a', '#3a3d40', '#585b60', '#b5d9e8'],
  shallowwatersroyal: ['#2a2a2a', '#3a3d40', '#585b60', '#b5b9e8'],
  poppyseed: ['#2a2a2a', '#a82d28', '#bc4b46', '#cfd0d1'],
  silverhand: ['#2a2a2a', '#3a3d40', '#585b60', '#cfd0d1'],
  destructions: ['#2a2a2a', '#b5d9e8', '#b5e8df'],
  transitions: ['#2a2a2a', '#d7b5d6', '#cbb4d7', '#d2c4db'],
  strings: ['#2a2a2a', '#dde8b5', '#d1d98d', '#e3dd7e'],
  theories: ['#2a2a2a', '#e8b5b5', '#e8c7b5'],
  blood: ['#2a2a2a', '#bc4b46', '#cc6d69', '#e8b5b5', '#cc6d69', '#e8b5b5', '#f8f5f5'],
  silverinverted: ['#2a2a2a', '#403f3a', '#615f59', '#d1d1cf'],
  anxiety: ['#2a2a2a', '#702c28', '#a82f28', '#a64641', '#b3b3b3'],
  virginsuicides: ['#2a2a2a', '#352ce7', '#e7e02c', '#e7772c', '#e74f2c'],
  virginsuicides_violet: ['#2a2a2a', '#7a3d7f', '#9c769a', '#d2c4db', '#aca49d'],
  backgroundPreferred: ['#f8f5f5', '#efeeec', '#cfd0d1'],
  backgroundRare: ['#b5e9d4', '#b5e8df', '#b5d9e8', '#eedfe6'],
};

// Select color scheme
function getRandomColorScheme(preferBackground = false) {
  if (preferBackground) {
    // Occasionally use backgroundRare
    if (Math.random() < 0.1) {
      return colorSchemes.backgroundRare;
    }
    return colorSchemes.backgroundPreferred;
  }
  const schemes = Object.keys(colorSchemes).filter(s => s !== 'backgroundPreferred');
  return colorSchemes[random.pick(schemes)];
}

// Get random color from a scheme
function getRandomColorFromScheme(scheme) {
  const colorHex = scheme[Math.floor(random.next() * scheme.length)];
  return new THREE.Color(colorHex);
}


// =============================
// CANVAS CONFIG
// =============================

const RENDER_PRECISION = {
  LOW: {
    powerPreference: 'low-power',
    antialias: false,
    precision: 'lowp',
    shaderPrecision: 'lowp',
  },
  HIGH: {
    powerPreference: 'high-performance',
    antialias: true,
    precision: 'highp',
    shaderPrecision: 'highp',
  }
};
const SET_PRECISION = RENDER_PRECISION.LOW;

let scaleToWindow = true;


// =============================
// CANVAS DIMENSIONS
// =============================

// -----------------------------
// Full HD:   1080 x 1920
//            1152 x 2048
//            1440 x 2560
// 4K:        2160 x 3840
// UHD+       2880 x 5120
// 8K:        4320 x 7680
// -----------------------------

// Target width
const targetWidth = 2160;

// Default dimensions
let CANVAS_WIDTH = targetWidth / 2; // Default width. Make it 0.5 of the target width for proper pixel scaling in webgl
let CANVAS_HEIGHT = 0; // Default height. Calculated dynamically

// Set canvas aspect ratio
const ASPECT_RATIOS = {
  "9:16": { width: 9, height: 16 },
  "16:9": { width: 16, height: 9 },
  "1:1": { width: 1, height: 1 },
};
function setAspectRatio(aspectRatio) {
  if (ASPECT_RATIOS[aspectRatio]) {
    selectedAspectRatio = aspectRatio;
    updateCanvasConfiguration(); // Recalculate dimensions
  } else {
    console.warn(`Aspect ratio "${aspectRatio}" is not supported`);
  }
}
let selectedAspectRatio = "9:16"; // Default aspect ratio

setAspectRatio("9:16"); // Target aspect ratio

let HD_SCALE = 1.0; // Scaling factor based on target vs. default width. Calculated dynamically

function calculateScaling(targetWidth) {
  const { width: baseWidth } = getOuterSize();
  return +(targetWidth / baseWidth).toFixed(3);
}

// Scale canvas dimensions dynamically
function scaleCanvas(hdScale) {
  HD_SCALE = hdScale;
  CANVAS_WIDTH = Math.round(CANVAS_WIDTH * HD_SCALE);
  CANVAS_HEIGHT = Math.round(CANVAS_HEIGHT * HD_SCALE);
}

// Calculate canvas height based on the targetWidth and selected aspect ratio
function updateCanvasConfiguration() {
  const currentAspectRatio = ASPECT_RATIOS[selectedAspectRatio];
  CANVAS_HEIGHT = Math.round(
    (CANVAS_WIDTH / currentAspectRatio.width) * currentAspectRatio.height
  );
}

const hdScale = calculateScaling(targetWidth); // Calculate HD_SCALE and apply scaling to match target width
updateCanvasConfiguration();
scaleCanvas(hdScale);

// Utility function with the canvas dimensions
function getOuterSize() {
  return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
}


// =============================
// IMAGE SETUP
// =============================

// Chunk contents
const UPSCALE_IMAGE = random.pick([false, false]); // Upscale images or use as is

const IMAGE_URLS = (() => {
  const shuffledDataset = deterministicShuffle(IMAGE_DATASET, fixedSeed); // Shuffle deterministically
  return shuffledDataset.slice(0, random.pick([1, 1, 2, 2, 2, 3])); // Select a few images
})();

const TRANSPARENT_CHUNK_RATIO = random.range(/*0.6, 0.9*/ 0.3, 0.7);
const PROB_CHUNK_SOLID_COLOR = random.range(/*0.4, 0.6*/ 0.0, 0.2);
const SHUFFLE_CHUNKS = random.pick([true, false]);
const GRAYSCALE_CONTRAST = 1.3;

// Chunk dimensions
const CHUNK_MARGIN = Math.floor(random.range(0, 40)) * HD_SCALE;

// Source image-specific transformations
const PROB_CHUNK_FLIP_HORZ = 0.5;
const PROB_CHUNK_FLIP_VERT = 0.5;
const PROB_CHUNK_SOURCE_POS_OFFSET = random.range(0.2, 0.8);

// Chunk-specific transformations

const PROB_CHUNK_ROTATE = /*random.pick([0.2, random.range(0.0, 0.4), random.range(0.2, 0.6), random.range(0.4, 0.8), 1.0])*/ 0.08;
const CHUNK_ROTATION_ANGLE_MAX = random.pick([
  /*Math.floor(random.range(0, 0)), 
  Math.floor(random.range(0, 5)), 
  Math.floor(random.range(0, 10)), 
  Math.floor(random.range(0, 15)), 
  Math.floor(random.range(5, 15)), 
  Math.floor(random.range(10, 35)),
  Math.floor(random.range(5, 35))*/
  Math.floor(random.range(30, 60))
]);

const PROB_CHUNK_POS_OFFSET = random.range(0.0, 0.3);

// Color compression (entire image)
const COMPRESS_IMAGE = random.pick([true, false]); // true
const COMPRESSED_IMAGE_MAX_COLORS = random.pick([8, 16, 32, 64, 128, 256]);
const COMPRESSED_IMAGE_DITHER = 60 / (HD_SCALE * 0.5);
const COMPRESSED_IMAGE_LOSSY = Math.floor(random.range(12, 18));

// Dithering (chunk)
const ENABLE_CHUNK_DITHERING = random.pick([true, false]); // true
const PROB_CHUNK_DITHERING = random.range(0.2, 0.5);
const COMPRESSED_CHUNK_MAX_COLORS = random.pick([8, 16, 32, 64, 128, 256]);
const COMPRESSED_CHUNK_DITHER = /*80*/Math.floor(random.range(42, 96)) / (HD_SCALE * 0.5);
const COMPRESSED_CHUNK_LOSSY = Math.floor(random.range(/*18, 36*/24, 42));

// Render transformations
const SCALE_SOURCE = random.range(1.0, 1.2).toFixed(1); // random.range(1.0, 1.2)
const PROB_RAND_PIXEL_SCALE = random.range(0.0, 0.0016); // 0.005
const PROB_PIXEL_REPEAT = random.range(0.01, 0.46); // 0.005
const RAND_PIXEL_MAX_SIZE = 6;
const LINE_ROTATION_PROB = random.range(0.0, 0.1); // 0.3
const LINE_ROTATION_ANGLE_MAX = random.pick([Math.floor(random.range(0, 5)), Math.floor(random.range(0, 10)), Math.floor(random.range(0, 15)), Math.floor(random.range(10, 35))]); // 5, 10, 15
const PROB_LINEX_SKIP = random.range(/*0.01, 0.12*/ 0.0, 0.1); // 0.18
const PROB_LINEX_REPEAT = random.range(/*0.2, 0.6*/ 0.01, 0.36); // 0.38

// Grid settings
const GRID_BORDER = 1.8 * HD_SCALE;
const GRID_MARGIN = 10 * HD_SCALE;
const GRID_EXT_MARGIN = /*CHUNK_MARGIN*/ 20 * HD_SCALE;
const GRID_SCALE = 0.8; // Scale factor from 0 to 1


// =============================
// FONT
// =============================

const FONT_PRIMARY = "Andale Mono";
const FONT_SECONDARY = "Noto Sans JP";

// Define font priority
const FONT_FALLBACK = `'${FONT_PRIMARY}', '${FONT_SECONDARY}', monospace`;

// Ensure font is loaded
let fontReady = false;

// Wait for all fonts to be ready
(async () => {
  // Explicitly load both fonts before checking
  await document.fonts.load(`1em '${FONT_PRIMARY}'`);
  await document.fonts.load(`1em '${FONT_SECONDARY}'`);

  const andaleAvailable = document.fonts.check(`1em '${FONT_PRIMARY}'`);
  const notoJPAvailable = document.fonts.check(`1em '${FONT_SECONDARY}'`);

  console.log(`Font load status:`);
  console.log(`- ${FONT_PRIMARY}: ${andaleAvailable ? "Loaded" : "Not loaded"}`);
  console.log(`- ${FONT_SECONDARY}: ${notoJPAvailable ? "Loaded" : "Not loaded"}`);

  fontReady = andaleAvailable && notoJPAvailable;
})();

// Get font readiness status
const isFontReady = () => fontReady;

// Export fonts
export {
  FONT_FALLBACK,
  FONT_PRIMARY,
  FONT_SECONDARY,
  isFontReady
};


// =============================
// EXPORTS
// =============================

export {
  random,
  setSeed,
  getSeed,

  SET_PRECISION,
  
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HD_SCALE,
  scaleCanvas,
  scaleToWindow,
  getOuterSize,

  IMAGE_URLS,
  UPSCALE_IMAGE,
  TRANSPARENT_CHUNK_RATIO,
  PROB_CHUNK_SOLID_COLOR,
  SHUFFLE_CHUNKS,
  GRAYSCALE_CONTRAST,

  CHUNK_MARGIN,

  PROB_CHUNK_FLIP_HORZ,
  PROB_CHUNK_FLIP_VERT,
  PROB_CHUNK_SOURCE_POS_OFFSET,

  PROB_CHUNK_ROTATE,
  CHUNK_ROTATION_ANGLE_MAX,
  PROB_CHUNK_POS_OFFSET,

  COMPRESS_IMAGE,
  COMPRESSED_IMAGE_DITHER,
  COMPRESSED_IMAGE_MAX_COLORS,
  COMPRESSED_IMAGE_LOSSY,

  ENABLE_CHUNK_DITHERING,
  PROB_CHUNK_DITHERING,
  COMPRESSED_CHUNK_MAX_COLORS,
  COMPRESSED_CHUNK_DITHER,
  COMPRESSED_CHUNK_LOSSY,
 
  SCALE_SOURCE,
  PROB_PIXEL_REPEAT,
  PROB_RAND_PIXEL_SCALE,
  RAND_PIXEL_MAX_SIZE,
  LINE_ROTATION_PROB,
  LINE_ROTATION_ANGLE_MAX,
  PROB_LINEX_SKIP,
  PROB_LINEX_REPEAT,

  GRID_BORDER,
  GRID_MARGIN,
  GRID_EXT_MARGIN,
  GRID_SCALE,

  CONSOLE_LOG_seedCheck,
  CONSOLE_LOG_dimentionsSendReceive,
  CONSOLE_LOG_renderChunkAsShader,
  CONSOLE_LOG_loadSliceAndRenderMultiple,
  CONSOLE_LOG_createTransparentChunk,
  CONSOLE_LOG_renderChunksInGrid,
  CONSOLE_LOG_canvas2dGrid,
  SCREEN_LOG_finalCanvas,

  getRandomRangeWithDeviation,
  deterministicShuffle,
  getRandomColorScheme,
  getRandomColorFromScheme,
  colorSchemes
};

// Log dimensions for debugging
console.log(`Canvas dimensions: ${getOuterSize().width}x${getOuterSize().height}`);
console.log(`Scaling factors:`);
console.log(`- HD_SCALE: ${HD_SCALE}`);
console.log(`- SCALE_SOURCE: ${SCALE_SOURCE}`);
