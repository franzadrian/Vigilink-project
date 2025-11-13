document.addEventListener('DOMContentLoaded', function() {
    // Initialize video controls
    initializeVideoControls();
    
    // Initialize image modal functionality
    initializeImageModal();
    
    // Parse and display multiple URLs
    parseMultipleUrls();
    
    // Also run it after a short delay to ensure DOM is ready
    setTimeout(parseMultipleUrls, 100);
    
    // AJAX Search and Filter functionality
    const searchInputEl = document.getElementById('search-input');
    const filterButtonsEl = document.querySelectorAll('.filter-btn[data-filter-type]');
    
    let currentFilters = {
        search: searchInputEl ? searchInputEl.value.trim() : '',
        type: Array.from(filterButtonsEl).find(b => b.classList.contains('active'))?.getAttribute('data-filter-type') || 'all',
        page: 1
    };
    
    // Search input handler
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const filterButtons = document.querySelectorAll('.filter-btn[data-filter-type]');
    
    function updateResources() {
        const params = new URLSearchParams();
        if (currentFilters.search) params.set('search', currentFilters.search);
        if (currentFilters.type && currentFilters.type !== 'all') params.set('type', currentFilters.type);
        if (currentFilters.page > 1) params.set('page', currentFilters.page);
        
        // Show loading state
        const resourcesContainer = document.getElementById('resources-container');
        if (resourcesContainer) {
            resourcesContainer.style.opacity = '0.5';
            resourcesContainer.style.pointerEvents = 'none';
        }
        
        // Fetch filtered resources
        fetch(`/resources/?${params.toString()}`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            }
        })
        .then(response => response.text())
        .then(html => {
            // Parse the HTML response
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Extract resources container
            const newContainer = doc.querySelector('#resources-container');
            const newCountData = doc.querySelector('#resources-count-data');
            
            // Update resources container
            const container = document.getElementById('resources-container');
            if (container && newContainer) {
                container.innerHTML = newContainer.innerHTML;
            }
            
            // Update count
            if (newCountData) {
                const countElement = document.getElementById('resources-count');
                if (countElement) {
                    countElement.textContent = newCountData.textContent;
                }
            }
            
            // Update clear search button visibility
            const clearSearchBtnEl = document.getElementById('clear-search-btn');
            if (currentFilters.search && !clearSearchBtnEl) {
                // Add clear button if search has value
                const searchForm = document.querySelector('.search-form');
                if (searchForm) {
                    const clearBtn = document.createElement('button');
                    clearBtn.type = 'button';
                    clearBtn.id = 'clear-search-btn';
                    clearBtn.className = 'clear-search';
                    clearBtn.title = 'Clear search';
                    clearBtn.innerHTML = '<i class="fas fa-times"></i>';
                    clearBtn.addEventListener('click', function() {
                        searchInput.value = '';
                        currentFilters.search = '';
                        currentFilters.page = 1;
                        updateResources();
                    });
                    searchForm.appendChild(clearBtn);
                }
            } else if (!currentFilters.search && clearSearchBtnEl) {
                // Remove clear button if no search
                clearSearchBtnEl.remove();
            }
            
            // Update URL without page reload
            const newUrl = `/resources/${params.toString() ? '?' + params.toString() : ''}`;
            window.history.pushState({}, '', newUrl);
            
            // Reinitialize video controls and image modals for new content
            if (typeof initializeVideoControls === 'function') {
                initializeVideoControls();
            }
            if (typeof initializeImageModal === 'function') {
                initializeImageModal();
            }
            if (typeof parseMultipleUrls === 'function') {
                parseMultipleUrls();
            }
            
            // Reattach pagination listeners
            attachPaginationListeners();
            
            // Restore opacity
            if (resourcesContainer) {
                resourcesContainer.style.opacity = '1';
                resourcesContainer.style.pointerEvents = 'auto';
            }
        })
        .catch(error => {
            console.error('Error loading resources:', error);
            if (resourcesContainer) {
                resourcesContainer.style.opacity = '1';
                resourcesContainer.style.pointerEvents = 'auto';
            }
        });
    }
    
    function attachPaginationListeners() {
        const paginationLinks = document.querySelectorAll('#pagination-container .page-btn[data-page]');
        paginationLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const page = this.getAttribute('data-page');
                if (page) {
                    currentFilters.page = parseInt(page);
                    updateResources();
                }
            });
        });
    }
    
    // Search button click
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            currentFilters.search = searchInput.value.trim();
            currentFilters.page = 1; // Reset to first page on new search
            updateResources();
        });
    }
    
    // Search on Enter key
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                currentFilters.search = searchInput.value.trim();
                currentFilters.page = 1;
                updateResources();
            }
        });
    }
    
    // Clear search button
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            searchInput.value = '';
            currentFilters.search = '';
            currentFilters.page = 1;
            updateResources();
        });
    }
    
    // Filter buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            // Update filter
            currentFilters.type = this.getAttribute('data-filter-type');
            currentFilters.page = 1; // Reset to first page on filter change
            updateResources();
        });
    });
    
    // Initialize pagination listeners
    attachPaginationListeners();
});

// Custom Video Player Initialization
function initializeVideoControls() {
    const videoPlayers = document.querySelectorAll('.custom-video-player');
    
    videoPlayers.forEach(player => {
        const video = player.querySelector('.video-element');
        const playPauseBtn = player.querySelector('.play-pause-btn');
        const timelineTrack = player.querySelector('.timeline-track');
        const timelineProgress = player.querySelector('.timeline-progress');
        const timelineThumb = player.querySelector('.timeline-thumb');
        const currentTimeSpan = player.querySelector('.current-time');
        const totalTimeSpan = player.querySelector('.total-time');
        const muteBtn = player.querySelector('.mute-btn');
        const volumeSlider = player.querySelector('.volume-slider');
        const volumeProgress = player.querySelector('.volume-progress');
        const volumeThumb = player.querySelector('.volume-thumb');
        const fullscreenBtn = player.querySelector('.fullscreen-btn');
        
        let isDragging = false;
        let isVolumeDragging = false;
        
        // Play/Pause functionality
        playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (video.paused) {
                video.play();
                player.classList.add('playing');
            } else {
                video.pause();
                player.classList.remove('playing');
            }
        });
        
        // Video click to play/pause
        video.addEventListener('click', (e) => {
            if (e.target.closest('.video-timeline') || e.target.closest('.timeline-track')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            if (video.paused) {
                video.play();
                player.classList.add('playing');
            } else {
                video.pause();
                player.classList.remove('playing');
            }
        });
        
        player.addEventListener('click', (e) => {
            if (!e.target.closest('.video-controls') && 
                !e.target.closest('.video-timeline') && 
                !e.target.closest('.timeline-track')) {
                e.preventDefault();
                e.stopPropagation();
                if (video.paused) {
                    video.play();
                    player.classList.add('playing');
                } else {
                    video.pause();
                    player.classList.remove('playing');
                }
            }
        });
        
        // Timeline functionality
        function updateTimeline() {
            if (video.duration) {
                const progress = (video.currentTime / video.duration) * 100;
                timelineProgress.style.width = progress + '%';
                timelineThumb.style.left = progress + '%';
            }
        }
        
        function updateTime() {
            const current = formatTime(video.currentTime);
            const total = formatTime(video.duration);
            currentTimeSpan.textContent = current;
            totalTimeSpan.textContent = total;
        }
        
        function formatTime(seconds) {
            if (isNaN(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        
        function handleVideoPlay() {
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            player.classList.add('playing');
        }
        
        function handleVideoPause() {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            player.classList.remove('playing');
        }
        
        video.addEventListener('play', handleVideoPlay);
        video.addEventListener('pause', handleVideoPause);
        
        // Timeline seek functionality
        let pendingSeekPosition = null;
        
        function seekToPosition(clickX) {
            if (!video.duration || isNaN(video.duration)) {
                // Store the click position and wait for video to load metadata
                video.addEventListener('loadedmetadata', function seekOnce() {
                    video.removeEventListener('loadedmetadata', seekOnce);
                    if (pendingSeekPosition !== null) {
                        performSeek(pendingSeekPosition);
                        pendingSeekPosition = null;
                    }
                }, { once: true });
                return;
            }
            performSeek(clickX);
        }
        
        function performSeek(clickX) {
            const rect = timelineTrack.getBoundingClientRect();
            const clickPercent = Math.max(0, Math.min(1, (clickX - rect.left) / rect.width));
            const newTime = clickPercent * video.duration;
            const wasPlaying = !video.paused;
            
            // Check if video is seekable
            if (video.seekable && video.seekable.length > 0) {
                // Clamp to seekable range
                const seekableStart = video.seekable.start(0);
                const seekableEnd = video.seekable.end(video.seekable.length - 1);
                const clampedTime = Math.max(seekableStart, Math.min(seekableEnd, newTime));
                
                // Seek to the new position
                video.currentTime = clampedTime;
            } else {
                // Fallback: just set currentTime
                video.currentTime = newTime;
            }
            
            // If video was playing, continue playing after seek
            if (wasPlaying) {
                // Use a small delay to ensure seek completes
                setTimeout(() => {
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(() => {
                            // Ignore play errors (e.g., user interaction required)
                        });
                    }
                }, 50);
            }
        }
        
        // Click on timeline to seek
        timelineTrack.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            pendingSeekPosition = e.clientX;
            seekToPosition(e.clientX);
        });
        
        // Drag functionality
        let mouseDownTime = 0;
        let hasMoved = false;
        
        timelineTrack.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mouseDownTime = Date.now();
            hasMoved = false;
            isDragging = true;
            document.addEventListener('mousemove', handleTimelineDrag);
            document.addEventListener('mouseup', stopTimelineDrag);
        });
        
        timelineThumb.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mouseDownTime = Date.now();
            hasMoved = false;
            isDragging = true;
            document.addEventListener('mousemove', handleTimelineDrag);
            document.addEventListener('mouseup', stopTimelineDrag);
        });
        
        function handleTimelineDrag(e) {
            if (!isDragging) return;
            e.preventDefault();
            e.stopPropagation();
            hasMoved = true;
            
            if (video.duration && !isNaN(video.duration)) {
                const rect = timelineTrack.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
                const newTime = clickPercent * video.duration;
                
                // Check if video is seekable
                if (video.seekable && video.seekable.length > 0) {
                    const seekableStart = video.seekable.start(0);
                    const seekableEnd = video.seekable.end(video.seekable.length - 1);
                    const clampedTime = Math.max(seekableStart, Math.min(seekableEnd, newTime));
                    video.currentTime = clampedTime;
                } else {
                    video.currentTime = newTime;
                }
            }
        }
        
        function stopTimelineDrag(e) {
            isDragging = false;
            document.removeEventListener('mousemove', handleTimelineDrag);
            document.removeEventListener('mouseup', stopTimelineDrag);
            
            // If it was a quick click (not a drag), perform seek
            if (!hasMoved && (Date.now() - mouseDownTime) < 200) {
                pendingSeekPosition = e.clientX;
                seekToPosition(e.clientX);
            }
        }
        
        // Volume functionality
        function updateVolume() {
            const volume = video.volume;
            volumeProgress.style.width = (volume * 100) + '%';
            volumeThumb.style.right = ((1 - volume) * 100) + '%';
            
            if (video.muted || volume === 0) {
                muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            } else if (volume < 0.5) {
                muteBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
            } else {
                muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            }
        }
        
        muteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            video.muted = !video.muted;
            updateVolume();
        });
        
        volumeSlider.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = volumeSlider.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
            video.volume = clickPercent;
            video.muted = false;
            updateVolume();
        });
        
        volumeThumb.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isVolumeDragging = true;
            document.addEventListener('mousemove', handleVolumeDrag);
            document.addEventListener('mouseup', stopVolumeDrag);
        });
        
        function handleVolumeDrag(e) {
            if (!isVolumeDragging) return;
            const rect = volumeSlider.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
            video.volume = clickPercent;
            video.muted = false;
            updateVolume();
        }
        
        function stopVolumeDrag() {
            isVolumeDragging = false;
            document.removeEventListener('mousemove', handleVolumeDrag);
            document.removeEventListener('mouseup', stopVolumeDrag);
        }
        
        // Fullscreen functionality
        fullscreenBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFullscreen();
        });
        
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                if (player.requestFullscreen) {
                    player.requestFullscreen();
                } else if (player.webkitRequestFullscreen) {
                    player.webkitRequestFullscreen();
                } else if (player.msRequestFullscreen) {
                    player.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        }
        
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);
        
        function handleFullscreenChange() {
            if (document.fullscreenElement === player || 
                document.webkitFullscreenElement === player || 
                document.msFullscreenElement === player) {
                player.classList.add('fullscreen');
                player.classList.add('playing');
            } else {
                player.classList.remove('fullscreen');
            }
        }
        
        // Event listeners
        video.addEventListener('timeupdate', () => {
            updateTimeline();
            updateTime();
        });
        
        video.addEventListener('loadedmetadata', () => {
            updateTime();
            updateVolume();
            // If there's a pending seek, perform it now
            if (pendingSeekPosition !== null) {
                performSeek(pendingSeekPosition);
                pendingSeekPosition = null;
            }
        });
        
        video.addEventListener('canplay', () => {
            // Video is ready to play, ensure seeking works
            updateTime();
        });
        
        video.addEventListener('seeked', () => {
            // Video has finished seeking, update timeline
            updateTimeline();
            updateTime();
        });
        
        video.addEventListener('volumechange', updateVolume);
        
        video.setAttribute('tabindex', '0');
        
        // Ensure video can seek by loading more data
        video.addEventListener('loadeddata', () => {
            // Video data is loaded, seeking should work better now
        });
    });
}

// Image Modal Functionality
function initializeImageModal() {
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const imageCounter = document.getElementById('image-modal-counter');
    const closeBtn = document.querySelector('.image-modal-close');
    const prevBtn = document.getElementById('image-modal-prev');
    const nextBtn = document.getElementById('image-modal-next');
    
    let currentImageGroup = [];
    let currentImageIndex = 0;
    
    // Handle click on clickable images (use event delegation for dynamically added images)
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('clickable-image') || e.target.closest('.clickable-image')) {
            e.preventDefault();
            e.stopPropagation();
            
            const clickedImage = e.target.classList.contains('clickable-image') ? e.target : e.target.closest('.clickable-image');
            const imageUrl = clickedImage.getAttribute('data-image-url');
            const imageTitle = clickedImage.getAttribute('data-image-title');
            const groupId = clickedImage.getAttribute('data-group-id');
            
            if (groupId) {
                // If part of a group, fetch all images in that group from the server
                fetch(`/resources/group-images/${groupId}/`, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success' && data.images && data.images.length > 0) {
                        currentImageGroup = data.images.map(img => ({
                            url: img.url,
                            title: img.title
                        }));
                        // Find the index of the clicked image
                        currentImageIndex = currentImageGroup.findIndex(img => img.url === imageUrl);
                        if (currentImageIndex === -1) currentImageIndex = 0;
                        
                        openImageModal(currentImageGroup[currentImageIndex].url, currentImageGroup[currentImageIndex].title);
                    } else {
                        // Fallback: collect images from current page
                        const groupImages = Array.from(document.querySelectorAll(`[data-group-id="${groupId}"].clickable-image, .resource-card[data-group-id="${groupId}"] .clickable-image`));
                        currentImageGroup = groupImages.map(img => ({
                            url: img.getAttribute('data-image-url'),
                            title: img.getAttribute('data-image-title')
                        }));
                        currentImageIndex = groupImages.indexOf(clickedImage);
                        if (currentImageIndex === -1) currentImageIndex = 0;
                        
                        openImageModal(imageUrl, imageTitle);
                    }
                })
                .catch(error => {
                    console.error('Error fetching group images:', error);
                    // Fallback: collect images from current page
                    const groupImages = Array.from(document.querySelectorAll(`[data-group-id="${groupId}"].clickable-image, .resource-card[data-group-id="${groupId}"] .clickable-image`));
                    currentImageGroup = groupImages.map(img => ({
                        url: img.getAttribute('data-image-url'),
                        title: img.getAttribute('data-image-title')
                    }));
                    currentImageIndex = groupImages.indexOf(clickedImage);
                    if (currentImageIndex === -1) currentImageIndex = 0;
                    
                    openImageModal(imageUrl, imageTitle);
                });
            } else {
                // Single image
                currentImageGroup = [{
                    url: imageUrl,
                    title: imageTitle
                }];
                currentImageIndex = 0;
                
                openImageModal(imageUrl, imageTitle);
            }
        }
    });
    
    function openImageModal(imageUrl, imageTitle) {
        modalImage.src = imageUrl;
        modalImage.alt = imageTitle || 'Image';
        imageModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Show/hide navigation buttons
        if (currentImageGroup.length > 1) {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
            imageCounter.style.display = 'block';
            imageCounter.textContent = `${currentImageIndex + 1} / ${currentImageGroup.length}`;
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            imageCounter.style.display = 'none';
        }
    }
    
    function closeImageModal() {
        imageModal.classList.remove('show');
        document.body.style.overflow = 'auto';
        modalImage.src = '';
    }
    
    function showNextImage() {
        if (currentImageGroup.length > 0) {
            currentImageIndex = (currentImageIndex + 1) % currentImageGroup.length;
            const image = currentImageGroup[currentImageIndex];
            modalImage.src = image.url;
            modalImage.alt = image.title || 'Image';
            imageCounter.textContent = `${currentImageIndex + 1} / ${currentImageGroup.length}`;
        }
    }
    
    function showPrevImage() {
        if (currentImageGroup.length > 0) {
            currentImageIndex = (currentImageIndex - 1 + currentImageGroup.length) % currentImageGroup.length;
            const image = currentImageGroup[currentImageIndex];
            modalImage.src = image.url;
            modalImage.alt = image.title || 'Image';
            imageCounter.textContent = `${currentImageIndex + 1} / ${currentImageGroup.length}`;
        }
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeImageModal);
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', showPrevImage);
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', showNextImage);
    }
    
    // Close modal when clicking outside
    imageModal.addEventListener('click', function(e) {
        if (e.target === imageModal) {
            closeImageModal();
        }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (imageModal.classList.contains('show')) {
            if (e.key === 'Escape') {
                closeImageModal();
            } else if (e.key === 'ArrowLeft') {
                showPrevImage();
            } else if (e.key === 'ArrowRight') {
                showNextImage();
            }
        }
    });
}

// Parse and display multiple URLs
function parseMultipleUrls() {
    const urlPreviews = document.querySelectorAll('.url-preview[data-urls]');
    
    urlPreviews.forEach(preview => {
        const urlsData = preview.getAttribute('data-urls');
        const container = preview.querySelector('[id^="urls-container-"]');
        
        if (!urlsData || !container) return;
        
        try {
            // Try to parse as JSON first
            const urls = JSON.parse(urlsData);
            if (Array.isArray(urls)) {
                // Multiple URLs
                const linksHtml = urls.map(url => 
                    `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
                ).join('');
                
                preview.innerHTML = `
                    <strong>${urls.length > 1 ? 'External Links:' : 'External Link:'}</strong>
                    ${linksHtml}
                `;
            } else {
                // Single URL in JSON format
                if (urls && urls.trim()) {
                    preview.innerHTML = `
                        <strong>External Link:</strong>
                        <a href="${urls}" target="_blank" rel="noopener noreferrer">${urls}</a>
                    `;
                }
            }
        } catch (e) {
            // Not JSON, treat as single URL string
            if (urlsData && urlsData.trim()) {
                preview.innerHTML = `
                    <strong>External Link:</strong>
                    <a href="${urlsData}" target="_blank" rel="noopener noreferrer">${urlsData}</a>
                `;
            }
        }
    });
}

