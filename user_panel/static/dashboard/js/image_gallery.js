/**
 * Image Gallery and Lightbox Functionality
 * Merged with media_gallery.js functionality
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Image gallery script loaded');
    
    // Elements for image lightbox
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxClose = document.querySelector('.lightbox-close');
    const lightboxPrev = document.querySelector('.lightbox-prev');
    const lightboxNext = document.querySelector('.lightbox-next');
    const lightboxCounter = document.getElementById('lightbox-counter');
    
    // Elements for media lightbox
    const mediaLightbox = document.getElementById('media-lightbox');
    const mediaLightboxImage = mediaLightbox ? mediaLightbox.querySelector('.lightbox-image') : null;
    const mediaLightboxClose = mediaLightbox ? mediaLightbox.querySelector('.lightbox-close') : null;
    const mediaLightboxPrev = mediaLightbox ? mediaLightbox.querySelector('.lightbox-prev') : null;
    const mediaLightboxNext = mediaLightbox ? mediaLightbox.querySelector('.lightbox-next') : null;
    const mediaLightboxCounter = mediaLightbox ? mediaLightbox.querySelector('.lightbox-counter') : null;
    
    // Log elements to check if they're found
    console.log('Lightbox elements:', {
        lightbox,
        lightboxImage,
        lightboxClose,
        lightboxPrev,
        lightboxNext,
        lightboxCounter
    });
    
    // State variables for image lightbox
    let currentPostId = null;
    let currentImageIndex = 0;
    let postImages = [];
    let viewingStackedImages = false;
    let currentZoomLevel = 1;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let translateX = 0;
    let translateY = 0;
    let lastDragEndTime = 0;
    
    // State variables for media lightbox
    let currentMediaPostId = null;
    let currentMediaIndex = 0;
    let postMedia = [];
    let viewingStackedMedia = false;
    let currentMediaZoomLevel = 1;
    let isMediaDragging = false;
    let mediaStartX = 0;
    let mediaStartY = 0;
    let mediaTranslateX = 0;
    let mediaTranslateY = 0;
    let lastMediaDragEndTime = 0;
    
    // Initialize gallery click events
    initializeGallery();
    
    /**
     * Initialize gallery click events
     */
    function initializeGallery() {
        console.log('Initializing image and media galleries');
        
        // Find all image galleries
        const galleries = document.querySelectorAll('.post-images-gallery');
        console.log('Found galleries:', galleries.length);
        
        galleries.forEach(gallery => {
            const postId = gallery.dataset.postId;
            const imageContainers = gallery.querySelectorAll('.post-image-container');
            console.log(`Gallery ${postId}: found ${imageContainers.length} image containers`);
            
            // Add click event to each image container
            imageContainers.forEach((container, idx) => {
                console.log(`Adding click event to container ${idx} with data-index:`, container.dataset.index);
                
                // Make sure the container is clickable
                container.style.cursor = 'pointer';
                
                container.addEventListener('click', function(e) {
                    console.log('Image container clicked:', this.dataset.index);
                    const index = parseInt(this.dataset.index);
                    
                    // If media lightbox exists, use it, otherwise use image lightbox
                    if (mediaLightbox) {
                        openMediaLightbox(postId, index, e);
                    } else {
                        openLightbox(postId, index, e);
                    }
                    
                    e.stopPropagation(); // Prevent event bubbling
                });
            });
        });
    }
    
    /**
     * Open lightbox with specific post and image index
     * @param {string} postId - The ID of the post
     * @param {number} index - The index of the image to display
     * @param {Event} event - The click event that triggered this function
     */
    function openLightbox(postId, index, event) {
        console.log(`Opening lightbox for post ${postId} at index ${index}`);
        currentPostId = postId;
        currentImageIndex = index;
        
        // Check if we're viewing stacked images
        const gallery = document.querySelector(`.post-images-gallery[data-post-id="${postId}"]`);
        const stackedImageContainer = gallery.querySelector('.stacked-image-container');
        viewingStackedImages = stackedImageContainer && event && stackedImageContainer.contains(event.target);
        console.log('Viewing stacked images:', viewingStackedImages);
        
        // Get all images for this post
        fetchPostImages(postId).then(images => {
            console.log(`Fetched ${images.length} images for post ${postId}:`, images);
            postImages = images;
            updateLightboxImage();
            lightbox.classList.add('active');
            console.log('Lightbox activated');
        });
    }
    
    /**
     * Open media lightbox with specific post and image index
     * @param {string} postId - The ID of the post
     * @param {number} index - The index of the image to display
     * @param {Event} event - The click event that triggered this function
     */
    function openMediaLightbox(postId, index, event) {
        console.log(`Opening media lightbox for post ${postId} at index ${index}`);
        currentMediaPostId = postId;
        currentMediaIndex = index;
        
        // Check if we're viewing stacked media
        const gallery = document.querySelector(`.post-images-gallery[data-post-id="${postId}"]`);
        const stackedContainer = gallery.querySelector('.stacked');
        viewingStackedMedia = stackedContainer && event && stackedContainer.contains(event.target);
        console.log('Viewing stacked media:', viewingStackedMedia);
        
        // Get all images for this post
        fetchPostImages(postId).then((images) => {
            console.log(`Fetched ${images.length} images for post ${postId}`);
            
            // Set images as the media
            postMedia = [];
            
            // Add images
            images.forEach(image => {
                postMedia.push({
                    type: 'image',
                    url: image,
                    id: null
                });
            });
            
            console.log('Media array:', postMedia);
            
            // Find the image index in the media array
            const imageUrl = images[index];
            currentMediaIndex = postMedia.findIndex(media => media.url === imageUrl);
            
            console.log('Starting at media index:', currentMediaIndex);
            
            updateLightboxMedia();
            mediaLightbox.classList.add('active');
            console.log('Media lightbox activated');
        });
    }
    
    /**
 * Fetch all images for a post
 * For visible images, we collect them from the DOM
 * For stacked images (beyond the first 3-4), we need to fetch them from the server
 */
function fetchPostImages(postId) {
    console.log(`Fetching images for post ${postId}`);
    return new Promise((resolve) => {
        const gallery = document.querySelector(`.post-images-gallery[data-post-id="${postId}"]`);
        console.log('Found gallery:', gallery);
        const images = [];
        
        if (gallery) {
            // First, collect visible images from the DOM
            const imageElements = gallery.querySelectorAll('.post-image');
            console.log(`Found ${imageElements.length} visible image elements in gallery`);
            imageElements.forEach(img => {
                // Only add images that have a valid src attribute
                if (img.src && img.src.trim() !== '') {
                    console.log('Adding image src:', img.src);
                    images.push(img.src);
                }
            });
            
            // Check if we have a stacked container (indicating more images)
            const hasStacked = gallery.querySelector('.stacked') !== null;
            console.log('Has stacked images:', hasStacked);
            
            // If we have stacked images, fetch all images for this post from the server
            if (hasStacked) {
                console.log('Fetching all images for post from server');
                fetch(`/user/api/post/${postId}/images/`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log('Received image data from server:', data);
                        if (data.images && data.images.length > 0) {
                            // Replace our DOM-collected images with the complete set from the server
                            const serverImages = data.images.map(img => img.url);
                            console.log('Server provided images:', serverImages);
                            // Make sure we have unique image URLs
                            const uniqueImages = [...new Set(serverImages)];
                            console.log('Unique server images:', uniqueImages);
                            resolve(uniqueImages);
                        } else {
                            // If server doesn't return images, use what we collected from DOM
                            console.log('No images from server, using DOM-collected images');
                            resolve(images);
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching images from server:', error);
                        // Fall back to DOM-collected images
                        resolve(images);
                    });
            } else {
                // No stacked images, just use what we collected from DOM
                resolve(images);
            }
        } else {
            console.error(`Gallery not found for post ${postId}`);
            resolve(images);
        }
    });
}
    
    /**
     * Update the lightbox image and counter
     */
    function updateLightboxImage() {
        console.log('Updating lightbox image, images array length:', postImages.length);
        if (postImages.length > 0) {
            console.log(`Setting image source to index ${currentImageIndex}:`, postImages[currentImageIndex]);
            lightboxImage.src = postImages[currentImageIndex];
            lightboxCounter.textContent = `${currentImageIndex + 1} / ${postImages.length}`;
            console.log('Counter updated to:', lightboxCounter.textContent);
            
            // Reset zoom and position when changing images
            resetZoom();
        } else {
            console.error('No images available to display');
        }
    }
    
    /**
     * Reset zoom level and position
     */
    function resetZoom() {
        currentZoomLevel = 1;
        translateX = 0;
        translateY = 0;
        applyTransform();
    }
    
    /**
     * Apply transform to the lightbox image
     */
    function applyTransform() {
        lightboxImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoomLevel})`;
    }
    
    /**
     * Update the media lightbox content based on the current media
     */
    function updateLightboxMedia() {
        console.log('Updating lightbox media, array length:', postMedia.length);
        if (postMedia.length > 0 && currentMediaIndex >= 0 && currentMediaIndex < postMedia.length) {
            const media = postMedia[currentMediaIndex];
            console.log(`Setting media source to index ${currentMediaIndex}:`, media);
            
            // Show image
            mediaLightboxImage.src = media.url;
            mediaLightboxImage.style.display = 'block';
            
            mediaLightboxCounter.textContent = `${currentMediaIndex + 1} / ${postMedia.length}`;
            console.log('Counter updated to:', mediaLightboxCounter.textContent);
            
            // Reset zoom and position when changing media
            resetMediaZoom();
        } else {
            console.error('No media available to display');
        }
    }
    
    /**
     * Reset media zoom level and position
     */
    function resetMediaZoom() {
        currentMediaZoomLevel = 1;
        mediaTranslateX = 0;
        mediaTranslateY = 0;
        applyMediaTransform();
    }
    
    /**
     * Apply transform to the media lightbox image
     */
    function applyMediaTransform() {
        mediaLightboxImage.style.transform = `translate(${mediaTranslateX}px, ${mediaTranslateY}px) scale(${currentMediaZoomLevel})`;
    }
    
    /**
     * Close the lightbox
     */
    function closeLightbox() {
        lightbox.classList.remove('active');
    }
    
    /**
     * Close the media lightbox
     */
    function closeMediaLightbox() {
        mediaLightbox.classList.remove('active');
    }
    
    /**
     * Navigate to the previous image
     */
    function prevImage() {
        console.log('Previous image clicked, current index:', currentImageIndex);
        if (currentImageIndex > 0) {
            currentImageIndex--;
        } else {
            // If we're at the first image, loop to the last image
            currentImageIndex = postImages.length - 1;
        }
        updateLightboxImage();
    }
    
    /**
     * Navigate to the previous media
     */
    function prevMedia() {
        console.log('Previous media clicked, current index:', currentMediaIndex);
        if (currentMediaIndex > 0) {
            currentMediaIndex--;
        } else {
            // If we're at the first media, loop to the last media
            currentMediaIndex = postMedia.length - 1;
        }
        updateLightboxMedia();
    }
    
    /**
     * Navigate to the next image
     */
    function nextImage() {
        console.log('Next image clicked, current index:', currentImageIndex);
        if (currentImageIndex < postImages.length - 1) {
            currentImageIndex++;
        } else {
            // If we're at the last image, loop back to the first image
            currentImageIndex = 0;
        }
        updateLightboxImage();
    }
    
    /**
     * Navigate to the next media
     */
    function nextMedia() {
        console.log('Next media clicked, current index:', currentMediaIndex);
        if (currentMediaIndex < postMedia.length - 1) {
            currentMediaIndex++;
        } else {
            // If we're at the last media, loop back to the first media
            currentMediaIndex = 0;
        }
        updateLightboxMedia();
    }
    
    // Event listeners for image lightbox
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', prevImage);
    lightboxNext.addEventListener('click', nextImage);
    
    // Add zoom-in functionality for image lightbox with left mouse click
    lightboxImage.addEventListener('click', function(e) {
        // Prevent click from propagating to lightbox (which would close it)
        e.stopPropagation();
        
        // Don't process click events if we're currently dragging
        // But allow clicks after a short delay from when dragging ended
        if (isDragging) {
            return;
        }
        
        // Only handle zoom-in with left click
        if (currentZoomLevel === 1) {
            // If at normal view, zoom in
            currentZoomLevel = 2.5;
            // Change cursor to zoom-out
            lightboxImage.style.cursor = 'zoom-out';
            
            // Calculate zoom center based on mouse position
            const rect = lightboxImage.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Calculate the center offset to position the zoom at the clicked point
            const imageCenterX = rect.width / 2;
            const imageCenterY = rect.height / 2;
            translateX = (imageCenterX - mouseX) * (currentZoomLevel - 1) / currentZoomLevel;
            translateY = (imageCenterY - mouseY) * (currentZoomLevel - 1) / currentZoomLevel;
            
            // Apply the transform
            applyTransform();
        }
    });
    
    // Set initial cursor to zoom-in
    lightboxImage.style.cursor = 'zoom-in';
    
    // Add drag functionality for image lightbox
    // We'll use left mouse button for dragging when zoomed in
    lightboxImage.addEventListener('mousedown', function(e) {
        // Only enable dragging with left mouse button (button 0) when zoomed in
        if (e.button === 0 && currentZoomLevel > 1) {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            lightboxImage.style.cursor = 'grabbing';
        }
    });
    
    // Update cursor on mouseover based on zoom level
    lightboxImage.addEventListener('mouseover', function() {
        if (currentZoomLevel > 1) {
            lightboxImage.style.cursor = 'zoom-out';
        } else {
            lightboxImage.style.cursor = 'zoom-in';
        }
    });
    
    // Add zoom-out functionality with right-click (contextmenu event)
    lightboxImage.addEventListener('contextmenu', function(e) {
        // Always prevent the default context menu
        e.preventDefault();
        
        // Don't process right-click events if we're currently dragging
        if (isDragging) {
            return;
        }
        
        // Only handle zoom-out with right-click when zoomed in
        if (currentZoomLevel > 1) {
            // Zoom out to normal
            currentZoomLevel = 1;
            // Reset position when zooming out
            translateX = 0;
            translateY = 0;
            // Change cursor to zoom-in
            lightboxImage.style.cursor = 'zoom-in';
            // Apply the transform
            applyTransform();
        }
    });
    
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            applyTransform();
        }
    });
    
    document.addEventListener('mouseup', function(e) {
        // Only stop dragging if it was in progress
        if (isDragging) {
            isDragging = false;
            // Record the time when dragging ended
            lastDragEndTime = Date.now();
            // Set cursor based on zoom level
            if (currentZoomLevel > 1) {
                lightboxImage.style.cursor = 'zoom-out';
            } else {
                lightboxImage.style.cursor = 'zoom-in';
            }
            // Prevent any click events from firing after drag ends
            e.stopPropagation();
            e.preventDefault();
        }
    });
    
    // Event listeners for media lightbox
    if (mediaLightbox) {
        mediaLightboxClose.addEventListener('click', closeMediaLightbox);
        mediaLightboxPrev.addEventListener('click', prevMedia);
        mediaLightboxNext.addEventListener('click', nextMedia);
        
        // Add zoom-in functionality for media lightbox with left mouse click
         mediaLightboxImage.addEventListener('click', function(e) {
             // Prevent click from propagating to lightbox (which would close it)
             e.stopPropagation();
             
             // Don't process click events if we're currently dragging
             // But allow clicks after a short delay from when dragging ended
             if (isMediaDragging) {
                 return;
             }
             
             // Only handle zoom-in with left click
             if (currentMediaZoomLevel === 1) {
                 // If at normal view, zoom in
                 currentMediaZoomLevel = 2.5;
                 // Change cursor to zoom-out
                 mediaLightboxImage.style.cursor = 'zoom-out';
                 
                 // Calculate zoom center based on mouse position
                 const rect = mediaLightboxImage.getBoundingClientRect();
                 const mouseX = e.clientX - rect.left;
                 const mouseY = e.clientY - rect.top;
                 
                 // Calculate the center offset to position the zoom at the clicked point
                 const imageCenterX = rect.width / 2;
                 const imageCenterY = rect.height / 2;
                 mediaTranslateX = (imageCenterX - mouseX) * (currentMediaZoomLevel - 1) / currentMediaZoomLevel;
                 mediaTranslateY = (imageCenterY - mouseY) * (currentMediaZoomLevel - 1) / currentMediaZoomLevel;
                 
                 // Apply the transform
                 applyMediaTransform();
             }
         });
         
         // Set initial cursor to zoom-in
         mediaLightboxImage.style.cursor = 'zoom-in';
        
        // Add drag functionality for media lightbox
    // We'll use left mouse button for dragging when zoomed in
    mediaLightboxImage.addEventListener('mousedown', function(e) {
        // Only enable dragging with left mouse button (button 0) when zoomed in
        if (e.button === 0 && currentMediaZoomLevel > 1) {
            e.preventDefault();
            isMediaDragging = true;
            mediaStartX = e.clientX - mediaTranslateX;
            mediaStartY = e.clientY - mediaTranslateY;
            mediaLightboxImage.style.cursor = 'grabbing';
        }
    });
    
    // Update cursor on mouseover based on zoom level
    mediaLightboxImage.addEventListener('mouseover', function() {
        if (currentMediaZoomLevel > 1) {
            mediaLightboxImage.style.cursor = 'zoom-out';
        } else {
            mediaLightboxImage.style.cursor = 'zoom-in';
        }
    });
    
    // Add zoom-out functionality with right-click (contextmenu event)
    mediaLightboxImage.addEventListener('contextmenu', function(e) {
        // Always prevent the default context menu
        e.preventDefault();
        
        // Don't process right-click events if we're currently dragging
        if (isMediaDragging) {
            return;
        }
        
        // Only handle zoom-out with right-click when zoomed in
        if (currentMediaZoomLevel > 1) {
            // Zoom out to normal
            currentMediaZoomLevel = 1;
            // Reset position when zooming out
            mediaTranslateX = 0;
            mediaTranslateY = 0;
            // Change cursor to zoom-in
            mediaLightboxImage.style.cursor = 'zoom-in';
            // Apply the transform
            applyMediaTransform();
        }
    });
         
         document.addEventListener('mousemove', function(e) {
             if (isMediaDragging) {
                 mediaTranslateX = e.clientX - mediaStartX;
                 mediaTranslateY = e.clientY - mediaStartY;
                 applyMediaTransform();
             }
         });
         
         document.addEventListener('mouseup', function(e) {
             // Only stop dragging if it was in progress
             if (isMediaDragging) {
                 isMediaDragging = false;
                 // Record the time when dragging ended
                 lastMediaDragEndTime = Date.now();
                 // Set cursor based on zoom level
                 if (currentMediaZoomLevel > 1) {
                     mediaLightboxImage.style.cursor = 'zoom-out';
                 } else {
                     mediaLightboxImage.style.cursor = 'zoom-in';
                 }
                 // Prevent any click events from firing after drag ends
                 e.stopPropagation();
                 e.preventDefault();
             }
         });
        
        // Close media lightbox when clicking outside the content
        mediaLightbox.addEventListener('click', function(e) {
            if (e.target === mediaLightbox) {
                closeMediaLightbox();
            }
        });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        // Handle image lightbox keyboard navigation
        if (lightbox.classList.contains('active')) {
            if (e.key === 'Escape') {
                closeLightbox();
            } else if (e.key === 'ArrowLeft') {
                prevImage();
            } else if (e.key === 'ArrowRight') {
                nextImage();
            }
        }
        
        // Handle media lightbox keyboard navigation
        if (mediaLightbox && mediaLightbox.classList.contains('active')) {
            if (e.key === 'Escape') {
                closeMediaLightbox();
            } else if (e.key === 'ArrowLeft') {
                prevMedia();
            } else if (e.key === 'ArrowRight') {
                nextMedia();
            }
        }
    });
    
    // Close lightbox when clicking outside the image
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
});