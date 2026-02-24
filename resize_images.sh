#!/bin/bash

# Usage: ./resize_images.sh input_directory output_directory width height

# Check if the correct number of arguments is provided
if [ "$#" -ne 4 ]; then
    echo "Usage: $0 input_directory output_directory width height"
    exit 1
fi

INPUT_DIR="$1"
OUTPUT_DIR="$2"
WIDTH="$3"
HEIGHT="$4"

# Create the output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Loop through all image files in the input directory
for file in "$INPUT_DIR"/*.{jpg,jpeg,png,gif,bmp}; do
    if [ -f "$file" ]; then
        # Get the filename without the directory path
        filename=$(basename "$file")

        # Resize the image and save it to the output directory
        magick "$file" -resize "${WIDTH}x${HEIGHT}" "$OUTPUT_DIR/$filename"
        
        echo "Resized $filename to ${WIDTH}x${HEIGHT} and saved to $OUTPUT_DIR"
    fi
done

echo "Batch resizing complete!"