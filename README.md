# Scriptura-Primitiva
Image distortion exploration as a method for composition reconstruction: Part 2 — now with shaders.


## What Is It

It is an algorithmic work of digital art. The script builds on previous work, [Generative Pointillism](https://github.com/sixrumcoins/Generative-Pointillism), similarly exploring the distortion of a source image through algorithmic randomized recomposition.

Made with pure JavaScript, it uses three.js for shaders and runs in your browser. The script is quite slow — experiment with different browsers and open the browser inspector to monitor output generation progress.

<div style="display: flex; gap: 20px;">
<img src="./Scriptura Primitiva (c791cf31).jpg" width="25%" />
<img src="./Scriptura Primitiva (ded27f6b).jpg" width="25%" />
<img src="./Scriptura Primitiva (334454ad).jpg" width="25%" />
</div>


## How To Run

### Create a Node.js Project

Create a package.json file:
```sh
npm init -y
```

Install Vite:
```sh
npm install vite
```

In package.json, replace the "scripts" section with:
```sh
{
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
}
```

After your edits, update package.json and package-lock.json:
```sh
npm install
```

### Install Three.js

Install three.js:
```sh
npm install three
```

### Run In a Browser

Run the following command in the terminal to start a local server:
```sh
npm run dev
```

Open http://localhost:5173/ in a browser.


## Image Processing Utilities

### Convert Images to base64ImageDataset

Make the script executable:
```sh
chmod +x generateBase64Dataset.sh
```

Run the script:
```sh
./generateBase64Dataset.sh
```

### Batch Convert PNG to JPEG (ImageMagick)

Verify that ImageMagick is installed on macOS:
```sh
convert -version
```

If not installed, install it with Homebrew:
```sh
brew install imagemagick
```

Option 1 — Loop through files:
```sh
for file in ./images/*.png; do
  convert "$file" -quality 85 "${file%.png}.jpg"
done
```

Option 2 — Using find:
```sh
find ./images -name "*.png" -exec sh -c 'convert "$0" -quality 85 "${0%.png}.jpg"' {} \;
```

### Batch Convert PNG to JPEG (Shell Script)

Make the script executable:
```sh
chmod +x compress_png_to_jpg.sh
```

Run the script:
```sh
./compress_png_to_jpg.sh
```

### Batch Resize Images (Shell Script)

Make the script executable:
```sh
chmod +x resize_images.sh
```

Run the script:
```sh
./resize_images.sh path_to_input_directory path_to_output_directory width height
```

Example:
```sh
./resize_images.sh ./images/jpg ./images 2000 2000
```


## How to Use

- `Cmd+R` Refresh the browser window to generate a new output.
- `Cmd+S` Save the output as a .PNG image.

---

Developed between 2024 and 2025. A stripped-off version was released on fxhash.xyz in February 2025 under a pseudonymous moniker. All rights reserved.
