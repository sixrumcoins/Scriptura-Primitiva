#!/bin/bash

# Instructions
# Make the script executable:
# chmod +x compress_png_to_jpg.sh
# Run the script:
# ./compress_png_to_jpg.sh


# Directory containing images to compress
INPUT_DIR="./images"
# Output directory for compressed images
OUTPUT_DIR="./images"

# Ensure the output directory exists
mkdir -p "$OUTPUT_DIR"

# Loop through files in the root images directory only
find "$INPUT_DIR" -maxdepth 1 -type f | while IFS= read -r img; do
  # Extract the file name and extension
  filename=$(basename "$img")
  ext="${img##*.}"
  
  # Check if the file is a PNG image
  if [[ "$ext" =~ ^(png|bmp|webp)$ ]]; then
    echo "Compressing: $img"
    
    # Compress the image and save as JPEG
    output_file="$OUTPUT_DIR/${filename%.*}.jpg"
    magick "$img" -quality 85 "$output_file" && echo "Compressed to: $output_file"
  else
    echo "Skipping non-compressible file: $img"
  fi
done

echo "Image compression completed. Compressed images are in $OUTPUT_DIR"