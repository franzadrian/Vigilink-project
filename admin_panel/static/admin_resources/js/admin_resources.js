document.addEventListener('DOMContentLoaded', function() {
    const resourceTypeSelect = document.getElementById('resource_type');
    const fileUploadGroup = document.getElementById('file-upload-group');
    const urlGroup = document.getElementById('url-group');
    const fileInput = document.getElementById('file');
    
    
    // Initialize video controls
    initializeVideoControls();
    
    // Modal elements
    const createResourceBtn = document.getElementById('create-resource-btn');
    const modal = document.getElementById('create-resource-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const resourceForm = document.getElementById('resource-form');
    
    // Update file input accept attribute based on resource type
    function updateFileInput() {
        const resourceType = resourceTypeSelect.value;
        const fileUploadSubtext = document.getElementById('file-upload-subtext');
        
        switch(resourceType) {
            case 'image':
                fileInput.accept = 'image/*';
                fileInput.multiple = true;
                fileUploadSubtext.textContent = 'Image files (JPG, PNG, GIF - max 30MB total)';
                break;
            case 'video':
                fileInput.accept = 'video/*';
                fileInput.multiple = false;
                fileUploadSubtext.textContent = 'Video file (MP4, AVI, MOV - max 100MB)';
                break;
            case 'document':
                fileInput.accept = '.pdf,.txt,.csv,.xlsx,.xls';
                fileInput.multiple = false;
                fileUploadSubtext.textContent = 'Document files (.pdf, .txt, .csv, .xlsx, .xls - max 30MB)';
                break;
            default:
                fileInput.accept = '*';
                fileInput.multiple = false;
                fileUploadSubtext.textContent = 'Any file type';
        }
    }
    
    // Handle resource type change
    resourceTypeSelect.addEventListener('change', function() {
        const resourceType = this.value;
        
        // Hide all groups first
        fileUploadGroup.style.display = 'none';
        urlGroup.style.display = 'none';
        
        // Reset required attributes
        fileInput.required = false;
        
        // Show appropriate group based on resource type
        switch(resourceType) {
            case 'image':
            case 'video':
            case 'document':
                fileUploadGroup.style.display = 'block';
                fileInput.required = true;
                updateFileInput();
                break;
            case 'link':
                urlGroup.style.display = 'block';
                // URL validation is handled in form submission
                break;
            default:
                // No additional fields required
                break;
        }
    });
    
    // Handle file input change to show file info
    fileInput.addEventListener('change', function() {
        handleFileSelection(this.files);
    });
    
    // Handle file selection (used by both change and drop events)
    function handleFileSelection(files) {
        const fileInfo = document.getElementById('file-info');
        const multipleFilesInfo = document.getElementById('multiple-files-info');
        const fileUploadLabel = document.getElementById('file-upload-label');
        const resourceType = document.getElementById('resource_type').value;
        
        // Show loading state for file processing
        showFileProcessingLoader();
        
        if (files && files.length > 0) {
            // Check file size limits
            const maxTotalSize = resourceType === 'video' ? 100 : 30; // 100MB for video, 30MB for others
            const maxIndividualSize = resourceType === 'video' ? 100 : 30; // Individual file limits
            let totalSize = 0;
            let validFiles = [];
            
            for (let file of files) {
                const fileSizeMB = file.size / 1024 / 1024;
                
                // Check individual file size limit
                if (fileSizeMB <= maxIndividualSize) {
                    validFiles.push(file);
                    totalSize += fileSizeMB;
                } else {
                    showToast('Error', `File "${file.name}" exceeds ${maxIndividualSize}MB limit`, 'error');
                }
            }
            
            // For images, check total size limit instead of individual file count
            if (resourceType === 'image' && totalSize > maxTotalSize) {
                showToast('Error', `Total file size (${totalSize.toFixed(2)}MB) exceeds ${maxTotalSize}MB limit`, 'error');
                validFiles = []; // Clear valid files if total size exceeds limit
            }
            
            if (validFiles.length === 0) {
                fileInfo.style.display = 'none';
                multipleFilesInfo.style.display = 'none';
                hideFileProcessingLoader();
                return;
            }
            
            // Show file info based on number of files
            if (validFiles.length === 1) {
                const fileSize = (validFiles[0].size / 1024 / 1024).toFixed(2);
                fileInfo.innerHTML = `Selected: ${validFiles[0].name} (${fileSize} MB)`;
                fileInfo.style.display = 'block';
                multipleFilesInfo.style.display = 'none';
            } else {
                // Multiple files - show list
                let filesList = '';
                validFiles.forEach(file => {
                    const fileSize = (file.size / 1024 / 1024).toFixed(2);
                    filesList += `
                        <div class="file-item">
                            <span class="file-name">${file.name}</span>
                            <span class="file-size">${fileSize} MB</span>
                        </div>
                    `;
                });
                
                multipleFilesInfo.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 8px;">
                        Selected ${validFiles.length} files (${totalSize.toFixed(2)} MB total)
                    </div>
                    ${filesList}
                `;
                multipleFilesInfo.style.display = 'block';
                fileInfo.style.display = 'none';
            }
            
            // Update the upload area to show files are selected
            fileUploadLabel.style.borderColor = '#10b981';
            fileUploadLabel.style.backgroundColor = '#ecfdf5';
            fileUploadLabel.querySelector('.file-upload-text').textContent = 
                validFiles.length === 1 ? 'File selected! Click to change' : `${validFiles.length} files selected! Click to change`;
            
            // Hide loading state
            hideFileProcessingLoader();
        } else {
            fileInfo.style.display = 'none';
            multipleFilesInfo.style.display = 'none';
            // Reset upload area
            fileUploadLabel.style.borderColor = '#cbd5e0';
            fileUploadLabel.style.backgroundColor = '#f7fafc';
            fileUploadLabel.querySelector('.file-upload-text').textContent = 'Click to upload or drag and drop';
            
            // Hide loading state
            hideFileProcessingLoader();
        }
    }
    
    // Drag and drop functionality
    const fileUploadLabel = document.getElementById('file-upload-label');
    
    fileUploadLabel.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    fileUploadLabel.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
    });
    
    fileUploadLabel.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelection(files);
        }
    });
    
    // Handle multiple URL inputs
    function initializeUrlInputs() {
        const urlInputsContainer = document.getElementById('url-inputs-container');
        const addUrlBtn = document.getElementById('add-url-btn');
        const urlPreview = document.getElementById('url-preview');
        
        // Add URL input functionality
        function addUrlInput() {
            const urlInputs = urlInputsContainer.querySelectorAll('.url-input-wrapper');
            if (urlInputs.length >= 5) {
                addUrlBtn.disabled = true;
                return;
            }
            
            const urlWrapper = document.createElement('div');
            urlWrapper.className = 'url-input-wrapper';
            urlWrapper.innerHTML = `
                <input type="url" class="external_url" name="external_urls[]" placeholder="https://drive.google.com/file/... or https://youtube.com/watch?v=...">
                <button type="button" class="remove-url-btn">×</button>
            `;
            
            urlInputsContainer.appendChild(urlWrapper);
            
            // Add event listeners to new input
            const newInput = urlWrapper.querySelector('.external_url');
            const removeBtn = urlWrapper.querySelector('.remove-url-btn');
            
            newInput.addEventListener('input', updateUrlPreview);
            removeBtn.addEventListener('click', () => removeUrlInput(urlWrapper));
            
            // Show remove button if more than 1 input
            updateRemoveButtons();
            updateAddButton();
            
            // Update URL preview
            updateUrlPreview();
        }
        
        function removeUrlInput(wrapper) {
            wrapper.remove();
            updateRemoveButtons();
            updateAddButton();
            updateUrlPreview();
        }
        
        function updateRemoveButtons() {
            const urlInputs = urlInputsContainer.querySelectorAll('.url-input-wrapper');
            urlInputs.forEach((wrapper, index) => {
                const removeBtn = wrapper.querySelector('.remove-url-btn');
                removeBtn.style.display = urlInputs.length > 1 ? 'flex' : 'none';
            });
        }
        
        function updateAddButton() {
            const urlInputs = urlInputsContainer.querySelectorAll('.url-input-wrapper');
            addUrlBtn.disabled = urlInputs.length >= 5;
            addUrlBtn.textContent = urlInputs.length >= 5 ? 'Maximum 5 links reached' : '+ Add Another Link';
        }
        
        function updateUrlPreview() {
            const urlInputs = urlInputsContainer.querySelectorAll('.external_url');
            const validUrls = Array.from(urlInputs)
                .map(input => input.value.trim())
                .filter(url => url.length > 0);
            
            if (validUrls.length > 0) {
                const linksHtml = validUrls.map(url => 
                    `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
                ).join('<br>');
                
            urlPreview.innerHTML = `
                    <strong>Link Preview (${validUrls.length} link${validUrls.length > 1 ? 's' : ''}):</strong><br>
                    ${linksHtml}
            `;
            urlPreview.style.display = 'block';
        } else {
            urlPreview.style.display = 'none';
        }
        }
        
        // Add event listeners (only if not already added)
        if (!addUrlBtn.hasAttribute('data-listener-added')) {
            addUrlBtn.addEventListener('click', addUrlInput);
            addUrlBtn.setAttribute('data-listener-added', 'true');
        }
        
        // Add event listeners to existing inputs
        const existingInputs = urlInputsContainer.querySelectorAll('.external_url');
        existingInputs.forEach(input => {
            input.addEventListener('input', updateUrlPreview);
        });
        
        const existingRemoveBtns = urlInputsContainer.querySelectorAll('.remove-url-btn');
        existingRemoveBtns.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const wrapper = btn.closest('.url-input-wrapper');
                removeUrlInput(wrapper);
            });
        });
        
        // Initialize state
        updateRemoveButtons();
        updateAddButton();
    }
    
    // Initialize URL inputs when DOM is loaded
    initializeUrlInputs();
    
    // Initialize image modal functionality
    initializeImageModal();
    
    // Group multiple images
    groupMultipleImages();
    
    // Parse and display multiple URLs
    parseMultipleUrls();
    
    // Also run it after a short delay to ensure DOM is ready
    setTimeout(parseMultipleUrls, 100);
    
    
    // File processing loader functions
    function showFileProcessingLoader() {
        const fileUploadLabel = document.getElementById('file-upload-label');
        const fileUploadText = fileUploadLabel.querySelector('.file-upload-text');
        const fileUploadSubtext = fileUploadLabel.querySelector('.file-upload-subtext');
        const progressBar = document.getElementById('file-upload-progress');
        const progressFill = progressBar.querySelector('.progress-fill');
        const progressText = progressBar.querySelector('.progress-text');
        
        // Store original text
        fileUploadLabel.dataset.originalText = fileUploadText.textContent;
        fileUploadLabel.dataset.originalSubtext = fileUploadSubtext.textContent;
        
        // Show loading state
        fileUploadText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing files...';
        fileUploadSubtext.textContent = 'Please wait while we validate your files';
        fileUploadLabel.style.borderColor = '#3b82f6';
        fileUploadLabel.style.backgroundColor = '#eff6ff';
        
        // Show progress bar
        progressBar.style.display = 'block';
        progressFill.style.width = '0%';
        progressText.textContent = 'Processing files...';
        
        // Animate progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            progressFill.style.width = progress + '%';
        }, 200);
        
        // Store interval ID for cleanup
        fileUploadLabel.dataset.progressInterval = progressInterval;
    }
    
    function hideFileProcessingLoader() {
        const fileUploadLabel = document.getElementById('file-upload-label');
        const fileUploadText = fileUploadLabel.querySelector('.file-upload-text');
        const fileUploadSubtext = fileUploadLabel.querySelector('.file-upload-subtext');
        const progressBar = document.getElementById('file-upload-progress');
        const progressFill = progressBar.querySelector('.progress-fill');
        
        // Clear progress interval
        const progressInterval = fileUploadLabel.dataset.progressInterval;
        if (progressInterval) {
            clearInterval(progressInterval);
            delete fileUploadLabel.dataset.progressInterval;
        }
        
        // Complete progress bar
        progressFill.style.width = '100%';
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 500);
        
        // Restore original text
        fileUploadText.textContent = fileUploadLabel.dataset.originalText || 'Click to upload or drag and drop';
        fileUploadSubtext.textContent = fileUploadLabel.dataset.originalSubtext || 'PDF, Image, or Video file';
        
        // Reset styling
        fileUploadLabel.style.borderColor = '#cbd5e0';
        fileUploadLabel.style.backgroundColor = '#f7fafc';
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
        
        // Handle click on clickable images
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('clickable-image')) {
                e.preventDefault();
                e.stopPropagation();
                
                const imageUrl = e.target.getAttribute('data-image-url');
                const imageTitle = e.target.getAttribute('data-image-title');
                const groupTitle = e.target.getAttribute('data-group-title');
                const imageIndex = parseInt(e.target.getAttribute('data-image-index')) || 0;
                
                // Get all images in the same group
                if (groupTitle) {
                    // Try to get group data from the card's data attribute first
                    const card = e.target.closest('.resource-card');
                    const groupData = card.getAttribute('data-image-group');
                    
                    if (groupData) {
                        currentImageGroup = JSON.parse(groupData);
                        currentImageIndex = imageIndex;
                    } else {
                        // Fallback to querying DOM elements
                        currentImageGroup = Array.from(document.querySelectorAll(`[data-group-title="${groupTitle}"]`))
                            .map(img => ({
                                url: img.getAttribute('data-image-url'),
                                title: img.getAttribute('data-image-title'),
                                index: parseInt(img.getAttribute('data-image-index'))
                            }))
                            .sort((a, b) => a.index - b.index);
                        currentImageIndex = imageIndex;
                    }
                } else {
                    // Single image
                    currentImageGroup = [{
                        url: imageUrl,
                        title: imageTitle,
                        index: 0
                    }];
                    currentImageIndex = 0;
                }
                
                // Show the image
                showImageInModal(currentImageGroup[currentImageIndex]);
                
                // Show modal with animation
                imageModal.style.display = 'flex';
                setTimeout(() => {
                    imageModal.classList.add('show');
                }, 10);
                document.body.style.overflow = 'hidden';
            }
        });
        
        // Handle close button click
        if (closeBtn) {
            closeBtn.addEventListener('click', closeImageModal);
        }
        
        // Handle navigation buttons
        if (prevBtn) {
            prevBtn.addEventListener('click', showPreviousImage);
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', showNextImage);
        }
        
        // Handle click outside image to close
        imageModal.addEventListener('click', function(e) {
            if (e.target === imageModal) {
                closeImageModal();
            }
        });
        
        // Handle escape key to close
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && imageModal.classList.contains('show')) {
                closeImageModal();
            } else if (e.key === 'ArrowLeft' && imageModal.classList.contains('show')) {
                showPreviousImage();
            } else if (e.key === 'ArrowRight' && imageModal.classList.contains('show')) {
                showNextImage();
            }
        });
        
        function showImageInModal(imageData) {
            modalImage.src = imageData.url;
            modalImage.alt = imageData.title;
            
            
            // Update navigation buttons
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
        
        function showPreviousImage() {
            if (currentImageGroup.length > 1) {
                currentImageIndex = (currentImageIndex - 1 + currentImageGroup.length) % currentImageGroup.length;
                showImageInModal(currentImageGroup[currentImageIndex]);
            }
        }
        
        function showNextImage() {
            if (currentImageGroup.length > 1) {
                currentImageIndex = (currentImageIndex + 1) % currentImageGroup.length;
                showImageInModal(currentImageGroup[currentImageIndex]);
            }
        }
        
        function closeImageModal() {
            imageModal.classList.remove('show');
            setTimeout(() => {
                imageModal.style.display = 'none';
            }, 300);
            document.body.style.overflow = 'auto';
        }
    }
    
    // Group multiple images function
    function groupMultipleImages() {
        const resourceCards = document.querySelectorAll('.resource-card');
        
        // Process each image card
        resourceCards.forEach(card => {
            const imageElement = card.querySelector('.clickable-image');
            if (imageElement) {
                const imageUrl = imageElement.getAttribute('data-image-url');
                const imageTitle = imageElement.getAttribute('data-image-title');
                
                // Check if this is part of a group by looking at the title pattern
                const titleMatch = imageTitle.match(/^(.+?)\s*\(Image\s+\d+\)$/);
                if (titleMatch) {
                    const baseTitle = titleMatch[1];
                    
                    // Update the title to show the base title without "(Image 1)"
                    const titleElement = card.querySelector('h3');
                    if (titleElement) {
                        titleElement.textContent = baseTitle;
                    }
                    
                    // Add group data attributes
                    imageElement.setAttribute('data-group-title', baseTitle);
                    imageElement.setAttribute('data-image-index', '0');
                    
                    // Create image gallery container
                    const resourcePreview = card.querySelector('.resource-preview');
                    const imageGalleryContainer = document.createElement('div');
                    imageGalleryContainer.className = 'image-gallery-container';
                    
                    // Move the image into the gallery container
                    imageGalleryContainer.appendChild(imageElement.cloneNode(true));
                    resourcePreview.innerHTML = '';
                    resourcePreview.appendChild(imageGalleryContainer);
                    
                    // Add counter overlay (we'll update this with AJAX to get the actual count)
                    const counter = document.createElement('div');
                    counter.className = 'image-counter';
                    counter.textContent = '+0';
                    counter.setAttribute('data-total-count', '1');
                    imageGalleryContainer.appendChild(counter);
                    
                    // Update the image with group data
                    const galleryImage = imageGalleryContainer.querySelector('.resource-image');
                    galleryImage.setAttribute('data-group-title', baseTitle);
                    galleryImage.setAttribute('data-image-index', '0');
                    
                    // Get the actual count of images in this group via AJAX
                    // Try to extract GROUP_ID from the description if available
                    const cardDescription = card.querySelector('.resource-description');
                    let groupId = null;
                    if (cardDescription) {
                        const descText = cardDescription.textContent;
                        const groupMatch = descText.match(/\[GROUP_ID:([^\]]+)\]/);
                        if (groupMatch) {
                            groupId = groupMatch[1];
                        }
                    }
                    
                    const encodedTitle = encodeURIComponent(groupId ? `${baseTitle}[GROUP_ID:${groupId}]` : baseTitle);
                    fetch(`/admin-panel/resources/group-count/${encodedTitle}/`)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Network response was not ok');
                            }
                            return response.json();
                        })
                        .then(data => {
                            if (data.count > 1) {
                                counter.textContent = `+${data.count - 1}`;
                                counter.setAttribute('data-total-count', data.count);
                                
                                // Store all images in the group for modal navigation
                                card.setAttribute('data-image-group', JSON.stringify(data.images));
                            } else {
                                counter.style.display = 'none';
                            }
                        })
                        .catch(error => {
                            console.error('Error getting group count:', error);
                            counter.style.display = 'none';
                        });
                }
            }
        });
    }
    
    // Parse and display multiple URLs
    function parseMultipleUrls() {
        const urlPreviews = document.querySelectorAll('.url-preview[data-urls]');
        
        urlPreviews.forEach(preview => {
            const urlsData = preview.getAttribute('data-urls');
            
            // Check if it's a JSON array of URLs
            if (urlsData && urlsData.startsWith('[')) {
                try {
                    const urls = JSON.parse(urlsData);
                    console.log('Found URLs:', urls); // Debug log
                    
                    if (urls && urls.length > 0) {
                        // Update the title to show "Links" instead of "Link"
                        const titleElement = preview.querySelector('strong');
                        if (titleElement) {
                            titleElement.textContent = urls.length > 1 ? 'External Links:' : 'External Link:';
                        }
                        
                        // Replace the single link with multiple links
                        const linksHtml = urls.map(url => 
                            `<div style="margin: 5px 0;"><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></div>`
                        ).join('');
                        
                        preview.innerHTML = `
                            <strong>${urls.length > 1 ? 'External Links:' : 'External Link:'}</strong><br>
                            ${linksHtml}
                        `;
                    }
                } catch (e) {
                    console.log('Error parsing URLs:', e);
                }
            }
        });
    }
    
    
    // Toggle conditional fields based on resource type
    function toggleConditionalFields() {
        const resourceType = document.getElementById('resource_type').value;
        const fileUploadGroup = document.getElementById('file-upload-group');
        const urlGroup = document.getElementById('url-group');
        
        // Hide all groups first
        fileUploadGroup.style.display = 'none';
        urlGroup.style.display = 'none';
        
        // Show appropriate group based on resource type
        switch(resourceType) {
            case 'pdf':
            case 'image':
            case 'video':
                fileUploadGroup.style.display = 'block';
                break;
            case 'link':
                urlGroup.style.display = 'block';
                break;
        }
    }
    
    // Form validation and submission
    const form = document.querySelector('.resource-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const resourceType = resourceTypeSelect.value;
        const title = document.getElementById('title').value.trim();
        const description = document.getElementById('description').value.trim();
        const file = fileInput.files[0];
        
        // Get all external URLs
        const externalUrls = Array.from(document.querySelectorAll('.external_url'))
            .map(input => input.value.trim())
            .filter(url => url.length > 0);

        if (!title) {
            showToast('Validation Error', 'Title is required', 'error');
            return;
        }

        if (!resourceType) {
            showToast('Validation Error', 'Resource type is required', 'error');
            return;
        }

        // Validate based on resource type
        if (resourceType === 'image' || resourceType === 'video' || resourceType === 'document') {
            if (!file && !form.action.includes('/edit/')) {
                showToast('Validation Error', 'File is required for this resource type', 'error');
                return;
            }
        } else if (resourceType === 'link') {
            if (externalUrls.length === 0) {
                showToast('Validation Error', 'At least one external URL is required for links', 'error');
                return;
            }
            // Basic URL validation for all URLs
            for (let url of externalUrls) {
            try {
                    new URL(url);
            } catch {
                    showToast('Validation Error', `Please enter a valid URL: ${url}`, 'error');
                return;
                }
            }
        }

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Resource...';

        // Submit form
        const formData = new FormData(form);
        
        fetch(form.action || '/admin-panel/resources/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                'Accept': 'application/json',
            },
        })
        .then(response => {
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return response.json();
            } else {
                // If not JSON, return the text response
                return response.text().then(text => {
                    throw new Error(`Server returned HTML instead of JSON. Response: ${text.substring(0, 200)}...`);
                });
            }
        })
        .then(data => {
            if (data.status === 'success') {
                showToast('Success', data.message, 'success');
                setTimeout(() => {
                    location.reload();
                }, 1500);
            } else {
                showToast('Error', data.message || 'Unknown error occurred', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Error', error.message || 'An error occurred while saving the resource', 'error');
        })
        .finally(() => {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        });
    });
    
    // Handle delete buttons using event delegation
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-delete')) {
            const resourceId = e.target.getAttribute('data-resource-id');
            if (resourceId) {
                showDeleteDialog(resourceId);
            }
        }
        
        if (e.target.classList.contains('btn-edit')) {
            const resourceId = e.target.getAttribute('data-resource-id');
            const resourceType = e.target.getAttribute('data-resource-type');
            const resourceTitle = e.target.getAttribute('data-resource-title');
            const resourceDescription = e.target.getAttribute('data-resource-description');
            const resourceUrl = e.target.getAttribute('data-resource-url');
            const fileUrl = e.target.getAttribute('data-file-url');
            const resourceCommunity = e.target.getAttribute('data-resource-community');
            
            if (resourceId) {
                openEditModal(resourceId, resourceType, resourceTitle, resourceDescription, resourceUrl, fileUrl, resourceCommunity);
            }
        }
    });
    
    // Modal functionality
    function openModal() {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        // Reset form
        resourceForm.reset();
        // Hide all conditional groups
        fileUploadGroup.style.display = 'none';
        urlGroup.style.display = 'none';
        // Reset required attributes
        fileInput.required = false;
        // Reset file upload area
        resetFileUploadArea();
        // Show appropriate fields based on selected resource type
        toggleConditionalFields();
    }
    
    function resetFileUploadArea() {
        const fileInfo = document.getElementById('file-info');
        const fileUploadLabel = document.getElementById('file-upload-label');
        
        fileInfo.style.display = 'none';
        fileUploadLabel.style.borderColor = '#cbd5e0';
        fileUploadLabel.style.backgroundColor = '#f7fafc';
        fileUploadLabel.querySelector('.file-upload-text').textContent = 'Click to upload or drag and drop';
    }
    
    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        // Reset form to create mode when closing modal
        // This ensures that if edit modal was open, the form is reset for create mode
        if (typeof resetFormForCreate === 'function') {
            resetFormForCreate();
        } else {
            // Fallback: manually reset form if function not yet defined
            resourceForm.action = '';
            resourceForm.reset();
            const submitBtn = resourceForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Create Resource';
            const modalHeader = modal.querySelector('.modal-header h2');
            if (modalHeader) modalHeader.textContent = 'Create New Resource';
            hideExistingFilePreview();
        }
    }
    
    // Event listeners for modal
    if (createResourceBtn) {
        createResourceBtn.addEventListener('click', openModal);
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeModal();
        }
    });

    // Character count functionality removed (was only for text guides)

    // Custom Delete Dialog functionality
    const deleteDialog = document.getElementById('delete-dialog');
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    let resourceToDelete = null;

    function showDeleteDialog(resourceId) {
        resourceToDelete = resourceId;
        deleteDialog.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function hideDeleteDialog() {
        deleteDialog.classList.remove('show');
        document.body.style.overflow = 'auto';
        resourceToDelete = null;
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', hideDeleteDialog);
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            if (resourceToDelete) {
                deleteResource(resourceToDelete);
                hideDeleteDialog();
            }
        });
    }

    // Close dialog when clicking outside
    if (deleteDialog) {
        deleteDialog.addEventListener('click', function(e) {
            if (e.target === deleteDialog) {
                hideDeleteDialog();
            }
        });
    }

    // Toast notification functions
    function showToast(title, message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
        
    }

    // Edit modal functionality
    function openEditModal(resourceId, resourceType, resourceTitle, resourceDescription, resourceUrl, fileUrl, resourceCommunity) {
        // Clean title and description (remove "(Image N)" and "[GROUP_ID:...]" markers)
        const cleanedTitle = (resourceTitle || '').replace(/\s*\(Image\s+\d+\)\s*$/i, '');
        const cleanedDescription = (resourceDescription || '').replace(/\s*\[GROUP_ID:[^\]]+\]\s*/gi, '').trim();

        // Set form values
        document.getElementById('title').value = cleanedTitle;
        document.getElementById('description').value = cleanedDescription;
        document.getElementById('resource_type').value = resourceType || '';
        
        // Set community value
        const communitySelect = document.getElementById('community');
        if (communitySelect && resourceCommunity) {
            communitySelect.value = resourceCommunity;
        } else if (communitySelect) {
            communitySelect.value = '';
        }
        
        // Handle multiple URLs for edit
        if (resourceType === 'link' && resourceUrl) {
            // Clear existing URL inputs
            const urlInputsContainer = document.getElementById('url-inputs-container');
            urlInputsContainer.innerHTML = '';
            
            try {
                // Try to parse as JSON first (multiple URLs)
                const urls = JSON.parse(resourceUrl);
                if (Array.isArray(urls)) {
                    // Multiple URLs - create separate input for each
                    urls.forEach((url, index) => {
                        if (url && url.trim()) {
                            const urlWrapper = document.createElement('div');
                            urlWrapper.className = 'url-input-wrapper';
                            urlWrapper.innerHTML = `
                                <input type="url" class="external_url" name="external_urls[]" placeholder="https://drive.google.com/file/... or https://youtube.com/watch?v=..." value="${url}">
                                <button type="button" class="remove-url-btn" ${urls.length === 1 ? 'style="display: none;"' : ''}>×</button>
                            `;
                            urlInputsContainer.appendChild(urlWrapper);
                        }
                    });
                } else {
                    // Single URL in JSON format
                    if (urls && urls.trim()) {
                        const urlWrapper = document.createElement('div');
                        urlWrapper.className = 'url-input-wrapper';
                        urlWrapper.innerHTML = `
                            <input type="url" class="external_url" name="external_urls[]" placeholder="https://drive.google.com/file/... or https://youtube.com/watch?v=..." value="${urls}">
                            <button type="button" class="remove-url-btn" style="display: none;">×</button>
                        `;
                        urlInputsContainer.appendChild(urlWrapper);
                    }
                }
            } catch (e) {
                // Not JSON, treat as single URL string
                if (resourceUrl && resourceUrl.trim()) {
                    const urlWrapper = document.createElement('div');
                    urlWrapper.className = 'url-input-wrapper';
                    urlWrapper.innerHTML = `
                        <input type="url" class="external_url" name="external_urls[]" placeholder="https://drive.google.com/file/... or https://youtube.com/watch?v=..." value="${resourceUrl}">
                        <button type="button" class="remove-url-btn" style="display: none;">×</button>
                    `;
                    urlInputsContainer.appendChild(urlWrapper);
                }
            }
            
            // Reinitialize URL inputs for add functionality
            initializeUrlInputs();
        }
        
        // Handle file preview for existing files
        if (fileUrl && resourceType && ['image', 'video', 'document'].includes(resourceType)) {
            showExistingFilePreview(fileUrl, resourceType);
        } else {
            hideExistingFilePreview();
        }
        
        // Show file upload area for adding new files
        if (resourceType && ['pdf', 'image', 'video'].includes(resourceType)) {
            document.getElementById('file-upload-group').style.display = 'block';
            // Update the label to indicate adding new files
            const fileLabel = document.querySelector('#file-upload-group label');
            if (fileLabel) {
                const originalText = fileLabel.querySelector('.file-upload-text');
                if (originalText) {
                    originalText.textContent = 'Click to add new files or drag and drop';
                }
            }
        }
        
        // Update file input and show appropriate fields
        updateFileInput();
        toggleConditionalFields();
        
        // Change form action to update instead of create
        resourceForm.action = `/admin-panel/resources/edit/${resourceId}/`;
        resourceForm.querySelector('button[type="submit"]').textContent = 'Update Resource';
        
        // Change modal header for edit mode
        const modalHeader = modal.querySelector('.modal-header h2');
        if (modalHeader) {
            modalHeader.textContent = 'Edit Resource';
        }
        
        // Open modal without resetting form
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Show existing file preview in edit mode
    function showExistingFilePreview(fileUrl, resourceType) {
        // Create or update existing file preview container
        let previewContainer = document.getElementById('existing-file-preview');
        
        // Determine message based on resource type
        const isImage = resourceType === 'image';
        const headerText = isImage ? 'Current File (will be kept):' : 'Current File (will be replaced):';
        const noteText = isImage 
            ? '💡 Upload new files below to add them alongside the current file'
            : '💡 Upload a new file below to replace the current file';
        
        if (!previewContainer) {
            previewContainer = document.createElement('div');
            previewContainer.id = 'existing-file-preview';
            previewContainer.className = 'existing-file-preview';
            previewContainer.innerHTML = `
                <div class="existing-file-header">
                    <h4>${headerText}</h4>
                    <button type="button" id="remove-existing-file" class="btn-remove-file">Remove</button>
                </div>
                <div class="existing-file-content" id="existing-file-content"></div>
                <div class="add-file-note">
                    <small>${noteText}</small>
                </div>
            `;
            
            // Insert after the file upload group
            const fileUploadGroup = document.getElementById('file-upload-group');
            fileUploadGroup.parentNode.insertBefore(previewContainer, fileUploadGroup.nextSibling);
        } else {
            // Update existing container with correct messages
            const header = previewContainer.querySelector('.existing-file-header h4');
            const note = previewContainer.querySelector('.add-file-note small');
            if (header) header.textContent = headerText;
            if (note) note.textContent = noteText;
        }
        
        const fileContent = document.getElementById('existing-file-content');
        fileContent.innerHTML = '';
        
        if (resourceType === 'image') {
            fileContent.innerHTML = `
                <div class="image-preview">
                    <img src="${fileUrl}" alt="Current image" style="max-width: 200px; max-height: 150px; border-radius: 4px;">
                    <p><a href="${fileUrl}" target="_blank">View Full Image</a></p>
                </div>
            `;
        } else if (resourceType === 'video') {
            fileContent.innerHTML = `
                <div class="video-preview">
                    <video controls style="max-width: 200px; max-height: 150px;">
                        <source src="${fileUrl}" type="video/mp4">
                        <source src="${fileUrl}" type="video/webm">
                        <source src="${fileUrl}" type="video/ogg">
                        Your browser does not support the video tag.
                    </video>
                    <p><a href="${fileUrl}" target="_blank">View Full Video</a></p>
                </div>
            `;
        } else if (resourceType === 'document') {
            fileContent.innerHTML = `
                <div class="document-preview">
                    <div class="document-icon">📄</div>
                    <div class="document-info">
                        <h5>Document File</h5>
                        <p>Current file: <a href="${fileUrl}" target="_blank">View/Download</a></p>
                    </div>
                </div>
            `;
        }
        
        // Add event listener for remove button
        const removeBtn = document.getElementById('remove-existing-file');
        if (removeBtn) {
            removeBtn.onclick = function() {
                hideExistingFilePreview();
                // Show file upload area when removing existing file
                document.getElementById('file-upload-group').style.display = 'block';
            };
        }
        
        // Keep file upload group visible
        document.getElementById('file-upload-group').style.display = 'block';
    }
    
    // Hide existing file preview
    function hideExistingFilePreview() {
        const previewContainer = document.getElementById('existing-file-preview');
        if (previewContainer) {
            previewContainer.remove();
        }
        // Show file upload area
        document.getElementById('file-upload-group').style.display = 'block';
    }

    // Reset form for create mode
    function resetFormForCreate() {
        resourceForm.action = '';
        resourceForm.querySelector('button[type="submit"]').textContent = 'Create Resource';
        
        // Reset modal header for create mode
        const modalHeader = modal.querySelector('.modal-header h2');
        if (modalHeader) {
            modalHeader.textContent = 'Create New Resource';
        }
        
        // Hide existing file preview
        hideExistingFilePreview();
        
        resourceForm.reset();
        resetFileUploadArea();
        // Show appropriate fields based on selected resource type
        toggleConditionalFields();
    }

    // Override openModal to reset form for create
    const originalOpenModal = openModal;
    openModal = function() {
        resetFormForCreate();
        // Call the original openModal but don't call resetFormForCreate again
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        // Reset form
        resourceForm.reset();
        // Hide all conditional groups
        fileUploadGroup.style.display = 'none';
        urlGroup.style.display = 'none';
        // Reset required attributes
        fileInput.required = false;
        // Reset file upload area
        resetFileUploadArea();
        // Show appropriate fields based on selected resource type
        toggleConditionalFields();
    };

    // Make functions globally available
    window.showToast = showToast;
    window.openEditModal = openEditModal;
    
    // AJAX Search and Filter functionality
    const searchInputEl = document.getElementById('search-input');
    const filterButtonsEl = document.querySelectorAll('.filter-btn[data-filter-type]');
    const communityFilterEl = document.getElementById('community-filter-select');
    
    let currentFilters = {
        search: searchInputEl ? searchInputEl.value.trim() : '',
        type: Array.from(filterButtonsEl).find(b => b.classList.contains('active'))?.getAttribute('data-filter-type') || 'all',
        community: communityFilterEl ? communityFilterEl.value : '',
        page: 1
    };
    
    // Search input handler
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const filterButtons = document.querySelectorAll('.filter-btn[data-filter-type]');
    const communityFilter = document.getElementById('community-filter-select');
    
    function updateResources() {
        const params = new URLSearchParams();
        if (currentFilters.search) params.set('search', currentFilters.search);
        if (currentFilters.type && currentFilters.type !== 'all') params.set('type', currentFilters.type);
        if (currentFilters.community) params.set('community', currentFilters.community);
        if (currentFilters.page > 1) params.set('page', currentFilters.page);
        
        // Show loading state
        const resourcesContainer = document.getElementById('resources-container');
        if (resourcesContainer) {
            resourcesContainer.style.opacity = '0.5';
            resourcesContainer.style.pointerEvents = 'none';
        }
        
        // Fetch filtered resources
        fetch(`/admin-panel/resources/?${params.toString()}`, {
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
            const clearSearchBtn = document.getElementById('clear-search-btn');
            if (currentFilters.search && !clearSearchBtn) {
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
            } else if (!currentFilters.search && clearSearchBtn) {
                // Remove clear button if no search
                clearSearchBtn.remove();
            }
            
            // Update URL without page reload
            const newUrl = `/admin-panel/resources/${params.toString() ? '?' + params.toString() : ''}`;
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
            
            // Reattach edit/delete button listeners
            attachResourceButtonListeners();
            
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
        const paginationLinks = document.querySelectorAll('#pagination-container .page-link');
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
    
    // Community filter
    if (communityFilter) {
        communityFilter.addEventListener('change', function() {
            currentFilters.community = this.value;
            currentFilters.page = 1; // Reset to first page on filter change
            updateResources();
        });
    }
    
    // Initialize pagination listeners
    attachPaginationListeners();
    
    // Function to attach resource button listeners (edit/delete)
    function attachResourceButtonListeners() {
        // Edit buttons
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', function() {
                const resourceId = this.getAttribute('data-resource-id');
                const resourceType = this.getAttribute('data-resource-type');
                const resourceTitle = this.getAttribute('data-resource-title');
                const resourceDescription = this.getAttribute('data-resource-description');
                const resourceUrl = this.getAttribute('data-resource-url');
                const fileUrl = this.getAttribute('data-file-url');
                const resourceCommunity = this.getAttribute('data-resource-community');
                
                if (typeof openEditModal === 'function') {
                    openEditModal(resourceId, resourceType, resourceTitle, resourceDescription, resourceUrl, fileUrl, resourceCommunity);
                }
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', function() {
                const resourceId = this.getAttribute('data-resource-id');
                if (typeof deleteResource === 'function') {
                    deleteResource(resourceId);
                }
            });
        });
    }
    
    // Initialize resource button listeners on page load
    attachResourceButtonListeners();
});


// PDF Preview function removed - PDFs now open in new tabs via the View PDF button

function deleteResource(resourceId) {
    // Check if this is a grouped image
    const resourceCard = document.querySelector(`[data-resource-id="${resourceId}"]`).closest('.resource-card');
    const imageGroup = resourceCard.getAttribute('data-image-group');
    
    if (imageGroup) {
        // This is a grouped image, delete all images in the group
        const groupData = JSON.parse(imageGroup);
        const baseTitle = resourceCard.querySelector('.resource-image').getAttribute('data-group-title');
        
        // Get all images in this group from the backend
        const encodedTitle = encodeURIComponent(baseTitle);
        fetch(`/admin-panel/resources/group-count/${encodedTitle}/`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Delete all images in the group by title
                const deletePromises = data.images.map(image => {
                    return fetch(`/admin-panel/resources/delete-by-title/${encodeURIComponent(image.title)}/`, {
                        method: 'POST',
                        headers: {
                            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                            'Content-Type': 'application/json',
                        },
                    });
                });
                
                return Promise.all(deletePromises);
            })
            .then(responses => Promise.all(responses.map(r => r.json())))
            .then(results => {
                const successCount = results.filter(r => r.status === 'success').length;
                if (window.showToast) {
                    window.showToast('Success', `${successCount} images deleted successfully!`, 'success');
                }
                // Refresh the page to update pagination
                setTimeout(() => {
                    location.reload();
                }, 1000);
            })
            .catch(error => {
                console.error('Error:', error);
                if (window.showToast) {
                    window.showToast('Error', 'Error deleting images', 'error');
                }
            });
    } else {
        // Single resource, delete normally
        fetch(`/admin-panel/resources/delete/${resourceId}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
                'Content-Type': 'application/json',
            },
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Show success toast
                if (window.showToast) {
                    window.showToast('Success', 'Resource deleted successfully!', 'success');
                }
                // Refresh the page to update pagination
                setTimeout(() => {
                    location.reload();
                }, 1000);
            } else {
                if (window.showToast) {
                    window.showToast('Error', 'Error deleting resource: ' + data.message, 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (window.showToast) {
                window.showToast('Error', 'Error deleting resource', 'error');
            }
        });
    }
}

function previewResource(resourceId, resourceType, fileUrl, externalUrl) {
    if (resourceType === 'link' && externalUrl) {
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
    } else if (fileUrl) {
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        // Show a temporary success message
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.background = '#27ae60';
        
        setTimeout(function() {
            button.textContent = originalText;
            button.style.background = '#3498db';
        }, 2000);
    }).catch(function(err) {
        console.error('Could not copy text: ', err);
        alert('Could not copy to clipboard');
    });
}

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
        
        // Video click to play/pause (works in both normal and fullscreen mode)
        video.addEventListener('click', (e) => {
            // Don't handle clicks if they're on timeline elements
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
        
        // Also handle clicks on the player container (but not on controls or timeline)
        player.addEventListener('click', (e) => {
            // Only handle clicks if not clicking on controls or timeline
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
        
        // Play/pause button icon updates are now handled by handleVideoPlay and handleVideoPause functions
        
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
        
        
        // Video event handlers
        function handleVideoPlay() {
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            player.classList.add('playing');
        }
        
        function handleVideoPause() {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            player.classList.remove('playing');
        }
        
        // Add event listeners
        video.addEventListener('play', handleVideoPlay);
        video.addEventListener('pause', handleVideoPause);
        
        // Click handling is now done in the mousedown/mouseup logic above
        
        // Timeline drag functionality - handle both click and drag on timeline track
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
        
        // Also handle drag on timeline thumb
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
            
            // Mark that we've moved (to distinguish from click)
            hasMoved = true;
            
            if (video.duration && !isNaN(video.duration) && video.readyState >= 2) {
                const rect = timelineTrack.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
                const newTime = clickPercent * video.duration;
                
                // Store current play state
                const wasPlaying = !video.paused;
                
                // Seek to new position
                video.currentTime = newTime;
                
                // If video was playing, keep it playing after seek
                if (wasPlaying) {
                            video.play().catch(() => {
                                // Ignore play errors
                            });
                }
            }
        }
        
        function stopTimelineDrag(e) {
            isDragging = false;
            document.removeEventListener('mousemove', handleTimelineDrag);
            document.removeEventListener('mouseup', stopTimelineDrag);
            
            // If it was a quick click (not a drag), handle it as a click
            if (!hasMoved && (Date.now() - mouseDownTime) < 200) {
                if (video.duration && !isNaN(video.duration) && video.readyState >= 2) {
                    const rect = timelineTrack.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
                    const newTime = clickPercent * video.duration;
                    
                    // Store current play state
                    const wasPlaying = !video.paused;
                    
                    // Seek to new position
                    video.currentTime = newTime;
                    
                    // If video was playing, keep it playing after seek
                    if (wasPlaying) {
                        video.play().catch(() => {
                            // Ignore play errors
                        });
                    }
                }
            }
        }
        
        // Volume functionality
        function updateVolume() {
            const volume = video.volume;
            volumeProgress.style.width = (volume * 100) + '%';
            volumeThumb.style.right = ((1 - volume) * 100) + '%';
            
            // Update mute button icon
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
        
        // Volume slider functionality
        volumeSlider.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = volumeSlider.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
            video.volume = clickPercent;
            video.muted = false;
            updateVolume();
        });
        
        // Volume drag functionality
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
                // Enter fullscreen
                if (player.requestFullscreen) {
                    player.requestFullscreen();
                } else if (player.webkitRequestFullscreen) {
                    player.webkitRequestFullscreen();
                } else if (player.msRequestFullscreen) {
                    player.msRequestFullscreen();
                }
            } else {
                // Exit fullscreen
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        }
        
        // Handle fullscreen change events
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);
        
        function handleFullscreenChange() {
            if (document.fullscreenElement === player || 
                document.webkitFullscreenElement === player || 
                document.msFullscreenElement === player) {
                player.classList.add('fullscreen');
                // Show controls in fullscreen
                player.classList.add('playing');
            } else {
                player.classList.remove('fullscreen');
            }
        }
        
        // Keyboard controls
        video.addEventListener('keydown', (e) => {
            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    video.currentTime = Math.max(0, video.currentTime - 10);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    video.currentTime = Math.min(video.duration, video.currentTime + 10);
                    break;
                case 'm':
                case 'M':
                    e.preventDefault();
                    video.muted = !video.muted;
                    updateVolume();
                    break;
            }
        });
        
        // Event listeners
        video.addEventListener('timeupdate', () => {
            updateTimeline();
            updateTime();
        });
        
        video.addEventListener('loadedmetadata', () => {
            updateTime();
            updateVolume();
        });
        
        video.addEventListener('volumechange', updateVolume);
        
        // Make video focusable
        video.setAttribute('tabindex', '0');
        
        // Prevent controls from hiding when interacting with them
        player.addEventListener('mouseenter', () => {
            player.classList.add('controls-visible');
        });
        
        player.addEventListener('mouseleave', () => {
            if (!video.paused) {
                player.classList.remove('controls-visible');
            }
        });
    });
}

// Parse and display external URLs
function parseAndDisplayUrls() {
    const urlPreviews = document.querySelectorAll('.url-preview[data-urls]');
    
    urlPreviews.forEach(preview => {
        const urlsData = preview.getAttribute('data-urls');
        const container = preview.querySelector('[id^="urls-container-"]');
        
        if (!urlsData || !container) return;
        
        let urlCount = 0;
        
        try {
            // Try to parse as JSON first
            const urls = JSON.parse(urlsData);
            if (Array.isArray(urls)) {
                // Multiple URLs - create completely separate containers
                urls.forEach(url => {
                    if (url && url.trim()) {
                        // Create a separate container for each URL
                        const separateContainer = document.createElement('div');
                        separateContainer.className = 'url-preview';
                        separateContainer.style.marginBottom = '12px';
                        
                        const linkItem = document.createElement('div');
                        linkItem.className = 'external-link-item';
                        linkItem.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="external-link">${url}</a>`;
                        
                        separateContainer.appendChild(linkItem);
                        container.appendChild(separateContainer);
                        urlCount++;
                    }
                });
            } else {
                // Single URL in JSON format
                if (urls && urls.trim()) {
                    const separateContainer = document.createElement('div');
                    separateContainer.className = 'url-preview';
                    
                    const linkItem = document.createElement('div');
                    linkItem.className = 'external-link-item';
                    linkItem.innerHTML = `<a href="${urls}" target="_blank" rel="noopener noreferrer" class="external-link">${urls}</a>`;
                    
                    separateContainer.appendChild(linkItem);
                    container.appendChild(separateContainer);
                    urlCount = 1;
                }
            }
        } catch (e) {
            // Not JSON, treat as single URL string
            if (urlsData && urlsData.trim()) {
                const separateContainer = document.createElement('div');
                separateContainer.className = 'url-preview';
                
                const linkItem = document.createElement('div');
                linkItem.className = 'external-link-item';
                linkItem.innerHTML = `<a href="${urlsData}" target="_blank" rel="noopener noreferrer" class="external-link">${urlsData}</a>`;
                
                separateContainer.appendChild(linkItem);
                container.appendChild(separateContainer);
                urlCount = 1;
            }
        }
        
        // Add CSS class for multiple links to display them side by side
        if (urlCount > 1) {
            preview.classList.add('multiple-links');
        }
    });
}

// Initialize URL parsing when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    parseAndDisplayUrls();
});
