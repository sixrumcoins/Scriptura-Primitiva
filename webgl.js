/**
 * @fileoverview Image manipulation and rendering
 * @date Created: Nov 7, 2024
 * @lastUpdated Last Updated: Dec 01, 2025
 * 
 */

// =============================
// IMPORTS 
// =============================

import * as THREE from 'three';

import {
  SET_PRECISION,

  HD_SCALE,
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

  CONSOLE_LOG_seedCheck,
  CONSOLE_LOG_dimentionsSendReceive,
  CONSOLE_LOG_renderChunkAsShader,
  CONSOLE_LOG_loadSliceAndRenderMultiple,
  CONSOLE_LOG_createTransparentChunk,
  CONSOLE_LOG_renderChunksInGrid,
  SCREEN_LOG_finalCanvas,

  FONT_FALLBACK,
  FONT_PRIMARY,
  FONT_SECONDARY,
  isFontReady,

  getRandomRangeWithDeviation,
  deterministicShuffle,
  getRandomColorScheme,
  getRandomColorFromScheme,

} from './config.js';

import { random, setSeed, getSeed } from './seed.js';

const fixedSeed = getSeed(); // Use a fixed seed for deterministic results.
setSeed(fixedSeed);
if (CONSOLE_LOG_seedCheck) console.log(`WebGL received seed: ${fixedSeed}`);

const globalStartTime = performance.now(); // Start measuring script execution

// Read canvas dimensions
const { width: outerWidth, height: outerHeight } = getOuterSize();


// =============================
// IMAGE LOADING
// =============================

/**
 * Load images in sequential order and store them in an array
 * Returns an array of images
 * 
 * urls: an array of urls
 * upscale: boolean; use it to scale the image size programmatically
 * applyDithering: boolean; use it to distort the image
 * 
 */ 
async function loadImagesSequentially(urls, upscale = UPSCALE_IMAGE, applyDithering = COMPRESS_IMAGE) {
  const loadedImages = [];

  for (const [index, url] of urls.entries()) {
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({ image: img, index });
        };
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.crossOrigin = 'Anonymous';
        img.src = url;
      });

      let processedImage;

      if (applyDithering) {
        // Compress the image using the dithering method
        const compressedCanvas = compressImage(image.image, COMPRESSED_IMAGE_MAX_COLORS, COMPRESSED_IMAGE_DITHER, COMPRESSED_IMAGE_LOSSY);
        processedImage = new Image();
        processedImage.src = compressedCanvas.toDataURL();
        await new Promise((resolve) => (processedImage.onload = resolve));
      } else if (upscale) {
        // Scale the image programmatically using a temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = image.image.width * HD_SCALE;
        tempCanvas.height = image.image.height * HD_SCALE;

        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(
          image.image,
          0,
          0,
          image.image.width * HD_SCALE,
          image.image.height * HD_SCALE
        );

        processedImage = new Image();
        processedImage.src = tempCanvas.toDataURL();
        await new Promise((resolve) => (processedImage.onload = resolve));
      } else {
        // Use the original uploaded image directly
        processedImage = image.image;
      }

      loadedImages[index] = processedImage;
    } catch (error) {
      console.error(`Error loading image [${index}] from URL: ${url}`, error);
    }
  }

  return loadedImages;
}


/**
 * 
 * Image compression & image dithering effect
 * 
 * Customization options:
 *  - Wave length: waveX and waveY for frequency and growth rate
 *  - Dither segment size: Adjust segmentSize calculation
 *  - Error diffusion: Adjust distributeError to redistribute error differently
 * 
 */
function compressImage(image, maxColors = 256, dither = 100, lossy = 0) {
  const width = image.width;
  const height = image.height;

  // Create a canvas for processing
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Normalize parameters
  const ditherFactor = dither / 100;
  const lossyFactor = lossy / 100;
  const segmentSize = Math.max(1, Math.floor(dither / random.pick([1, 2, 3, 5, 8, 12]))); // Adjust segment size for dithering based on dither value

  // Generate a quantization palette
  const quantizeColor = (value, levels) =>
    Math.round((value / 255) * (levels - 1)) * Math.floor(255 / (levels - 1));

  const palette = new Map();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      if (Math.random() < lossyFactor) {
        // Apply pixel wave distortion with longer, exponential waves
        const waveX = Math.sin(y * lossyFactor * 0.008) * Math.exp(y * lossyFactor * 0.005) * lossyFactor * 20;
        const waveY = Math.cos(x * lossyFactor * 0.008) * Math.exp(x * lossyFactor * 0.005) * lossyFactor * 20;

        const distortedX = Math.min(width - 1, Math.max(0, x + waveX | 0));
        const distortedY = Math.min(height - 1, Math.max(0, y + waveY | 0));
        const distortedIndex = (distortedY * width + distortedX) * 4;

        data[index] = data[distortedIndex];
        data[index + 1] = data[distortedIndex + 1];
        data[index + 2] = data[distortedIndex + 2];
        data[index + 3] = data[distortedIndex + 3];
      }

      // Quantize colors
      const r = quantizeColor(data[index], maxColors);
      const g = quantizeColor(data[index + 1], maxColors);
      const b = quantizeColor(data[index + 2], maxColors);

      const key = `${r}-${g}-${b}`;
      if (!palette.has(key)) {
        palette.set(key, { r, g, b });
      }

      const { r: newR, g: newG, b: newB } = palette.get(key);

      // Apply the quantized color
      data[index] = newR;
      data[index + 1] = newG;
      data[index + 2] = newB;

      // Larger dithering segments
      if (ditherFactor > 0 && x % segmentSize === 0 && y % segmentSize === 0) {
        const errorR = data[index] - newR;
        const errorG = data[index + 1] - newG;
        const errorB = data[index + 2] - newB;

        const distributeError = (dx, dy, factor) => {
          const nx = x + dx * segmentSize;
          const ny = y + dy * segmentSize;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIndex = (ny * width + nx) * 4;
            data[nIndex] += errorR * factor * ditherFactor;
            data[nIndex + 1] += errorG * factor * ditherFactor;
            data[nIndex + 2] += errorB * factor * ditherFactor;
          }
        };

        distributeError(1, 0, 7 / 16); // Right
        distributeError(-1, 1, 3 / 16); // Bottom-left
        distributeError(0, 1, 5 / 16); // Bottom
        distributeError(1, 1, 1 / 16); // Bottom-right
      }
    }
  }

  // Apply processed data to canvas
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

function compressImageWithDithering(canvas, imageData, maxColors, dither, lossy) {
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);

  return compressImage(canvas, maxColors, dither, lossy);
}


// =============================
// PRECISION IN SHADERS
// =============================

const vertexShader = `
  //precision lowp float; // Ensure high precision for consistent results.
  precision ${SET_PRECISION.shaderPrecision} float;
  uniform float baseSize;
  attribute float size;
  varying vec4 vColor;
  void main() {
    vColor = color;
    gl_PointSize = size * baseSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  //precision lowp float; // Ensure high precision for consistent results.
  precision ${SET_PRECISION.shaderPrecision} float;
  varying vec4 vColor;
  void main() {
    gl_FragColor = vColor;
  }
`;


// =============================
// UTILITY
// =============================

/**
 * Different markers to visualise the canvas borders
 * 
 */
const leftTop = { x: -outerWidth / 2, y: outerHeight / 2 };
const leftBottom = { x: -outerWidth / 2, y: -outerHeight / 2 };
const rightTop = { x: outerWidth / 2, y: outerHeight / 2 };
const rightBottom = { x: outerWidth / 2, y: -outerHeight / 2 };
const centerTop = { x: 0, y: outerHeight / 2 };
const centerBottom = { x: 0, y: -outerHeight / 2 };
const centerLeft = { x: -outerWidth / 2, y: 0 };
const centerRight = { x: outerWidth / 2, y: 0 };
const center = { x: 0, y: 0 };

// Render coordinate markers
function addMark(scene, x, y, color) {
  const geometry = new THREE.CircleGeometry(5, 32);
  const material = new THREE.MeshBasicMaterial({ color });
  const mark = new THREE.Mesh(geometry, material);
  mark.position.set(x, y, 0);
  scene.add(mark);
};
function addRectangle(scene, externalMargin) {
  const adjustedWidth = outerWidth - 2 * externalMargin;
  const adjustedHeight = outerHeight - 2 * externalMargin;
  const geometry = new THREE.PlaneGeometry(adjustedWidth, adjustedHeight);
  const material = new THREE.MeshBasicMaterial({
    color: 0x0000ff,
    opacity: 0.2,
    transparent: true,
  });
  const rectangle = new THREE.Mesh(geometry, material);
  rectangle.position.set(0, 0, 0); // Center within the canvas
  scene.add(rectangle);
};
function drawCoordinateMarkers(scene, externalMargin = 20) {
  const m = externalMargin;
  addRectangle(scene, m);
  addMark(scene, center.x, center.y, 'yellow');                   // Center
  addMark(scene, leftTop.x + m, leftTop.y - m, 'red');            // Top-left
  addMark(scene, rightTop.x - m, rightTop.y - m, 'blue');         // Top-right
  addMark(scene, leftBottom.x + m, leftBottom.y + m, 'green');    // Bottom-left
  addMark(scene, rightBottom.x - m, rightBottom.y + m, 'purple'); // Bottom-right
}
// Render guidelines
function drawGuidelines(scene, externalMargin = 20) {
  const m = externalMargin;

  // Material for the lines
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x0000ff,
    transparent: true
  });
  
  // Top horizontal line
  const topLine = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(leftTop.x, leftTop.y - m, 0),
    new THREE.Vector3(rightTop.x, rightTop.y - m, 0)
  ]);

  // Center horizontal line
  const centerHorizontalLine = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(centerLeft.x, centerLeft.y, 0),
    new THREE.Vector3(centerRight.x, centerRight.y, 0)
  ]);

  // Bottom horizontal line
  const bottomLine = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(leftBottom.x, leftBottom.y + m, 0),
    new THREE.Vector3(rightBottom.x, rightBottom.y + m, 0)
  ]);

  // Left vertical line
  const leftLine = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(leftBottom.x + m, leftBottom.y, 0),
    new THREE.Vector3(leftTop.x + m, leftTop.y, 0)
  ]);

  // Center vertical line
  const centerVerticalLine = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(centerBottom.x, centerBottom.y, 0),
    new THREE.Vector3(centerTop.x, centerTop.y, 0)
  ]);

  // Right vertical line
  const rightLine = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(rightBottom.x - m, rightBottom.y, 0),
    new THREE.Vector3(rightTop.x - m, rightTop.y, 0)
  ]);

  // Create line meshes
  const topLineMesh = new THREE.Line(topLine, lineMaterial);
  const centerHorizontalLineMesh = new THREE.Line(centerHorizontalLine, lineMaterial);
  const bottomLineMesh = new THREE.Line(bottomLine, lineMaterial);
  const leftLineMesh = new THREE.Line(leftLine, lineMaterial);
  const centerVerticalLineMesh = new THREE.Line(centerVerticalLine, lineMaterial);
  const rightLineMesh = new THREE.Line(rightLine, lineMaterial);

  // Set render order to ensure they are drawn above other objects
  [topLineMesh, centerHorizontalLineMesh, bottomLineMesh, leftLineMesh, centerVerticalLineMesh, rightLineMesh].forEach(line => {
    line.renderOrder = 999;
  });

  // Add all lines to the scene
  scene.add(topLineMesh);
  scene.add(centerHorizontalLineMesh);
  scene.add(bottomLineMesh);
  scene.add(leftLineMesh);
  scene.add(centerVerticalLineMesh);
  scene.add(rightLineMesh);
}


// =============================
// IMAGE PROCESSING
// =============================

const colorScheme = getRandomColorScheme();

/** 
 * Calculate chunk dimensions based on provided parameters
 * 
 */
function getChunkDimensions(imageWidth, imageHeight, cols, rows, margin) {
  if (cols === 1 && rows === 1) {
    return { 
      chunkWidth: Math.min(imageWidth, outerWidth), 
      chunkHeight: Math.min(imageHeight, outerHeight) 
    }; 
  }

  return {
    chunkWidth: Math.floor((imageWidth - (cols - 1) * margin) / cols),
    chunkHeight: Math.floor((imageHeight - (rows - 1) * margin) / rows),
  };
}


/** 
 * Calculate chunk dimensions using globalRowConfigs to emit them for external use
 * 
 */
function calculateAndEmitChunkDimensions(globalRowConfigs, outerWidth, outerHeight, CHUNK_MARGIN) {
  // Find the configuration with the highest number of cols
  const maxColsConfig = globalRowConfigs.reduce((maxConfig, currentConfig) => {
    return currentConfig.cols > maxConfig.cols ? currentConfig : maxConfig;
  }, globalRowConfigs[0]);

  const { cols, additionalCols = 0, rows } = maxColsConfig;

  // Calculate dimensions for the row with the highest number of cols
  const chunkWidth = Math.floor((outerWidth - (cols - 1) * CHUNK_MARGIN) / cols);
  const chunkHeight = Math.floor((outerHeight - (rows - 1) * CHUNK_MARGIN) / rows);

  // Emit a single event for chunk dimensions and color scheme, including cols, additionalCols, and rows
  const chunkDimensionsEvent = new CustomEvent('chunkDimensionsReady', {
    detail: {
      cols,
      additionalCols,
      rows,
      chunkWidth,
      chunkHeight,
      colorScheme,
    },
  });

  if (CONSOLE_LOG_dimentionsSendReceive) {
    console.log(`Dispatched chunkDimensions from WebGL: 
    cols: ${cols},
    additionalCols: ${additionalCols},
    rows: ${rows},
    chunkWidth: ${chunkWidth},
    chunkHeight: ${chunkHeight},
    colorScheme: ${colorScheme}`);
  }
  
  window.dispatchEvent(chunkDimensionsEvent);

  // Return dimensions, configuration details, and color scheme for further use
  return { cols, additionalCols, rows, chunkWidth, chunkHeight, colorScheme };
}


/**
 * Dynamically slice an image into regions based on a config-generated grid and save these slices (chunks) into an array
 * Apply transformations to a region when slicing: flip, offset, and scale
 * Returns an array of chunks
 * 
 */
function sliceImageIntoChunks(image, cols, rows, margin, chunkWidth, chunkHeight, applyDithering = false, ditherProbabilityDefault = 0.5) {
  const chunks = [];
  
  const canvas = document.createElement('canvas');

  if (cols === 1 && rows === 1) {
    chunkWidth = outerWidth;
    chunkHeight = outerHeight;
  }

  canvas.width = chunkWidth;
  canvas.height = chunkHeight;

  // Use the willReadFrequently attribute
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let currentChunkIndex = 0; // Initialize chunk index

  // Reset the seed to maintain consistency accross different environments
  setSeed(`chunk-${currentChunkIndex}-${fixedSeed}`);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.clearRect(0, 0, chunkWidth, chunkHeight);
      ctx.save();

      // Determine flipping transformations
      const flipHorizontally = random.next() < PROB_CHUNK_FLIP_HORZ;
      const flipVertically = random.next() < PROB_CHUNK_FLIP_VERT;

      // Apply flipping transformations
      if (flipHorizontally) {
        ctx.translate(chunkWidth, 0);
        ctx.scale(-1, 1);
      }
      if (flipVertically) {
        ctx.translate(0, chunkHeight);
        ctx.scale(1, -1);
      }

      // Calculate source image offsets if PROB_CHUNK_SOURCE_POS_OFFSET applies
      let sourceTranslateX = 0;
      let sourceTranslateY = 0;

      if (random.next() < PROB_CHUNK_SOURCE_POS_OFFSET) {
        // Define boundaries for source translation
        const maxOffsetX = Math.min(chunkWidth, image.width - chunkWidth - col * (chunkWidth + margin));
        const maxOffsetY = Math.min(chunkHeight, image.height - chunkHeight - row * (chunkHeight + margin));
        const minOffsetX = Math.max(-chunkWidth, -col * (chunkWidth + margin));
        const minOffsetY = Math.max(-chunkHeight, -row * (chunkHeight + margin));

        sourceTranslateX = random.range(minOffsetX, maxOffsetX);
        sourceTranslateY = random.range(minOffsetY, maxOffsetY);

        // Scale the source slightly
        const scaleFactor = random.range(1.0, 2.4).toFixed(1);
        const scaledWidth = chunkWidth * scaleFactor;
        const scaledHeight = chunkHeight * scaleFactor;

        // Adjust for scaling boundaries
        const maxScaleOffsetX = Math.min(scaledWidth - chunkWidth, image.width - col * (chunkWidth + margin) - chunkWidth);
        const maxScaleOffsetY = Math.min(scaledHeight - chunkHeight, image.height - row * (chunkHeight + margin) - chunkHeight);
        sourceTranslateX = Math.min(sourceTranslateX, maxScaleOffsetX);
        sourceTranslateY = Math.min(sourceTranslateY, maxScaleOffsetY);

        // Apply scaling transformation
        ctx.scale(scaleFactor, scaleFactor);
      }

      // Draw the chunk with source transformations
      if (cols === 1 && rows === 1) {
        // Ensure image stretches to fit the entire canvas while maintaining transformations
        ctx.drawImage(
          image, 
          0, 0, image.width, image.height,  // Source: full image
          0, 0, chunkWidth, chunkHeight // Destination: full chunk
        );
      } else {
        // Normal chunking + source transformations
        ctx.drawImage(
          image,
          col * (chunkWidth + margin) + sourceTranslateX, // Source X
          row * (chunkHeight + margin) + sourceTranslateY, // Source Y
          chunkWidth, chunkHeight, // Source width and height
          0, 0, // Destination X, Y
          chunkWidth, chunkHeight // Destination width and height
        );
      }

      ctx.restore();

      // Copy the chunk into a new canvas and save it
      const chunkCanvas = document.createElement('canvas');
      chunkCanvas.width = chunkWidth;
      chunkCanvas.height = chunkHeight;

      // Use the willReadFrequently attribute for chunk canvases too
      const chunkCtx = chunkCanvas.getContext('2d', { willReadFrequently: true });
      
      let ditherProbability = random.pick([ditherProbabilityDefault, random.range(0.5, 0.9)]);

      if (applyDithering && (Math.random() < ditherProbability)) {
        // Apply dithering to the selected chunk
        const imageData = ctx.getImageData(0, 0, chunkWidth, chunkHeight);
        const ditheredCanvas = compressImageWithDithering(
          chunkCanvas, imageData, COMPRESSED_CHUNK_MAX_COLORS, 
          COMPRESSED_CHUNK_DITHER * random.pick([1, 1, 2, 3]), 
          COMPRESSED_CHUNK_LOSSY * random.pick([1, 1, 2, 3])
        );
        chunkCtx.drawImage(ditheredCanvas, 0, 0);
      } else {
        // Simply draw the normal chunk
        chunkCtx.drawImage(canvas, 0, 0);
      }

      chunks.push(chunkCanvas);
      currentChunkIndex++; // Increment the chunk index
    }
  }

  return chunks;
}


/**
 * Arrange chunks in a grid
 * Apply chunk position transformations: chunk rotate, chunk position offset
 * Includes a chance for the entire globalRow to become greyscale
 * 
 */
async function renderChunksInGrid(scene, canvases, group, cols, rows, margin, grayscale = false, monochrome = false) {

  const totalRowWidth = cols * canvases[0].width + (cols - 1) * margin;
  const totalGridHeight = rows * canvases[0].height + (rows - 1) * margin;

  const shiftX = totalRowWidth / 2;
  const shiftY = totalGridHeight / 2;

  for (let row = 0; row < rows; row++) {

    let angle = random.range(0, 10);

    let currentX = -shiftX;
    let currentY = shiftY - row * (canvases[0].height + margin);

    for (let col = 0; col < cols; col++) {
      const canvasIndex = (row * cols + col) % canvases.length;
      const canvas = canvases[canvasIndex];

      const posX = currentX;
      const posY = currentY;

      // Define chunk offset
      const translateX = random.next() < PROB_CHUNK_POS_OFFSET ? random.range(-canvas.width / 4, canvas.width / 4) : 0;
      const translateY = random.next() < PROB_CHUNK_POS_OFFSET ? random.range(-canvas.height / 4, canvas.height / 4) : 0;

      /**
       * A chance for the entire globalRow to become greyscale vs. a chance for a   
       * single chunk to become grayscale irrespective of the globalRowConfigs settings.
       * 
       * Skip grayscale/monochrome for transparent chunks.
       * 
       */
      const isChunkTransparent = canvas.isTransparent;
      const isChunkGrayscale = !isChunkTransparent && (grayscale || (!grayscale && random.next() < 0.2));
      const isChunkMonochrome = !isChunkTransparent && monochrome;

      // Generate the chunk
      const chunk = await renderChunkAsShader(scene, canvas, posX + translateX, posY + translateY, isChunkGrayscale, isChunkMonochrome);

      if (!chunk) {
        if (CONSOLE_LOG_renderChunksInGrid) console.warn(`Skipping null chunk at row ${row}, col ${col}`);
        continue; // Skip null chunks
      }

      if (chunk.type === "Transparent") {
        if (CONSOLE_LOG_renderChunksInGrid) console.warn(`Skipping transparent chunk at row ${row}, col ${col}`);
        continue;
      }

      if (CONSOLE_LOG_renderChunksInGrid) console.log(`Rendering chunk at row ${row}, col ${col}`);
      
      // Apply rotation
      chunk.rotation.z = random.next() < PROB_CHUNK_ROTATE
        ? random.range(-CHUNK_ROTATION_ANGLE_MAX * random.range(1, 4), CHUNK_ROTATION_ANGLE_MAX * random.range(1, 4)) * (Math.PI / 180) * angle
        : 0;

      // Maintain depth order
      chunk.position.z = 0;

      // Ensure correct rendering order
      chunk.renderOrder = row * cols + col;
      //console.log(`Chunk: Row=${row}, Col=${col}, Z=${chunk.position.z}, RenderOrder=${chunk.renderOrder}`);

      group.add(chunk);

      // Move to the next column
      currentX += canvas.width + margin;
    }
  }

  return group;
}


/**
 * Transparent & solid color chunks generation
 * 
 */
function createTransparentChunk(width, height, grayscale = false, monochrome = false) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  canvas.isTransparent = true;  // Mark the chunk as transparent

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  // Add a solid color or leave it transparent
  if (!grayscale && !monochrome && random.next() < PROB_CHUNK_SOLID_COLOR) {
    const colorHex = getRandomColorFromScheme(colorScheme);
    ctx.fillStyle = colorHex.getStyle();
    ctx.fillRect(0, 0, width, height);
  }

  if (CONSOLE_LOG_createTransparentChunk) {
    // DEBUG: Draw a border around transparent chunks
    ctx.strokeStyle = 'red'; // Set border color to red
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, width, height);
  }

  return canvas;
}


/**
 * Deterministically generate global row configurations
 * 
 */
function generateGlobalRowConfigs(seed, numConfigs = 3) {
  const configs = [];
  setSeed(seed); // Reset seed before generating configurations

  let multi = random.pick([1/*, 2, 3*/]);

  for (let i = 0; i < numConfigs; i++) {
    configs.push({
      //cols: Math.floor(random.range(random.pick([2, 4]), random.pick([3, 5]))) * multi, // Start with at least 2 columns to avoid an empty grid, which can occur when only 1 column is used
      //additionalCols: Math.floor(random.range(random.pick([2, 6]), random.pick([4, 10]))) * multi,
      //rows: Math.floor(random.range(1, 4)),
      //grayscale: random.pick([true, false]),
      //monochrome: random.pick([true, false, false, false, false]),

      cols: Math.floor(random.pick([
        random.range(1, 2), random.range(2, 4),
        random.range(1, 3), random.range(3, 5),
        random.range(4, 8),
        ])
      ) * multi,
      additionalCols: Math.floor(random.pick([0, random.range(0, 5)])) * multi,
      rows: Math.floor(random.pick([
        random.range(1, 2), random.range(1, 2), random.range(1, 2), random.range(1, 2), random.range(1, 2), 
        random.range(1, 4), random.range(1, 4), random.range(1, 4),
        random.range(4, 8),
        //random.range(8, 16),
        //random.range(16, 32)
        ])),
      grayscale: random.pick([true, false, false]),
      monochrome: random.pick([true, true, false, false, false]),

    });
    multi = random.pick([1, 2]);
  }

  return configs;
}
/*
function generateSingleImageConfigs(seed, numConfigs = 3) {
  const configs = [];
  setSeed(seed); // Reset seed before generating configurations

  for (let i = 0; i < numConfigs; i++) {
    configs.push({
      //cols: random.pick([1, 2]),
      //additionalCols: 0,
      //rows: random.pick([1, 2]),
      //grayscale: random.pick([true, false]),
      //monochrome: random.pick([true, false, false, false, false]),

      cols: Math.floor(random.range(1, 2)),
      additionalCols: Math.floor(random.pick([0, random.range(0, 2)])),
      rows: Math.floor(random.pick([random.range(1, 3), random.range(2, 4)])),
      grayscale: random.pick([true, false]),
      monochrome: random.pick([true, true, false, false, false]),
    });
  }

  return configs;
}
*/

const globalRowConfigs = generateGlobalRowConfigs(fixedSeed, Math.floor(random.range(6, 16)));
//const globalRowConfigs_B = generateSingleImageConfigs(fixedSeed, Math.floor(random.range(1, 3)));

globalRowConfigs.forEach((config, index) => {
  console.log(`Configuration A ${index + 1}:`);
  console.log(`- Columns: ${config.cols}`);
  console.log(`- Additional Columns: ${config.additionalCols}`);
  console.log(`- Rows: ${config.rows}`);
  console.log(`- Grayscale: ${config.grayscale}`);
  console.log(`- Monochrome: ${config.monochrome}`);
});
/*
globalRowConfigs_B.forEach((config, index) => {
  console.log(`Configuration B ${index + 1}:`);
  console.log(`- Columns: ${config.cols}`);
  console.log(`- Additional Columns: ${config.additionalCols}`);
  console.log(`- Rows: ${config.rows}`);
  console.log(`- Grayscale: ${config.grayscale}`);
  console.log(`- Monochrome: ${config.monochrome}`);
});
*/

/**
 * Track render times based on configs processed
 * 
 */
let totalRenderTime = 0; // To accumulate render time across configurations
let configsProcessed = 0; // To track the number of completed configurations
const expectedConfigs = globalRowConfigs.length; // Total configurations

function logRenderTime(gpuEndTime) {
  const renderTime = (gpuEndTime - globalStartTime) / 1000; // Render time in seconds
  console.log(`Render time: ${renderTime.toFixed(2)} s`);

  totalRenderTime += renderTime;
  configsProcessed++;

  // Check if all configurations are processed
  if (configsProcessed === expectedConfigs) {
    console.log(`All configurations processed. Total render time: ${totalRenderTime.toFixed(2)} s`);
  }
}


/**
 * Create an array of promises by loading, processing, and slicing images into chunks.
 * Once all promises are resolved, shuffle chunks and call a function to place (render)
 * them on the grid. Approach ensures that all images are loaded and processed before 
 * rendering chunks.
 * 
 */
function loadSliceAndRenderMultiple(
  scene, imageUrls, cols, additionalCols, rows, margin,
  grayscale = false,
  monochrome = false,
  chunkHeightOverride = null // Allow overriding chunkHeight
) {
  const group = new THREE.Group();
  const allChunks = [];

  // Validate if the chunk is transparent
  function isTransparentChunk(chunk) {
    if (!chunk.getContext) return false; // If it's not a canvas, assume it's normal

    const ctx = chunk.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, chunk.width, chunk.height);
    const data = imageData.data;

    let transparentPixels = 0;
    let totalChecked = 0;
    
    for (let i = 0; i < data.length; i += 4 * 50) { // Check every 50th pixel for efficiency
      const alpha = data[i + 3]; // Alpha channel
      if (alpha < 5) transparentPixels++;
      totalChecked++;
    }

    const transparencyRatio = transparentPixels / totalChecked;
    return transparencyRatio > 0.9; // 90% or more transparent pixels = transparent chunk
  }
  
  // Use TRANSPARENT_CHUNK_RATIO to control the ratio of transparent chunks to be added to all chunks
  const loadChunksPromises = imageUrls.map((url, imageIndex) =>
    loadImagesSequentially([url]).then((images) => {
      const image = images[0]; // Extract the loaded image

      // Set a deterministic seed per image for cross-browser consistency
      setSeed(`image-${imageIndex}-${fixedSeed}`);

      const { chunkWidth, chunkHeight } = getChunkDimensions(
        image.width,
        chunkHeightOverride || image.height, // Override chunkHeight if provided
        cols,
        rows,
        margin
      );
      
      // Pass the correct chunkHeight into sliceImageIntoChunks
      const chunks = sliceImageIntoChunks(
        image,
        cols,
        rows,
        margin,
        chunkWidth,
        chunkHeightOverride || chunkHeight, // Explicitly prefer the override
        ENABLE_CHUNK_DITHERING, // Enable dithering
        PROB_CHUNK_DITHERING // Probability of a chunk being dithered
      );
      
      chunks.forEach((chunk) => {
        const repeatCount = cols === 1 ? 1 : Math.floor(random.range(1, 5)); // Repeat each chunk N times
        for (let i = 0; i < repeatCount; i++) allChunks.push(chunk);
      });
      

      if (CONSOLE_LOG_loadSliceAndRenderMultiple) console.log(`Chunks:`);
      if (CONSOLE_LOG_loadSliceAndRenderMultiple) console.log(`    Initial chunks: ${allChunks.length}`);

      let chunksCount = allChunks.length;

      // Calculate the number of transparent chunks based on the ratio
      const transparentChunkCount =
        cols === 1 ? 0 : Math.floor(chunksCount * TRANSPARENT_CHUNK_RATIO);

      if (CONSOLE_LOG_loadSliceAndRenderMultiple) console.log(`    Transparent to be added: ${transparentChunkCount}`);

      // Add transparent chunks based on the calculated ratio
      for (let i = 0; i < transparentChunkCount; i++) {
        //console.log(`        Adding transparent chunk, iteration: ${i + 1}`);
        const transparentChunk = createTransparentChunk(
          chunkWidth,
          chunkHeight,
          grayscale,
          monochrome
        );
        allChunks.push(transparentChunk);
      }

      if (CONSOLE_LOG_loadSliceAndRenderMultiple) {
        const countTransparent = allChunks.filter((chunk) =>
          isTransparentChunk(chunk)
        ).length;
        console.log(
          `    Transparent added: ${countTransparent}` // Note, this number can deviate due to "solid color" chunk type
        );
      }

      if (CONSOLE_LOG_loadSliceAndRenderMultiple) console.log(`    Total all chunks: ${allChunks.length}`);
    
    }).catch(error => console.error(`Error loading image: ${error}`))
  );

  Promise.all(loadChunksPromises).then(() => {

    let shuffle;
    if (SHUFFLE_CHUNKS) {
      shuffle = true;
    } else {
      shuffle = random.pick([false, false, true]);
    }

    if (shuffle) {
      // Add names to each chunk for clarity
      allChunks.forEach((chunk, index) => {
        chunk.id = index; // Add an ID to each chunk
        chunk.type = isTransparentChunk(chunk) ? "Transparent" : "Normal"; // Identify chunk type
      });
    
      if (CONSOLE_LOG_loadSliceAndRenderMultiple) {
        console.log(
          "Chunks before shuffle:",
          allChunks.map(chunk => ({
            id: chunk.id,
            type: chunk.type
          }))
        );
      }
    
      // Shuffle deterministically
      const shuffled = deterministicShuffle([...allChunks], fixedSeed);
      allChunks.length = 0; // Clear the array
      allChunks.push(...shuffled); // Push shuffled elements back into the array
    }
    
    // Clipping process
    const clippedChunks = allChunks.filter((_, i) => (i % cols) < cols + additionalCols);
    
    if (CONSOLE_LOG_loadSliceAndRenderMultiple) {
      console.log(
        "Chunks after clipping:",
        clippedChunks.map(chunk => ({
          id: chunk.id,
          type: chunk.type
        }))
      );
    }

    renderChunksInGrid(scene, clippedChunks, group, cols + additionalCols, rows, margin, grayscale, monochrome);

    const gpuEndTime = performance.now();
    logRenderTime(gpuEndTime);
  });
  
  return group;
}


/**
 * Process the image in batches of multiple lines and return a shader.
 * Apply a color transformation (grayscale, monochrome).
 *
 * A batch is a group of lines, categorized into three types:
 * 1. Batch with normal lines.
 * 2. Batch with one line repeating over and over n times.
 * 3. Batch with no lines (a gap).
 *
 * The following illustrates the logic when processing lines:
 *
 * Repeats only:
 * normal line 1
 * normal line 2
 * normal line 3
 * repeat line 3
 * repeat line 3
 * normal line 4
 *
 * Repeats and skips:
 * normal line 1
 * normal line 2
 * normal line 3
 * repeat line 3
 * repeat line 3
 * skip line 4 (empty)
 * skip line 5 (empty)
 * normal line 6
 *
 * To introduce variation, the next normal line may be randomly selected within a 
 * range between the expected line number and n lines ahead. This ensures that 
 * we are not always placing the next normal line immediately after the last 
 * repeated/skipped line.
 *
 * Additionally, a batch can be rotated before stitching all batches back together.
 *
 * After processing the entire image, the script stitches the created batches together
 * to form the final rendered output.
 */

/**
 * For monochrome color transformation:
 *  - Select 2 random colors from the colorSchemes;
 *  - Select colors outside renderChunkAsShader function to keep the same colors across
 * all monochrome chunks.
 *
 */
const baseColor1 = new THREE.Color(getRandomColorFromScheme(colorScheme));
const baseColor2 = new THREE.Color(getRandomColorFromScheme(colorScheme));

function renderChunkAsShader(scene, canvas, offsetX, offsetY, grayscale = false, monochrome = false, chunkId = null) {
  return new Promise((resolve) => {

    // Skip grayscale/monochrome for transparent chunks
    if (canvas.isTransparent) {
      grayscale = false;
      monochrome = false;
    }

    const pixelSize = 1 * SCALE_SOURCE;
    const baseSize = pixelSize * HD_SCALE;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const vertices = [];
    const colors = [];
    const sizes = [];

    const color = new THREE.Color();

    let imageY = 0;
    let absoluteY = 0;
    let lastNormalBatch = null;
    let nextNormalY = 0;

    let batchStore = [];

    // Assign a unique chunk ID if not provided
    if (chunkId === null) {
      chunkId = Math.floor(random.range(1000, 9999)); // Assign a random chunk ID
    }

    if (CONSOLE_LOG_renderChunkAsShader) console.log(`Rendering chunk ID: ${chunkId}`);

    function determineBatchType() {
      let roll = random.next();

      if (roll < PROB_LINEX_SKIP) {
        return "gap";
      } else if (roll < PROB_LINEX_SKIP + PROB_LINEX_REPEAT) {
        return "repeat";
      }
      return "normal";
    }

    function processAllBatches() {
      while (imageY < canvas.height) {
        if (imageY >= canvas.height) {
          if (CONSOLE_LOG_renderChunkAsShader) console.log("All batches processed");
          stitchBatches();
          return;
        }

        let batchSize = Math.floor(random.range(1, 8) * Math.floor(outerHeight / random.range(60, 360)));
        let batchType = determineBatchType();

        if (CONSOLE_LOG_renderChunkAsShader) console.log(`Batch type: ${batchType}, Batch size: ${batchSize}, Chunk ID: ${chunkId}`);

        let batch = [];

        if (batchType === "normal") {
          batch = processNormalBatch(batchSize, chunkId);
        } else if (batchType === "repeat") {
          batch = processRepeatBatch(batchSize, chunkId);
        } else if (batchType === "gap") {
          processGapBatch(batchSize);
          continue; // Skip to next iteration
        }

        //let LINE_ROTATION_PROB = random.range(0.0, 0.3); // 0.3
        if (random.next() < LINE_ROTATION_PROB) {
          batch = applyBatchRotation(batch, random.range(0, 0.005));
        }

        batchStore.push(batch);
      }
      
      if (CONSOLE_LOG_renderChunkAsShader) console.log(`Total batches stored: ${batchStore.length}`);
      
      stitchBatches();
    }

    function processNormalBatch(batchSize) {
      let batch = [];

      if (CONSOLE_LOG_renderChunkAsShader) console.log(`Normal batch: Starting for chunk ${chunkId}`);

      // Assign a unique base Z-index for this chunk
      let baseZ = chunkId * 0.01; // Ensure chunks don't overlap

      for (let i = 0; i < batchSize && imageY < canvas.height; i++, imageY++, absoluteY++) {
        let linePixels = [];

        for (let x = 0; x < canvas.width; x++) {
          const index = (imageY * canvas.width + x) * 4;
          let r = data[index] / 255;
          let g = data[index + 1] / 255;
          let b = data[index + 2] / 255;
          const a = data[index + 3] / 255;

          if (grayscale) {
            let gray = 0.299 * r + 0.587 * g + 0.114 * b;
            gray = (gray - 0.5) * GRAYSCALE_CONTRAST + 0.5;
            r = g = b = Math.max(0, Math.min(1, gray));
          }

          if (monochrome) {
            let mono = 0.299 * r + 0.587 * g + 0.114 * b;
            mono = (mono - 0.5) * GRAYSCALE_CONTRAST + 0.5;
            r = mono * baseColor1.r + (1 - mono) * baseColor2.r;
            g = mono * baseColor1.g + (1 - mono) * baseColor2.g;
            b = mono * baseColor1.b + (1 - mono) * baseColor2.b;
          }

          color.setRGB(r, g, b);
          linePixels.push({ 
            x, 
            y: absoluteY, 
            z: baseZ, // Assign chunk-wide Z index
            color: [color.r, color.g, color.b, a], 
            size: baseSize * random.range(0.8, 1.4)
          });
        }

        if (linePixels.length > 0) batch.push(linePixels);
      }

      if (batch.length > 0) {
        lastNormalBatch = batch[batch.length - 1];  // Always store the last valid batch
        nextNormalY = imageY;
      } else {
        if (CONSOLE_LOG_renderChunkAsShader) {
          console.warn("No normal batch found. Retaining previous batch");
          // Use the last known normal batch instead of setting it to an empty array
          if (!lastNormalBatch) {
            console.error("No previous normal batch exists. This may cause repeat batch skipping");
          }
        }
      }

      if (CONSOLE_LOG_renderChunkAsShader) console.log(`Normal batch: Finished for chunk ${chunkId}`);
      return batch;
    }

    function processRepeatBatch(batchSize) {
      if (!lastNormalBatch || lastNormalBatch.length === 0) {
        if (CONSOLE_LOG_renderChunkAsShader) console.warn(`Skipping repeat batch for chunk ${chunkId} because no normal lines exist yet`);
        return [];
      }
  
      let batch = [];
      let repeatCount = Math.max(1, Math.min(50, getRandomRangeWithDeviation(1, Math.floor(outerHeight / random.range(6, 48)), 3, 5))); // Clamp repeat count
      let baseZ = chunkId * 0.01; // Match Z-layer to chunk ID
      let initialY = absoluteY; // Store initial Y for debugging
  
      const MAX_REPEAT_ITERATIONS = 100; // Hard cap to avoid infinite loop
      let iterations = 0;
  
      if (CONSOLE_LOG_renderChunkAsShader) console.log(`Repeat batch: Starting for chunk ${chunkId}, repeating ${repeatCount} times`);
  
      for (let i = 0; i < repeatCount; i++, absoluteY++) {
        if (absoluteY >= canvas.height) {
          if (CONSOLE_LOG_renderChunkAsShader) console.warn(`Repeat batch stopped early for chunk ${chunkId} - exceeded canvas height at absoluteY=${absoluteY}`);
          break; // Prevent overflow
        }

        if (iterations >= MAX_REPEAT_ITERATIONS) {
          if (CONSOLE_LOG_renderChunkAsShader) console.error(`Repeat batch force-stopped for chunk ${chunkId} after ${iterations} iterations (Prevented infinite loop)`);
          break; // Force exit after too many iterations
        }

        let offsetZ = baseZ + (0.0005 * (i + 1)); // Stay within chunk Z-range

        let repeatedLine = lastNormalBatch.map(p => ({
          ...p,
          y: absoluteY,
          z: offsetZ // Ensure repeats stay in their chunk layer
        }));

        batch.push(repeatedLine);
        iterations++;
      }
  
      let randomOffset = getRandomRangeWithDeviation(1, Math.max(1, repeatCount / 10), nextNormalY, 5);
      imageY = nextNormalY + randomOffset;
  
      if (CONSOLE_LOG_renderChunkAsShader) {
        if (batch.length === 0) {
          console.error(`Repeat batch for chunk ${chunkId} failed, no lines added`);
        } else {
          console.log(`Repeat batch: Finished for chunk ${chunkId} (Started at ${initialY}, Ended at ${absoluteY}, Iterations: ${iterations})`);
        }
      }
  
      return batch;
    }

    function processGapBatch(batchSize) {
      let skipSize = getRandomRangeWithDeviation(1, Math.floor(outerHeight / random.range(2, 24)), 3, 5);
      
      if (CONSOLE_LOG_renderChunkAsShader) console.log(`Skipping ${skipSize} lines at imageY=${imageY}`);

      imageY += skipSize;
      absoluteY += skipSize;
    }

    function applyBatchRotation(batch, angle) {
      if (CONSOLE_LOG_renderChunkAsShader) console.log("Applying batch rotation...");

      //let LINE_ROTATION_ANGLE_MAX = random.pick([Math.floor(random.range(0, 5)), Math.floor(random.range(0, 10)), Math.floor(random.range(0, 15)), Math.floor(random.range(10, 35))]); // 5, 10, 15

      let rotationAngle = (random.next() - 0.5) * 2 * Math.floor(random.range(1, LINE_ROTATION_ANGLE_MAX)) * (Math.PI / 180) * angle;
      let cosTheta = Math.cos(rotationAngle);
      let sinTheta = Math.sin(rotationAngle);

      let centerX = canvas.width / 2;
      let centerY = absoluteY + batch.length / 2;

      return batch.map(line =>
        line.map(({ x, y, z, color, size }) => ({
          x: cosTheta * (x - centerX) - sinTheta * (y - centerY) + centerX,
          y: sinTheta * (x - centerX) + cosTheta * (y - centerY) + centerY,
          z,
          color,
          size
        }))
      );
    }

    function applyRandomPixelScaling(vertices, sizes, colors) {

      if (CONSOLE_LOG_renderChunkAsShader) console.log("Applying random pixel scaling...");
    
      if (!sizes || sizes.length === 0) {
        if (CONSOLE_LOG_renderChunkAsShader) console.warn("applyRandomPixelScaling: Sizes array is empty or undefined");
        finalizeWebGLGeometry();
        return;
      }
    
      const totalPixels = sizes.length;
    
      // Define a cap on the maximum number of pixels to scale
      const maxScalablePixels = Math.floor(totalPixels * 0.05); // Cap at 5% of total pixels
      const pixelScaleThreshold = PROB_RAND_PIXEL_SCALE * totalPixels;
    
      // Ensure we don't exceed the cap and account for very small probabilities
      const numPixelsToScale = Math.min(maxScalablePixels, Math.max(0, Math.floor(pixelScaleThreshold)));
    
      if (numPixelsToScale === 0) {
        if (CONSOLE_LOG_renderChunkAsShader) console.log("No pixels selected for scaling due to very low probability.");
        applyRandomPixelRepeats(); // Move on to the next step without scaling
        return;
      }
    
      let pixelIndices = new Set();
    
      // Select the pixels to scale
      while (pixelIndices.size < numPixelsToScale) {
        pixelIndices.add(Math.floor(random.range(0, totalPixels)));
      }
    
      const waveParams = {
        amplitude: Math.PI / 2,
        frequencyX: 0.1,
        frequencyY: 0.2
      };
    
      // Apply scaling to selected pixels
      pixelIndices.forEach(i => {
        const col = i % canvas.width;  // Column index
        const row = Math.floor(i / canvas.width);  // Row index
    
        // Apply wave distortion
        const waveAngle =
          waveParams.amplitude *
          Math.sin(col * waveParams.frequencyX + row * waveParams.frequencyY);
    
        // Scale the pixel size with wave-influenced factor
        let scaleFactor = random.range(1, RAND_PIXEL_MAX_SIZE / Math.floor(random.range(0.5, 3))) *
                          Math.abs(Math.sin(waveAngle)); // Apply wave impact
    
        // Prevent extreme scaling
        scaleFactor = Math.max(1, Math.min(scaleFactor, random.pick([3, 4, 6])));
    
        sizes[i] *= scaleFactor;
    
        // Adjust the Z-index to add depth
        const zIndex = i * 3 + 2;
        vertices[zIndex] += 0.05 + Math.sin(waveAngle) * 0.02;

        const xIndex = i * 3;
        const yIndex = i * 3 + 1;

        vertices[xIndex] += Math.sin(waveAngle) * random.pick([
          random.range(-0.2, 0.2), random.range(-0.2, 0.2),
          random.range(-0.2, 0.2), random.range(-0.2, 0.2),
          random.range(-0.2, 0.2),
          random.range(-24, 24),
          random.range(-48, 48),
          random.range(-128, 128),
          random.range(-256, 256)
        ]);
        vertices[yIndex] += Math.cos(waveAngle) * random.pick([
          random.range(-0.2, 0.2), random.range(-0.2, 0.2),
          random.range(-0.2, 0.2), random.range(-0.2, 0.2),
          random.range(-0.2, 0.2),
          random.range(-24, 24),
          random.range(-48, 48),
          random.range(-128, 128),
          random.range(-256, 256)
        ]);
      });
    
      if (CONSOLE_LOG_renderChunkAsShader) {
        console.log(`Controlled pixel scaling complete. Scaled ${pixelIndices.size} pixels`);
      }
    
      applyRandomPixelRepeats(vertices, sizes, colors); // Proceed to pixel repeats after scaling
    }

    function applyRandomPixelRepeats(vertices, sizes, colors) {

      if (CONSOLE_LOG_renderChunkAsShader) console.log("Applying controlled pixel repeats...");
      
      if (!sizes || sizes.length === 0) {
        if (CONSOLE_LOG_renderChunkAsShader) console.warn("applyRandomPixelRepeats: Sizes array is empty or undefined");
        finalizeWebGLGeometry();
        return;
      }
    
      const totalPixels = sizes.length;
    
      // Calculate the number of pixels to repeat based on probability
      const maxRepeatablePixels = Math.floor(totalPixels * 0.05); // Cap at 5% of total pixels
      const pixelRepeatThreshold = PROB_PIXEL_REPEAT * totalPixels;
    
      // Ensure we don't exceed the cap, and account for very small probabilities
      const numPixelsToRepeat = PROB_PIXEL_REPEAT === 0 ? 0 : Math.min(maxRepeatablePixels, Math.max(0, Math.floor(pixelRepeatThreshold)));
    
      if (numPixelsToRepeat === 0) {
        if (CONSOLE_LOG_renderChunkAsShader) console.log("No pixels selected for repetition due to very low probability.");
        finalizeWebGLGeometry();
        return;
      }
    
      let repeatIndices = new Set();
    
      // Select the pixels to repeat
      while (repeatIndices.size < numPixelsToRepeat) {
        repeatIndices.add(Math.floor(random.range(0, totalPixels)));
      }
    
      let totalRepeats = 0;
    
      repeatIndices.forEach(i => {
        const baseX = vertices[i * 3];
        const baseY = vertices[i * 3 + 1];
        const baseZ = vertices[i * 3 + 2];
    
        const baseColor = colors.slice(i * 4, i * 4 + 4);
        const baseSize = sizes[i];
    
        const repeatCount = Math.floor(random.range(1, 4)); // Control how many times each pixel repeats
        totalRepeats += repeatCount;
    
        for (let j = 0; j < repeatCount; j++) {
          const xOffset = random.range(-0.2, 0.2);
          const yOffset = random.range(0, random.pick([-64, -32,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          ])); // Keep variation spread by Y
    
          vertices.push(baseX + xOffset, baseY + yOffset, baseZ);
          colors.push(...baseColor);
          sizes.push(baseSize * random.range(0.8, 1.4));
        }
      });
    
      if (CONSOLE_LOG_renderChunkAsShader) console.log(`Selected ${repeatIndices.size} pixels for repetition, with a total of ${totalRepeats} duplicates applied`);
    
      finalizeWebGLGeometry();
    } 

    function stitchBatches() {
      if (CONSOLE_LOG_renderChunkAsShader) console.log("Stitching all batches together...");

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      batchStore.forEach(batch => {
        batch.forEach(line => {
          line.forEach(({ x, y, z, color, size }) => {
            vertices.push(x * pixelSize + offsetX, -y * pixelSize + offsetY, z);
            colors.push(...color);
            sizes.push(size);

            // Track min/max for stitched size calculation
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          });
        });
      });

      let stitchedWidth = maxX - minX;
      let stitchedHeight = maxY - minY;

      // Stitched render size
      if (CONSOLE_LOG_renderChunkAsShader) console.log(`Rendered chunk size: w: ${stitchedWidth.toFixed(0)}, h: ${stitchedHeight.toFixed(0)}`);

      applyRandomPixelScaling(vertices, sizes, colors); // Apply scaling after stitching
    }

    function finalizeWebGLGeometry() {
      if (CONSOLE_LOG_renderChunkAsShader) console.log("Finalizing WebGL geometry...");

      if (vertices.length === 0) {
        if (CONSOLE_LOG_renderChunkAsShader) console.warn("No vertices found, skipping geometry creation");
        resolve(null);
        return;
      }

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      for (let i = 0; i < vertices.length; i += 3) {
        let x = vertices[i];
        let y = vertices[i + 1];

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

      let geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
      geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

      //let baseSizeLogged = false;  // Flag to ensure the console log fires only once

      let material = new THREE.ShaderMaterial({
        uniforms: { 
          baseSize: { 
            value: baseSize 
          } 
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        vertexColors: true,
        transparent: true,
      });

      // Log the baseSize once
      //if (!baseSizeLogged) {
      //  console.log(`Uniform baseSize: ${baseSize}`);
      //  baseSizeLogged = true;
      //}

      let points = new THREE.Points(geometry, material);
      scene.add(points);

      if (CONSOLE_LOG_renderChunkAsShader) console.log("WebGL geometry built and added to scene");

      resolve(points);
    }

    processAllBatches();
  });
}


/**
 * Create a container (typically, a line called “a global row”) holding a grid with rendered
 * chunks by:
 *  - obtaining rows configuration from generateGlobalRowConfigs;
 *  - calling a group of chunks arranged in a grid for every row
 * 
 */
async function createGlobalRows(scene, globalRowConfigs, imageUrls, margin, globalRowMargin) {
  const firstImage = (await loadImagesSequentially([imageUrls[0]]))[0];
  const imageHeight = firstImage.height;

  const totalGlobalRowsHeight = globalRowConfigs.length * imageHeight + (globalRowConfigs.length - 1) * globalRowMargin;

  const groupStartY = totalGlobalRowsHeight / 2;

  globalRowConfigs.forEach((config, index) => {
    const { cols, additionalCols, rows, grayscale = false, monochrome = false } = config;

    // Reset the seed to maintain consistency accross different environments
    setSeed(`row-${index}-${fixedSeed}`); // Use a unique seed per row

    // Calculate the y-offset for this global row, including global row margin
    const globalRowOffsetY = 
      groupStartY - 
      index * (imageHeight + globalRowMargin) - 
      imageHeight / 2;

    //const innerRowHeight = (imageHeight - (rows - 1) * margin) / rows;
    const innerRowHeight = null;

    const group = loadSliceAndRenderMultiple(
      scene,
      imageUrls,
      cols,
      additionalCols,
      rows,
      margin,
      grayscale,
      monochrome,
      innerRowHeight
    );

    group.position.y = globalRowOffsetY;
    scene.add(group);
  });
}


// =============================
// RENDER
// =============================

const renderer = new THREE.WebGLRenderer({
  canvas: webgl,
  powerPreference: SET_PRECISION.powerPreference,
  antialias: SET_PRECISION.antialias,
  precision: SET_PRECISION.precision,
});

const scaleFactor = window.devicePixelRatio;

renderer.setSize(outerWidth, outerHeight, false);
renderer.setPixelRatio(scaleFactor);

console.log(`Renderer size set to: ${outerWidth}x${outerHeight}, Pixel ratio: ${renderer.getPixelRatio()}`);

document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const backgroundColorScheme = getRandomColorScheme(true);
const backgroundColor = getRandomColorFromScheme(backgroundColorScheme);
scene.background = new THREE.Color(backgroundColor);

const camera = new THREE.OrthographicCamera(
  outerWidth / -2,  // left
  outerWidth / 2,   // right
  outerHeight / 2,  // top
  outerHeight / -2, // bottom
  0.1,                // near clipping plane
  10000               // far clipping plane
);
camera.position.z = 1000;
camera.lookAt(new THREE.Vector3(0, 0, 0));

// Resize canvas to fit browser window height
function resizeAndCenterCanvas() {
  const webglCanvas = document.getElementById('webgl');
  const aspectRatio = outerWidth / outerHeight;
  const windowHeight = window.innerHeight;
  const windowWidth = window.innerWidth;

  // Calculate scaled dimensions to fit the browser
  const scaledHeight = windowHeight;
  const scaledWidth = scaledHeight * aspectRatio;

  // Update CSS only for visual scaling
  webglCanvas.style.width = `${scaledWidth}px`;
  webglCanvas.style.height = `${scaledHeight}px`;
  webglCanvas.style.left = `${(windowWidth - scaledWidth) / 2}px`;
  webglCanvas.style.top = `${(windowHeight - scaledHeight) / 2}px`;
}

if (scaleToWindow) {
  // Listen to window resize events
  window.addEventListener('resize', resizeAndCenterCanvas);

  // Call the resize function initially
  resizeAndCenterCanvas();
}

// Enable markers to visualise the canvas borders
//drawCoordinateMarkers(scene);
//drawGuidelines(scene);

(async () => {

  try {
    
    const loadedImages = await loadImagesSequentially(IMAGE_URLS);
    if (loadedImages.length === 0) {
      throw new Error('No images were loaded successfully');
    } else {
      /*
      // Get the last 8 characters from dataUrl for a unique and treceable ID
      function getTailIdentifier(dataUrl) {
        const base64Content = dataUrl.split(',')[1]; // Get the base64 content after the comma
        return base64Content.slice(-8); // Take the last 8 characters
      }

      // Generate filenames using the tail symbols
      const IMAGE_OBJECTS = IMAGE_URLS.map((dataUrl, index) => {
        const fileExtension = dataUrl.match(/^data:image\/(\w+);base64,/)[1]; // Get file type
        const uniqueID = getTailIdentifier(dataUrl); // Get the tail identifier
        const fileName = `image_${uniqueID}.${fileExtension}`;
        return { name: fileName, dataUrl };
      });
      
      // Log the loaded images with their unique identifiers
      console.log('Loaded images:');
      IMAGE_OBJECTS.forEach(image => {
        console.log(`- ${image.name}`);
      });
      */

      IMAGE_URLS.forEach(url => {
        const fileName = url.split('/').pop(); // Extract the file name from the URL
        console.log(`  ${fileName}`); // Log each filename on a new line
      });
    }

    // Calculate and emit dimensions
    const { cols, additionalCols, rows, chunkWidth, chunkHeight, colorScheme } = calculateAndEmitChunkDimensions(globalRowConfigs, outerWidth, outerHeight, CHUNK_MARGIN);

    // =============================
    // Render on the screen
    // =============================

    //const whatConfig = random.next();  // Get a single random number between 0 and 1
    //if (whatConfig < 0.3) {
    //  await createGlobalRows(scene, singleImageConfig, IMAGE_URLS, CHUNK_MARGIN, CHUNK_MARGIN);
    //} else if (whatConfig < 0.6) {
    //  await createGlobalRows(scene, globalRowConfigs, IMAGE_URLS, CHUNK_MARGIN, CHUNK_MARGIN);
    //} else {

      

      await createGlobalRows(scene, globalRowConfigs, IMAGE_URLS, CHUNK_MARGIN, CHUNK_MARGIN);
      //await createGlobalRows(scene, globalRowConfigs_B, IMAGE_URLS, CHUNK_MARGIN, CHUNK_MARGIN);
    //}

  } catch (error) {
    console.error("Error during rendering process:", error);
  }

  // Set up the rendering loop
  function render() {
    setTimeout(() => {
      requestAnimationFrame(render);
      renderer.render(scene, camera);
    }, 1000 / 1); // FPS limit
  }
  render();

})();


// =============================
// CAPTURE & SAVE
// =============================

/**
 * Create and return a single combined canvas
 * 
 */
function getFinalCanvas() {
  try {
      const webglCanvas = document.getElementById('webgl');
      const canvas2D = document.getElementById('canvas2d');

      if (!webglCanvas) {
          console.error("WebGL canvas is missing.");
          return null;
      }

      const gl = renderer.getContext();
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;

      console.log(`Renderer size set to: ${outerWidth}x${outerHeight}, Pixel ratio: ${window.devicePixelRatio}`);
      console.log(`Capturing WebGL framebuffer: ${width}x${height}`);

      // Render WebGL scene before capturing
      renderer.render(scene, camera);
      gl.finish();

      // Create final canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = outerWidth;
      finalCanvas.height = outerHeight;
      const finalCtx = finalCanvas.getContext('2d');

      // Clear the final canvas before drawing
      finalCtx.clearRect(0, 0, outerWidth, outerHeight);

      // Scale WebGL output correctly
      finalCtx.drawImage(
          webglCanvas,
          0, 0, width, height, // Source: full WebGL buffer
          0, 0, outerWidth, outerHeight // Destination: match expected canvas size
      );

      // Ensure 2D canvas is properly drawn
      if (!canvas2D) {
          console.warn("canvas2D not found in the DOM.");
      } else if (canvas2D.width === 0 || canvas2D.height === 0) {
          console.warn("canvas2D exists but has zero dimensions.");
      } else {
          console.log(`Drawing canvas2D (${canvas2D.width}x${canvas2D.height}) onto final canvas.`);
          finalCtx.drawImage(canvas2D, 0, 0, outerWidth, outerHeight);
      }

      // Append the final canvas to the document if not already present
      if (!document.getElementById('finalCanvas')) {
          finalCanvas.id = 'finalCanvas';
          document.body.appendChild(finalCanvas);
      }

      return finalCanvas;
  } catch (error) {
      console.error("Error generating final canvas:", error);
      return null;
  }
}


/**
 * Save the canvas as a PNG
 * Press Command + S (macOS) or Ctrl + S (Windows/Linux) to save as a PNG
 * 
 */
function saveAsPNG() {
  try {
    const finalCanvas = getFinalCanvas(); // Get the combined canvas
    if (!finalCanvas) throw new Error('Final canvas is not available');

    const link = document.createElement('a');
    link.download = `Scriptura Primitiva (${fixedSeed}).png`;
    link.href = finalCanvas.toDataURL('image/png');
    link.click();

    console.log('Combined render saved successfully');
  } catch (error) {
    console.error('Error saving combined render:', error);
  }
}

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault(); // Prevent default browser save
    e.stopPropagation(); // Stop event propagation
    saveAsPNG(); // Trigger the save function
  }
});
