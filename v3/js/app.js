// Default SVG shape palette (loaded from assets folder)
let defaultShapes = [];
let shapes = [];
let parsedShapes = []; // Cache of parsed SVG elements for performance
let video, imagePreview, outputSvg, canvas, ctx;
let animationFrame;
let isProcessing = false;
let lastFrameTime = 0;
let fps = 0;
let currentMediaType = null; // 'video', 'webcam', or 'image'
let currentImage = null; // Store the loaded image

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    video = document.getElementById('video');
    imagePreview = document.getElementById('imagePreview');
    outputSvg = document.getElementById('outputSvg');
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadTextFrequently: true });

    // Load default shapes from assets folder
    await loadDefaultShapes();

    renderShapeList();
    setupEventListeners();
});

// Load default SVG shapes from assets folder
async function loadDefaultShapes() {
    const shapeFiles = [
        'square-01.svg', 'square-02.svg', 'square-03.svg', 'square-04.svg',
        'square-05.svg', 'square-06.svg', 'square-07.svg', 'square-08.svg',
        'square-09.svg', 'square-10.svg', 'square-11.svg', 'square-12.svg',
        'square-13.svg', 'square-14.svg', 'square-15.svg', 'square-16.svg',
        'square-17.svg', 'square-18.svg', 'square-19.svg', 'square-20.svg',
        'square-21.svg', 'square-22.svg', 'square-23.svg', 'square-24.svg'
    ];

    for (const filename of shapeFiles) {
        try {
            const response = await fetch(`assets/${filename}`);
            const svgText = await response.text();

            // Parse and process the SVG
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = doc.querySelector('svg');

            if (svgElement) {
                // Extract all shape elements
                const extractElements = (parent) => {
                    let result = [];
                    for (const child of parent.children) {
                        if (child.tagName.toLowerCase() === 'g') {
                            result = result.concat(extractElements(child));
                        } else if (child.tagName.toLowerCase() === 'defs' ||
                                  child.tagName.toLowerCase() === 'title' ||
                                  child.tagName.toLowerCase() === 'desc') {
                            continue;
                        } else {
                            const clone = child.cloneNode(true);
                            if (clone.hasAttribute('fill')) {
                                const fillValue = clone.getAttribute('fill');
                                if (fillValue !== 'none') {
                                    clone.setAttribute('fill', 'currentColor');
                                }
                            } else {
                                clone.setAttribute('fill', 'currentColor');
                            }
                            if (clone.hasAttribute('stroke')) {
                                const strokeValue = clone.getAttribute('stroke');
                                if (strokeValue !== 'none') {
                                    clone.setAttribute('stroke', 'currentColor');
                                }
                            }
                            result.push(clone);
                        }
                    }
                    return result;
                };

                const elements = extractElements(svgElement);
                if (elements.length > 0) {
                    let viewBox = svgElement.getAttribute('viewBox') || '0 0 10 10';
                    if (!svgElement.hasAttribute('viewBox')) {
                        const width = svgElement.getAttribute('width') || '10';
                        const height = svgElement.getAttribute('height') || '10';
                        viewBox = `0 0 ${width} ${height}`;
                    }
                    const shapeContent = elements.map(el => el.outerHTML).join('\n');
                    const normalizedShape = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${shapeContent}</svg>`;
                    defaultShapes.push(normalizedShape);
                }
            }
        } catch (err) {
            console.error(`Error loading ${filename}:`, err);
        }
    }

    // Set shapes to default
    shapes = [...defaultShapes];
    console.log(`Loaded ${shapes.length} default shapes from assets folder`);

    // Pre-parse all shapes for performance
    parseAndCacheShapes();
}

// Parse all shapes once and cache them for fast access
function parseAndCacheShapes() {
    parsedShapes = shapes.map(shapeString => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = shapeString;
        const shapeSvg = tempDiv.querySelector('svg');

        if (!shapeSvg) return null;

        // Extract viewBox
        const viewBox = shapeSvg.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 10, 10];
        const [vbX, vbY, vbWidth, vbHeight] = viewBox;

        // Extract shape elements (excluding metadata)
        const shapeElements = Array.from(shapeSvg.children).filter(child => {
            const tagName = child.tagName.toLowerCase();
            return !['defs', 'title', 'desc', 'metadata'].includes(tagName);
        });

        return {
            viewBox: { x: vbX, y: vbY, width: vbWidth, height: vbHeight },
            elements: shapeElements
        };
    }).filter(shape => shape !== null);

    console.log(`Cached ${parsedShapes.length} parsed shapes`);
}

function setupEventListeners() {
    document.getElementById('startWebcam').addEventListener('click', startWebcam);
    document.getElementById('stopWebcam').addEventListener('click', stopVideo);
    document.getElementById('videoFile').addEventListener('change', handleVideoFile);
    document.getElementById('imageFile').addEventListener('change', handleImageFile);
    document.getElementById('clearVideo').addEventListener('click', clearVideoFile);
    document.getElementById('clearImage').addEventListener('click', clearImageFile);
    document.getElementById('resolution').addEventListener('input', (e) => {
        document.getElementById('resValue').textContent = e.target.value;
        // Re-process image if static image is loaded
        if (currentMediaType === 'image' && currentImage) {
            processStaticImage();
        }
    });
    document.getElementById('shapeSize').addEventListener('input', (e) => {
        document.getElementById('sizeValue').textContent = e.target.value;
        // Re-process image if static image is loaded
        if (currentMediaType === 'image' && currentImage) {
            processStaticImage();
        }
    });
    document.getElementById('colorMode').addEventListener('change', () => {
        // Re-process image if static image is loaded
        if (currentMediaType === 'image' && currentImage) {
            processStaticImage();
        }
    });
    document.getElementById('bgColor').addEventListener('input', (e) => {
        // Update background color of main output area
        document.querySelector('.main-output').style.background = e.target.value;
    });
    document.getElementById('shapeColor').addEventListener('input', () => {
        // Re-process image if static image is loaded
        if (currentMediaType === 'image' && currentImage) {
            processStaticImage();
        }
    });
    document.getElementById('invertBrightness').addEventListener('change', () => {
        // Re-process image if static image is loaded
        if (currentMediaType === 'image' && currentImage) {
            processStaticImage();
        }
    });
    document.getElementById('svgUpload').addEventListener('change', handleSvgUpload);
    document.getElementById('resetShapes').addEventListener('click', resetShapes);
    document.getElementById('clearShapes').addEventListener('click', clearShapes);
    document.getElementById('copySvg').addEventListener('click', copySvgToClipboard);
}

function renderShapeList() {
    const shapeList = document.getElementById('shapeList');
    shapeList.innerHTML = '';

    shapes.forEach((shape, index) => {
        const div = document.createElement('div');
        div.className = 'shape-item';

        const minBright = Math.floor((index / shapes.length) * 255);
        const maxBright = Math.floor(((index + 1) / shapes.length) * 255);

        // Display the shape - it's already wrapped in SVG
        div.innerHTML = `
            <div style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                ${shape}
            </div>
            <div class="brightness-range">Range ${index + 1}: ${minBright}-${maxBright}</div>
            <button class="remove-shape" data-index="${index}" style="margin-top: 5px; padding: 3px 8px; font-size: 11px;">Remove</button>
        `;

        // Set size for the preview
        const svgElement = div.querySelector('svg');
        if (svgElement) {
            svgElement.style.width = '60px';
            svgElement.style.height = '60px';
            svgElement.style.color = 'white';
        }

        shapeList.appendChild(div);
    });

    // Add click handlers for remove buttons
    document.querySelectorAll('.remove-shape').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            shapes.splice(index, 1);
            parseAndCacheShapes(); // Update cache
            renderShapeList();
        });
    });

    // Update palette count
    document.getElementById('shapePalette').textContent = shapes.length;

    // Re-process image if static image is loaded
    if (currentMediaType === 'image' && currentImage) {
        processStaticImage();
    }
}

async function handleSvgUpload(e) {
    const files = Array.from(e.target.files);

    for (const file of files) {
        try {
            const text = await file.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'image/svg+xml');
            const svgElement = doc.querySelector('svg');

            if (svgElement) {
                // Extract all shape elements, unwrapping any g elements
                const extractElements = (parent) => {
                    let result = [];
                    for (const child of parent.children) {
                        if (child.tagName.toLowerCase() === 'g') {
                            // Unwrap g elements and get their children recursively
                            result = result.concat(extractElements(child));
                        } else if (child.tagName.toLowerCase() === 'defs' ||
                                  child.tagName.toLowerCase() === 'title' ||
                                  child.tagName.toLowerCase() === 'desc') {
                            // Skip metadata elements
                            continue;
                        } else {
                            // Clone the element
                            const clone = child.cloneNode(true);

                            // Replace any hardcoded fill colors with currentColor
                            if (clone.hasAttribute('fill')) {
                                const fillValue = clone.getAttribute('fill');
                                if (fillValue !== 'none') {
                                    clone.setAttribute('fill', 'currentColor');
                                }
                            } else {
                                // No fill attribute, add currentColor as default
                                clone.setAttribute('fill', 'currentColor');
                            }

                            // Replace any hardcoded stroke colors with currentColor
                            if (clone.hasAttribute('stroke')) {
                                const strokeValue = clone.getAttribute('stroke');
                                if (strokeValue !== 'none') {
                                    clone.setAttribute('stroke', 'currentColor');
                                }
                            }

                            result.push(clone);
                        }
                    }
                    return result;
                };

                const elements = extractElements(svgElement);

                if (elements.length > 0) {
                    // Get viewBox for proper scaling
                    let viewBox = svgElement.getAttribute('viewBox') || '0 0 10 10';

                    // If viewBox doesn't exist, try to construct from width/height
                    if (!svgElement.hasAttribute('viewBox')) {
                        const width = svgElement.getAttribute('width') || '10';
                        const height = svgElement.getAttribute('height') || '10';
                        viewBox = `0 0 ${width} ${height}`;
                    }

                    // Convert to HTML string and wrap in a normalized SVG container
                    const shapeContent = elements.map(el => el.outerHTML).join('\n');
                    const normalizedShape = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${shapeContent}</svg>`;

                    shapes.push(normalizedShape);
                    console.log(`Loaded ${file.name}:`, normalizedShape);
                } else {
                    console.warn(`No valid SVG content found in ${file.name}`);
                }
            }
        } catch (err) {
            console.error(`Error loading ${file.name}:`, err);
            alert(`Error loading ${file.name}: ${err.message}`);
        }
    }

    parseAndCacheShapes(); // Update cache after uploading new shapes
    renderShapeList();
    e.target.value = ''; // Reset file input
}

function resetShapes() {
    shapes = [...defaultShapes];
    parseAndCacheShapes(); // Update cache
    renderShapeList();
}

function clearShapes() {
    if (confirm('Are you sure you want to clear all shapes?')) {
        shapes = [];
        parseAndCacheShapes(); // Update cache
        renderShapeList();
    }
}

async function copySvgToClipboard() {
    try {
        // Get the current SVG element
        const svg = document.getElementById('outputSvg');

        if (!svg.children.length) {
            showCopyFeedback('No frame to copy! Start video first.', false);
            return;
        }

        // Clone the SVG to avoid modifying the original
        const svgClone = svg.cloneNode(true);

        // Add XML namespace if not present
        if (!svgClone.hasAttribute('xmlns')) {
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }

        // Get the SVG as a string
        const svgString = new XMLSerializer().serializeToString(svgClone);

        // Create a properly formatted SVG with XML declaration
        const formattedSvg = `<?xml version="1.0" encoding="UTF-8"?>\n${svgString}`;

        // Copy to clipboard
        await navigator.clipboard.writeText(formattedSvg);

        // Show success feedback
        showCopyFeedback('✓ Copied! Paste in Figma or Illustrator', true);

        console.log('SVG copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy SVG:', err);
        showCopyFeedback('✗ Failed to copy', false);
    }
}

function showCopyFeedback(message, success) {
    const feedback = document.getElementById('copyFeedback');
    feedback.textContent = message;
    feedback.style.color = success ? '#2ecc71' : '#e74c3c';
    feedback.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
        feedback.classList.remove('show');
    }, 3000);
}

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 }
        });
        stopMedia();
        currentMediaType = 'webcam';
        video.srcObject = stream;
        video.style.display = 'block';
        document.getElementById('videoStatus').textContent = 'Webcam active';
        document.getElementById('startWebcam').disabled = true;
        document.getElementById('stopWebcam').disabled = false;

        video.addEventListener('loadedmetadata', () => {
            startProcessing();
        });
    } catch (err) {
        alert('Could not access webcam: ' + err.message);
    }
}

function handleVideoFile(e) {
    const file = e.target.files[0];
    if (file) {
        stopMedia();
        currentMediaType = 'video';
        video.src = URL.createObjectURL(file);
        video.style.display = 'block';
        video.loop = true;
        video.play();
        document.getElementById('videoStatus').textContent = 'Video file loaded';
        document.getElementById('startWebcam').disabled = true;
        document.getElementById('stopWebcam').disabled = false;

        // Show clear button
        document.getElementById('clearVideo').style.display = 'flex';

        video.addEventListener('loadedmetadata', () => {
            startProcessing();
        });
    }
}

function handleImageFile(e) {
    const file = e.target.files[0];
    if (file) {
        stopMedia();
        currentMediaType = 'image';

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                imagePreview.src = event.target.result;
                imagePreview.style.display = 'block';
                document.getElementById('videoStatus').textContent = 'Image loaded: ' + file.name;
                document.getElementById('startWebcam').disabled = true;
                document.getElementById('stopWebcam').disabled = false;

                // Show clear button
                document.getElementById('clearImage').style.display = 'flex';

                // Process the static image
                processStaticImage();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function stopMedia() {
    // Stop video
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    if (video.src) {
        video.pause();
        video.src = '';
    }
    video.style.display = 'none';

    // Hide image preview
    imagePreview.style.display = 'none';
    imagePreview.src = '';
    currentImage = null;

    // Hide clear buttons
    document.getElementById('clearVideo').style.display = 'none';
    document.getElementById('clearImage').style.display = 'none';

    // Reset UI
    document.getElementById('videoStatus').textContent = 'No media source';
    document.getElementById('startWebcam').disabled = false;
    document.getElementById('stopWebcam').disabled = true;

    // Stop processing
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    isProcessing = false;
    currentMediaType = null;
}

// For backward compatibility
function stopVideo() {
    stopMedia();
}

function clearVideoFile() {
    const videoFileInput = document.getElementById('videoFile');

    // Stop and clear if video is loaded
    if (currentMediaType === 'video') {
        stopMedia();
        outputSvg.innerHTML = '';
    }

    // Reset the file input
    videoFileInput.value = '';

    // Hide the clear button
    document.getElementById('clearVideo').style.display = 'none';
}

function clearImageFile() {
    const imageFileInput = document.getElementById('imageFile');

    // Stop and clear if image is loaded
    if (currentMediaType === 'image') {
        stopMedia();
        outputSvg.innerHTML = '';
    }

    // Reset the file input
    imageFileInput.value = '';

    // Hide the clear button
    document.getElementById('clearImage').style.display = 'none';
}

function processStaticImage() {
    if (!currentImage) return;

    const cols = parseInt(document.getElementById('resolution').value);
    const shapeSize = parseInt(document.getElementById('shapeSize').value);
    const useColor = document.getElementById('colorMode').checked;
    const invertBrightness = document.getElementById('invertBrightness').checked;
    const shapeColorPicker = document.getElementById('shapeColor').value; // Cache DOM query

    // Set canvas size to match image
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;

    // Draw image to canvas
    ctx.drawImage(currentImage, 0, 0);

    // Calculate grid
    const cellWidth = canvas.width / cols;
    const cellHeight = cellWidth; // Keep cells square
    const rows = Math.floor(canvas.height / cellHeight);

    // Set SVG size
    const svgWidth = cols * shapeSize;
    const svgHeight = rows * shapeSize;
    outputSvg.setAttribute('width', svgWidth);
    outputSvg.setAttribute('height', svgHeight);
    outputSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

    // Clear SVG
    outputSvg.innerHTML = '';

    let shapeCount = 0;

    // Check if we have shapes to work with
    if (parsedShapes.length === 0) {
        outputSvg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="white" font-size="20">No shapes loaded! Upload SVG files or reset to defaults.</text>';
        document.getElementById('shapeCount').textContent = '0';
        return;
    }

    // Get ALL image data at once - MAJOR optimization
    const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const canvasWidth = canvas.width;

    // Use DocumentFragment for batch DOM updates
    const fragment = document.createDocumentFragment();
    const shapesLen = parsedShapes.length;

    // Process each cell with pre-fetched image data
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // Sample from center of cell
            const sampleX = Math.floor(col * cellWidth + cellWidth / 2);
            const sampleY = Math.floor(row * cellHeight + cellHeight / 2);
            const pixelIndex = (sampleY * canvasWidth + sampleX) * 4;

            const r = fullImageData[pixelIndex];
            const g = fullImageData[pixelIndex + 1];
            const b = fullImageData[pixelIndex + 2];

            // Calculate brightness (0-255)
            const brightness = (r + g + b) / 3;

            // Map brightness to shape index
            let shapeIndex = Math.floor((brightness / 255) * shapesLen);
            let clampedIndex = shapeIndex >= shapesLen ? shapesLen - 1 : shapeIndex;

            // Invert if checkbox is checked
            if (invertBrightness) {
                clampedIndex = shapesLen - 1 - clampedIndex;
            }

            // Determine color based on mode
            const color = useColor ? `rgb(${r},${g},${b})` : shapeColorPicker;

            // Use cached parsed shape
            const cachedShape = parsedShapes[clampedIndex];
            const vb = cachedShape.viewBox;
            const elements = cachedShape.elements;

            // Pre-calculate scale factors
            const scaleX = shapeSize / vb.width;
            const scaleY = shapeSize / vb.height;
            const translateX = col * shapeSize - (vb.x * scaleX);
            const translateY = row * shapeSize - (vb.y * scaleY);
            const transform = `translate(${translateX},${translateY}) scale(${scaleX},${scaleY})`;

            // Clone and transform each shape element
            const elemLen = elements.length;
            for (let i = 0; i < elemLen; i++) {
                const clonedElement = elements[i].cloneNode(true);
                clonedElement.setAttribute('transform', transform);

                // Simplified color application
                const fill = clonedElement.getAttribute('fill');
                if (!fill || fill === 'currentColor' || (fill !== 'none')) {
                    clonedElement.setAttribute('fill', color);
                }

                if (clonedElement.getAttribute('stroke') === 'currentColor') {
                    clonedElement.setAttribute('stroke', color);
                }

                fragment.appendChild(clonedElement);
                shapeCount++;
            }
        }
    }

    // Single DOM update
    outputSvg.appendChild(fragment);

    // Update stats
    document.getElementById('fps').textContent = '-';
    document.getElementById('shapeCount').textContent = shapeCount;
    document.getElementById('shapePalette').textContent = shapes.length;
}

function startProcessing() {
    if (isProcessing) return;
    isProcessing = true;
    processFrame();
}

function processFrame() {
    if (!isProcessing) return;

    const now = performance.now();
    const deltaTime = now - lastFrameTime;

    if (deltaTime >= 33) { // ~30 FPS cap
        lastFrameTime = now;
        fps = Math.round(1000 / deltaTime);

        const cols = parseInt(document.getElementById('resolution').value);
        const shapeSize = parseInt(document.getElementById('shapeSize').value);
        const useColor = document.getElementById('colorMode').checked;
        const invertBrightness = document.getElementById('invertBrightness').checked;
        const shapeColorPicker = document.getElementById('shapeColor').value; // Cache DOM query

        // Set canvas size to match video
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0);

        // Calculate grid
        const cellWidth = canvas.width / cols;
        const cellHeight = cellWidth; // Keep cells square
        const rows = Math.floor(canvas.height / cellHeight);

        // Set SVG size
        const svgWidth = cols * shapeSize;
        const svgHeight = rows * shapeSize;
        outputSvg.setAttribute('width', svgWidth);
        outputSvg.setAttribute('height', svgHeight);
        outputSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

        // Clear SVG
        outputSvg.innerHTML = '';

        let shapeCount = 0;

        // Check if we have shapes to work with
        if (parsedShapes.length === 0) {
            outputSvg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="white" font-size="20">No shapes loaded! Upload SVG files or reset to defaults.</text>';
            document.getElementById('fps').textContent = fps;
            document.getElementById('shapeCount').textContent = '0';
            animationFrame = requestAnimationFrame(processFrame);
            return;
        }

        // Get ALL image data at once - MAJOR optimization
        const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const canvasWidth = canvas.width;

        // Use DocumentFragment for batch DOM updates
        const fragment = document.createDocumentFragment();
        const shapesLen = parsedShapes.length;

        // Process each cell with pre-fetched image data
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Sample from center of cell
                const sampleX = Math.floor(col * cellWidth + cellWidth / 2);
                const sampleY = Math.floor(row * cellHeight + cellHeight / 2);
                const pixelIndex = (sampleY * canvasWidth + sampleX) * 4;

                const r = fullImageData[pixelIndex];
                const g = fullImageData[pixelIndex + 1];
                const b = fullImageData[pixelIndex + 2];

                // Calculate brightness (0-255)
                const brightness = (r + g + b) / 3;

                // Map brightness to shape index
                let shapeIndex = Math.floor((brightness / 255) * shapesLen);
                let clampedIndex = shapeIndex >= shapesLen ? shapesLen - 1 : shapeIndex;

                // Invert if checkbox is checked
                if (invertBrightness) {
                    clampedIndex = shapesLen - 1 - clampedIndex;
                }

                // Determine color based on mode
                const color = useColor ? `rgb(${r},${g},${b})` : shapeColorPicker;

                // Use cached parsed shape
                const cachedShape = parsedShapes[clampedIndex];
                const vb = cachedShape.viewBox;
                const elements = cachedShape.elements;

                // Pre-calculate scale factors
                const scaleX = shapeSize / vb.width;
                const scaleY = shapeSize / vb.height;
                const translateX = col * shapeSize - (vb.x * scaleX);
                const translateY = row * shapeSize - (vb.y * scaleY);
                const transform = `translate(${translateX},${translateY}) scale(${scaleX},${scaleY})`;

                // Clone and transform each shape element
                const elemLen = elements.length;
                for (let i = 0; i < elemLen; i++) {
                    const clonedElement = elements[i].cloneNode(true);
                    clonedElement.setAttribute('transform', transform);

                    // Simplified color application
                    const fill = clonedElement.getAttribute('fill');
                    if (!fill || fill === 'currentColor' || (fill !== 'none')) {
                        clonedElement.setAttribute('fill', color);
                    }

                    if (clonedElement.getAttribute('stroke') === 'currentColor') {
                        clonedElement.setAttribute('stroke', color);
                    }

                    fragment.appendChild(clonedElement);
                    shapeCount++;
                }
            }
        }

        // Single DOM update
        outputSvg.appendChild(fragment);

        // Update stats
        document.getElementById('fps').textContent = fps;
        document.getElementById('shapeCount').textContent = shapeCount;
        document.getElementById('shapePalette').textContent = shapes.length;
    }

    animationFrame = requestAnimationFrame(processFrame);
}
