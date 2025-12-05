// Default SVG shape palette (from darkest to lightest)
const defaultShapes = [
    // Darkest - filled circle
    '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4.5" fill="currentColor"/></svg>',
    // Very dark - filled square
    '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="8" height="8" fill="currentColor"/></svg>',
    // Dark - filled triangle
    '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><polygon points="5,1 9,9 1,9" fill="currentColor"/></svg>',
    // Medium-dark - star
    '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M5 1 L6 4 L9 4 L7 6 L8 9 L5 7 L2 9 L3 6 L1 4 L4 4 Z" fill="currentColor"/></svg>',
    // Medium - cross
    '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M5 0 L5 10 M0 5 L10 5" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
    // Medium-light - circle outline
    '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
    // Light - small square
    '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="4" height="4" fill="currentColor"/></svg>',
    // Very light - small dot
    '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="2" fill="currentColor"/></svg>',
    // Lightest - tiny dot
    '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="1" fill="currentColor"/></svg>',
];

let shapes = [...defaultShapes];
let video, imagePreview, outputSvg, canvas, ctx;
let animationFrame;
let isProcessing = false;
let lastFrameTime = 0;
let fps = 0;
let currentMediaType = null; // 'video', 'webcam', or 'image'
let currentImage = null; // Store the loaded image

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    video = document.getElementById('video');
    imagePreview = document.getElementById('imagePreview');
    outputSvg = document.getElementById('outputSvg');
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadTextFrequently: true });

    renderShapeList();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('startWebcam').addEventListener('click', startWebcam);
    document.getElementById('stopWebcam').addEventListener('click', stopVideo);
    document.getElementById('videoFile').addEventListener('change', handleVideoFile);
    document.getElementById('imageFile').addEventListener('change', handleImageFile);
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

    renderShapeList();
    e.target.value = ''; // Reset file input
}

function resetShapes() {
    shapes = [...defaultShapes];
    renderShapeList();
}

function clearShapes() {
    if (confirm('Are you sure you want to clear all shapes?')) {
        shapes = [];
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

function processStaticImage() {
    if (!currentImage) return;

    const cols = parseInt(document.getElementById('resolution').value);
    const shapeSize = parseInt(document.getElementById('shapeSize').value);
    const useColor = document.getElementById('colorMode').checked;

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
    outputSvg.setAttribute('width', cols * shapeSize);
    outputSvg.setAttribute('height', rows * shapeSize);
    outputSvg.setAttribute('viewBox', `0 0 ${cols * shapeSize} ${rows * shapeSize}`);

    // Clear SVG
    outputSvg.innerHTML = '';

    let shapeCount = 0;

    // Check if we have shapes to work with
    if (shapes.length === 0) {
        outputSvg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="white" font-size="20">No shapes loaded! Upload SVG files or reset to defaults.</text>';
        document.getElementById('shapeCount').textContent = '0';
        return;
    }

    // Process each cell
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * cellWidth;
            const y = row * cellHeight;

            // Sample pixel data from center of cell
            const sampleX = Math.floor(x + cellWidth / 2);
            const sampleY = Math.floor(y + cellHeight / 2);

            const imageData = ctx.getImageData(sampleX, sampleY, 1, 1);
            const [r, g, b] = imageData.data;

            // Calculate brightness (0-255)
            const brightness = (r + g + b) / 3;

            // Map brightness to shape index
            const shapeIndex = Math.floor((brightness / 255) * shapes.length);
            const clampedIndex = Math.min(shapeIndex, shapes.length - 1);

            // Determine color based on mode
            const color = useColor ? `rgb(${r}, ${g}, ${b})` : 'rgb(255, 255, 255)';

            // Parse the shape SVG string to extract shape elements
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = shapes[clampedIndex];
            const shapeSvg = tempDiv.querySelector('svg');

            if (shapeSvg) {
                // Get viewBox for scaling calculation
                const viewBox = shapeSvg.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 10, 10];
                const [vbX, vbY, vbWidth, vbHeight] = viewBox;

                // Calculate scale factors
                const scaleX = shapeSize / vbWidth;
                const scaleY = shapeSize / vbHeight;

                // Get all shape elements from the SVG (excluding defs, title, desc)
                const shapeElements = Array.from(shapeSvg.children).filter(child => {
                    const tagName = child.tagName.toLowerCase();
                    return !['defs', 'title', 'desc', 'metadata'].includes(tagName);
                });

                // Clone and transform each shape element
                shapeElements.forEach(element => {
                    const clonedElement = element.cloneNode(true);

                    // Build transform: translate to position, then scale from viewBox
                    const translateX = col * shapeSize - (vbX * scaleX);
                    const translateY = row * shapeSize - (vbY * scaleY);
                    const transform = `translate(${translateX}, ${translateY}) scale(${scaleX}, ${scaleY})`;

                    clonedElement.setAttribute('transform', transform);

                    // Apply color to fill and stroke
                    if (clonedElement.hasAttribute('fill') && clonedElement.getAttribute('fill') !== 'none') {
                        clonedElement.setAttribute('fill', color);
                    } else if (clonedElement.getAttribute('fill') === 'currentColor') {
                        clonedElement.setAttribute('fill', color);
                    } else if (!clonedElement.hasAttribute('fill')) {
                        clonedElement.setAttribute('fill', color);
                    }

                    if (clonedElement.hasAttribute('stroke') && clonedElement.getAttribute('stroke') === 'currentColor') {
                        clonedElement.setAttribute('stroke', color);
                    }

                    // Add directly to output SVG (no group wrapper!)
                    outputSvg.appendChild(clonedElement);
                    shapeCount++;
                });
            }
        }
    }

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
        outputSvg.setAttribute('width', cols * shapeSize);
        outputSvg.setAttribute('height', rows * shapeSize);
        outputSvg.setAttribute('viewBox', `0 0 ${cols * shapeSize} ${rows * shapeSize}`);

        // Clear SVG
        outputSvg.innerHTML = '';

        let shapeCount = 0;

        // Check if we have shapes to work with
        if (shapes.length === 0) {
            outputSvg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="white" font-size="20">No shapes loaded! Upload SVG files or reset to defaults.</text>';
            document.getElementById('fps').textContent = fps;
            document.getElementById('shapeCount').textContent = '0';
            animationFrame = requestAnimationFrame(processFrame);
            return;
        }

        // Process each cell
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * cellWidth;
                const y = row * cellHeight;

                // Sample pixel data from center of cell
                const sampleX = Math.floor(x + cellWidth / 2);
                const sampleY = Math.floor(y + cellHeight / 2);

                const imageData = ctx.getImageData(sampleX, sampleY, 1, 1);
                const [r, g, b] = imageData.data;

                // Calculate brightness (0-255)
                const brightness = (r + g + b) / 3;

                // Map brightness to shape index
                const shapeIndex = Math.floor((brightness / 255) * shapes.length);
                const clampedIndex = Math.min(shapeIndex, shapes.length - 1);

                // Determine color based on mode
                const color = useColor ? `rgb(${r}, ${g}, ${b})` : 'rgb(255, 255, 255)';

                // Parse the shape SVG string to extract shape elements
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = shapes[clampedIndex];
                const shapeSvg = tempDiv.querySelector('svg');

                if (shapeSvg) {
                    // Get viewBox for scaling calculation
                    const viewBox = shapeSvg.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 10, 10];
                    const [vbX, vbY, vbWidth, vbHeight] = viewBox;

                    // Calculate scale factors
                    const scaleX = shapeSize / vbWidth;
                    const scaleY = shapeSize / vbHeight;

                    // Get all shape elements from the SVG (excluding defs, title, desc)
                    const shapeElements = Array.from(shapeSvg.children).filter(child => {
                        const tagName = child.tagName.toLowerCase();
                        return !['defs', 'title', 'desc', 'metadata'].includes(tagName);
                    });

                    // Clone and transform each shape element
                    shapeElements.forEach(element => {
                        const clonedElement = element.cloneNode(true);

                        // Build transform: translate to position, then scale from viewBox
                        const translateX = col * shapeSize - (vbX * scaleX);
                        const translateY = row * shapeSize - (vbY * scaleY);
                        const transform = `translate(${translateX}, ${translateY}) scale(${scaleX}, ${scaleY})`;

                        clonedElement.setAttribute('transform', transform);

                        // Apply color to fill and stroke
                        if (clonedElement.hasAttribute('fill') && clonedElement.getAttribute('fill') !== 'none') {
                            clonedElement.setAttribute('fill', color);
                        } else if (clonedElement.getAttribute('fill') === 'currentColor') {
                            clonedElement.setAttribute('fill', color);
                        } else if (!clonedElement.hasAttribute('fill')) {
                            clonedElement.setAttribute('fill', color);
                        }

                        if (clonedElement.hasAttribute('stroke') && clonedElement.getAttribute('stroke') === 'currentColor') {
                            clonedElement.setAttribute('stroke', color);
                        }

                        // Add directly to output SVG (no group wrapper!)
                        outputSvg.appendChild(clonedElement);
                        shapeCount++;
                    });
                }
            }
        }

        // Update stats
        document.getElementById('fps').textContent = fps;
        document.getElementById('shapeCount').textContent = shapeCount;
        document.getElementById('shapePalette').textContent = shapes.length;
    }

    animationFrame = requestAnimationFrame(processFrame);
}
