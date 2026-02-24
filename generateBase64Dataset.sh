#!/bin/bash

# Instructions
# Make the script executable:
# chmod +x generateBase64Dataset.sh
# Run the script:
# ./generateBase64Dataset.sh


# Output file for the dataset
OUTPUT_FILE="base64ImageDataset.js"

# Start the dataset array with an export statement
echo "export const IMAGE_DATASET = [" > "$OUTPUT_FILE"

# Loop through files in the root images directory only
find ./images -maxdepth 1 -type f | while IFS= read -r img; do
  # Extract the file extension
  ext="${img##*.}"
  
  # Check if the file is an image based on its extension
  if [[ "$ext" =~ ^(jpg|jpeg|png|gif|bmp|webp)$ ]]; then
    echo "Processing: $img"
    
    # Encode the image as Base64, ensuring no line breaks
    base64_encoded=$(base64 -i "$img" | tr -d '\n')
    echo "  'data:image/$ext;base64,$base64_encoded'," >> "$OUTPUT_FILE"
  else
    echo "Skipping non-image file: $img"
  fi
done

# Close the dataset array
echo "];" >> "$OUTPUT_FILE"

echo "Base64 dataset written to $OUTPUT_FILE"