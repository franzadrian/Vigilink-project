// Admin Alerts JavaScript - Safety Tips, Emergency Contacts, and Announcements Management

// Global functions for announcements pagination (must be outside DOMContentLoaded)
function getCurrentAnnouncementPage() {
    const paginationContainer = document.getElementById('announcements-pagination-container');
    if (paginationContainer) {
        const currentSpan = paginationContainer.querySelector('.current');
        if (currentSpan) {
            const match = currentSpan.textContent.match(/Page (\d+)/);
            if (match) {
                return parseInt(match[1]);
            }
        }
    }
    // Check URL parameter as fallback
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('announcement_page');
    return page ? parseInt(page) : 1;
}

function updateAnnouncements(page) {
    const params = new URLSearchParams();
    params.set('announcement_page', page);
    
    // Show loading state
    const announcementsContainer = document.getElementById('announcements-container');
    if (announcementsContainer) {
        announcementsContainer.style.opacity = '0.5';
        announcementsContainer.style.pointerEvents = 'none';
    }
    
    fetch(`/admin-panel/alerts/?${params.toString()}`, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text();
    })
    .then(html => {
        if (announcementsContainer) {
            announcementsContainer.innerHTML = html;
            announcementsContainer.style.opacity = '1';
            announcementsContainer.style.pointerEvents = 'auto';
            
            // Re-attach event listeners for the new content
            attachAnnouncementEventListeners();
            
            // Scroll to top of announcements section
            announcementsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    })
    .catch(error => {
        console.error('Error:', error);
        if (announcementsContainer) {
            announcementsContainer.style.opacity = '1';
            announcementsContainer.style.pointerEvents = 'auto';
        }
        if (typeof showToast === 'function') {
            showToast('Error loading announcements', 'error');
        }
    });
}

function attachAnnouncementEventListeners() {
    // Re-attach pagination listeners (these need to be re-attached after AJAX updates)
    const paginationLinks = document.querySelectorAll('#announcements-pagination-container .page-link');
    paginationLinks.forEach(link => {
        // Remove any existing listeners by cloning the element
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);
        
        newLink.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            if (page) {
                updateAnnouncements(page);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Sidebar functionality (reuse from admin_dashboard)
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content') || document.querySelector('main');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    function toggleSidebar(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
        if (mainContent) {
            mainContent.classList.toggle('expanded');
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.toggle('active');
        }
        document.body.classList.toggle('sidebar-open');
    }
    
    function closeSidebar() {
        if (sidebar) {
            sidebar.classList.remove('open');
        }
        if (mainContent) {
            mainContent.classList.remove('expanded');
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
        }
        document.body.classList.remove('sidebar-open');
    }
    
    if (mobileMenuBtn) {
        mobileMenuBtn.removeEventListener('click', toggleSidebar);
        mobileMenuBtn.addEventListener('click', toggleSidebar, true);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });
    
    // Initial attachment of pagination listeners
    attachAnnouncementEventListeners();

    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            
            // Update active states
            tabButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${targetTab}-tab`) {
                    content.classList.add('active');
                }
            });
        });
    });

    // Safety Tip Form Handler
    const safetyTipForm = document.getElementById('safety-tip-form');
    if (safetyTipForm) {
        safetyTipForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveSafetyTip();
        });
    }

    // Emergency Contact Form Handler
    const emergencyContactForm = document.getElementById('emergency-contact-form');
    if (emergencyContactForm) {
        emergencyContactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveEmergencyContact();
        });
    }

    // Announcement Form Handler
    const announcementForm = document.getElementById('announcement-form');
    if (announcementForm) {
        announcementForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveAnnouncement();
        });
    }

    // Modal overlay click to close
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function() {
            closeAllModals();
        });
    }

    // Add button event listeners
    const addSafetyTipBtn = document.getElementById('add-safety-tip-btn');
    if (addSafetyTipBtn) {
        addSafetyTipBtn.addEventListener('click', () => openSafetyTipModal());
    }

    const addEmergencyContactBtn = document.getElementById('add-emergency-contact-btn');
    
    // Handle "Add Contact" button on location cards
    document.addEventListener('click', function(e) {
        if (e.target.closest('.emergency-contact-add-btn')) {
            const btn = e.target.closest('.emergency-contact-add-btn');
            const locationType = btn.dataset.locationType;
            const locationName = btn.dataset.locationName;
            const districtId = btn.dataset.districtId;
            openEmergencyContactModal(null, locationType, locationName, districtId);
        }
    });
    if (addEmergencyContactBtn) {
        addEmergencyContactBtn.addEventListener('click', () => openEmergencyContactModal());
    }
    
    // Store options when page loads (force to ensure we get them)
    window.storeOriginalDistrictOptions(true);
    
    // City dropdown change handler for filtering districts
    const citySelect = document.getElementById('emergency-contact-city');
    if (citySelect) {
        citySelect.addEventListener('change', function() {
            // Make sure we have the original options stored
            if (!originalDistrictOptions || originalDistrictOptions.length === 0) {
                window.storeOriginalDistrictOptions();
            }
            filterDistrictsByCity(originalDistrictOptions);
        });
    }
    
    // Emergency contact search and filter handlers
    const emergencyContactSearch = document.getElementById('emergency-contact-search');
    const emergencyContactSearchBtn = document.getElementById('emergency-contact-search-btn');
    const emergencyContactClearSearch = document.getElementById('emergency-contact-clear-search');
    
    function filterEmergencyContacts() {
        const searchTerm = emergencyContactSearch ? emergencyContactSearch.value.toLowerCase().trim() : '';
        const activeCityFilter = document.querySelector('.filter-btn.active[data-filter-city]');
        const cityFilterId = activeCityFilter ? activeCityFilter.dataset.filterCity : 'all';
        
        const cards = document.querySelectorAll('.emergency-contact-card');
        let visibleCount = 0;
        
        cards.forEach(card => {
            const locationName = (card.dataset.locationName || '').toLowerCase();
            const cityId = card.dataset.cityId || '';
            const matchesSearch = !searchTerm || locationName.includes(searchTerm);
            const matchesCity = cityFilterId === 'all' || cityId === cityFilterId;
            
            if (matchesSearch && matchesCity) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        // Show/hide empty state
        const contactsList = document.getElementById('emergency-contacts-list');
        if (contactsList) {
            let emptyState = contactsList.querySelector('.empty-state');
            if (visibleCount === 0) {
                if (!emptyState) {
                    emptyState = document.createElement('div');
                    emptyState.className = 'empty-state';
                    emptyState.innerHTML = '<i class="fas fa-info-circle"></i><p>No emergency contacts found.</p>';
                    contactsList.appendChild(emptyState);
                }
            } else if (emptyState) {
                emptyState.remove();
            }
        }
        
        // Show/hide clear search button
        if (emergencyContactClearSearch) {
            emergencyContactClearSearch.style.display = searchTerm ? 'block' : 'none';
        }
    }
    
    if (emergencyContactSearch) {
        emergencyContactSearch.addEventListener('input', filterEmergencyContacts);
        emergencyContactSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterEmergencyContacts();
            }
        });
    }
    
    if (emergencyContactSearchBtn) {
        emergencyContactSearchBtn.addEventListener('click', filterEmergencyContacts);
    }
    
    if (emergencyContactClearSearch) {
        emergencyContactClearSearch.addEventListener('click', function() {
            if (emergencyContactSearch) {
                emergencyContactSearch.value = '';
                filterEmergencyContacts();
            }
        });
    }
    
    // City filter button handlers
    document.addEventListener('click', function(e) {
        const filterBtn = e.target.closest('.filter-btn[data-filter-city]');
        if (filterBtn) {
            // Update active state
            document.querySelectorAll('.filter-btn[data-filter-city]').forEach(btn => {
                btn.classList.remove('active');
            });
            filterBtn.classList.add('active');
            
            // Apply filter
            filterEmergencyContacts();
        }
    });

    const addAnnouncementBtn = document.getElementById('add-announcement-btn');
    if (addAnnouncementBtn) {
        addAnnouncementBtn.addEventListener('click', () => openAnnouncementModal());
    }

    // Safety Tip buttons - event delegation
    document.addEventListener('click', function(e) {
        if (e.target.closest('.edit-safety-tip-btn')) {
            const btn = e.target.closest('.edit-safety-tip-btn');
            const id = parseInt(btn.dataset.id);
            editSafetyTip(id);
        }
        if (e.target.closest('.delete-safety-tip-btn')) {
            const btn = e.target.closest('.delete-safety-tip-btn');
            const id = parseInt(btn.dataset.id);
            deleteSafetyTip(id);
        }
        if (e.target.closest('.edit-emergency-contact-btn')) {
            const btn = e.target.closest('.edit-emergency-contact-btn');
            const id = parseInt(btn.dataset.id);
            editEmergencyContact(id);
        }
        if (e.target.closest('.delete-emergency-contact-btn')) {
            const btn = e.target.closest('.delete-emergency-contact-btn');
            const id = parseInt(btn.dataset.id);
            deleteEmergencyContact(id);
        }
        if (e.target.closest('.edit-announcement-btn')) {
            const btn = e.target.closest('.edit-announcement-btn');
            const id = parseInt(btn.dataset.id);
            editAnnouncement(id);
        }
        if (e.target.closest('.delete-announcement-btn')) {
            const btn = e.target.closest('.delete-announcement-btn');
            const id = parseInt(btn.dataset.id);
            deleteAnnouncement(id);
        }
        if (e.target.closest('.close-safety-tip-modal')) {
            closeSafetyTipModal();
        }
        if (e.target.closest('.close-emergency-contact-modal')) {
            closeEmergencyContactModal();
        }
        if (e.target.closest('.close-announcement-modal')) {
            closeAnnouncementModal();
        }
    });
    
    // Delete dialog handlers for announcements
    const deleteDialogCancel = document.getElementById('delete-dialog-cancel');
    const deleteDialogConfirm = document.getElementById('delete-dialog-confirm');
    
    // Delete dialog handlers for safety tips
    const deleteSafetyTipDialogCancel = document.getElementById('delete-safety-tip-dialog-cancel');
    const deleteSafetyTipDialogConfirm = document.getElementById('delete-safety-tip-dialog-confirm');
    
    if (deleteDialogCancel) {
        deleteDialogCancel.addEventListener('click', closeDeleteDialog);
    }
    
    if (deleteDialogConfirm) {
        deleteDialogConfirm.addEventListener('click', confirmDeleteAnnouncement);
    }
    
    if (deleteSafetyTipDialogCancel) {
        deleteSafetyTipDialogCancel.addEventListener('click', closeDeleteSafetyTipDialog);
    }
    if (deleteSafetyTipDialogConfirm) {
        deleteSafetyTipDialogConfirm.addEventListener('click', confirmDeleteSafetyTip);
    }
    
    // Close announcement delete dialog when clicking overlay
    const deleteDialog = document.getElementById('delete-dialog');
    if (deleteDialog) {
        deleteDialog.addEventListener('click', function(e) {
            if (e.target === deleteDialog) {
                closeDeleteDialog();
            }
        });
    }
    
    // Emergency contact delete dialog handlers
    const deleteEmergencyContactDialogCancel = document.getElementById('delete-emergency-contact-dialog-cancel');
    const deleteEmergencyContactDialogConfirm = document.getElementById('delete-emergency-contact-dialog-confirm');
    
    if (deleteEmergencyContactDialogCancel) {
        deleteEmergencyContactDialogCancel.addEventListener('click', closeDeleteEmergencyContactDialog);
    }
    
    if (deleteEmergencyContactDialogConfirm) {
        deleteEmergencyContactDialogConfirm.addEventListener('click', confirmDeleteEmergencyContact);
    }
    
    // Close emergency contact delete dialog when clicking overlay
    const deleteEmergencyContactDialog = document.getElementById('delete-emergency-contact-dialog');
    if (deleteEmergencyContactDialog) {
        deleteEmergencyContactDialog.addEventListener('click', function(e) {
            if (e.target === deleteEmergencyContactDialog) {
                closeDeleteEmergencyContactDialog();
            }
        });
    }
    
    // Image modal handlers
    const imageModal = document.getElementById('image-modal');
    const imageModalImg = document.getElementById('image-modal-img');
    const imageModalTitle = document.getElementById('image-modal-title');
    const imageModalClose = document.getElementById('image-modal-close');
    const imageModalOverlay = imageModal ? imageModal.querySelector('.image-modal-overlay') : null;
    
    // Handle image clicks - make the entire image container clickable
    // Use event delegation on the announcements list
    const announcementsList = document.getElementById('announcements-list');
    if (announcementsList) {
        announcementsList.addEventListener('click', function(e) {
            // Check if clicking on the image container or image itself
            const imageContainer = e.target.closest('.announcement-card-image');
            if (imageContainer) {
                e.preventDefault();
                e.stopPropagation();
                
                // Get data attributes from the container (or fallback to image element)
                const imageUrl = imageContainer.dataset.imageUrl || 
                                (imageContainer.querySelector('.announcement-image-clickable')?.dataset.imageUrl);
                const imageTitle = imageContainer.dataset.imageTitle || 
                                  (imageContainer.querySelector('.announcement-image-clickable')?.dataset.imageTitle);
                
                if (imageUrl) {
                    openImageModal(imageUrl, imageTitle);
                } else {
                    console.error('Image URL not found in data attributes');
                }
            }
        });
    }
    
    // Close image modal
    if (imageModalClose) {
        imageModalClose.addEventListener('click', closeImageModal);
    }
    
    if (imageModalOverlay) {
        imageModalOverlay.addEventListener('click', closeImageModal);
    }
    
    // Close image modal on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && imageModal && imageModal.classList.contains('active')) {
            closeImageModal();
        }
    });
    
    // Card expand/collapse handlers
    document.addEventListener('click', function(e) {
        // Don't toggle if clicking on action buttons or images
        if (e.target.closest('.announcement-card-actions') || 
            e.target.closest('.announcement-card-image') ||
            e.target.closest('.btn-icon')) {
            return;
        }
        
        const toggle = e.target.closest('.announcement-card-toggle');
        if (toggle) {
            e.preventDefault();
            e.stopPropagation();
            const card = toggle.closest('.announcement-card');
            if (card) {
                card.classList.toggle('expanded');
            }
        }
    });
});

// Safety Tip Functions
function openSafetyTipModal(id = null) {
    const modal = document.getElementById('safety-tip-modal');
    const overlay = document.getElementById('modal-overlay');
    const form = document.getElementById('safety-tip-form');
    const title = document.getElementById('safety-tip-modal-title');
    
    if (id) {
        // Edit mode - load data
        title.textContent = 'Edit Safety Tip';
        // You would fetch the tip data here and populate the form
        // For now, we'll handle it in the edit function
    } else {
        // Create mode
        title.textContent = 'Add Safety Tip';
        form.reset();
        document.getElementById('safety-tip-id').value = '';
        document.getElementById('safety-tip-content').value = '';
    }
    
    modal.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSafetyTipModal() {
    const modal = document.getElementById('safety-tip-modal');
    const overlay = document.getElementById('modal-overlay');
    modal.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function editSafetyTip(id) {
    // Fetch tip data from server
    fetch(`/admin-panel/alerts/safety-tip/?id=${id}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.tip) {
                openSafetyTipModal(id);
                // Populate form fields
                document.getElementById('safety-tip-id').value = data.tip.id;
                document.getElementById('safety-tip-content').value = data.tip.content || '';
            } else {
                alert('Error: ' + (data.error || 'Failed to load safety tip'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error loading safety tip');
        });
}

function deleteSafetyTip(id) {
    deleteSafetyTipId = id;
    const deleteDialog = document.getElementById('delete-safety-tip-dialog');
    if (deleteDialog) {
        deleteDialog.classList.add('active');
        document.getElementById('modal-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        // Fallback to confirm if dialog doesn't exist
        if (confirm('Are you sure you want to delete this safety tip?')) {
            confirmDeleteSafetyTip();
        }
    }
}

function confirmDeleteSafetyTip() {
    if (!deleteSafetyTipId) return;
    
    fetch('/admin-panel/alerts/safety-tip/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({
            action: 'delete',
            id: deleteSafetyTipId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const tipCard = document.querySelector(`.safety-tip-card[data-id="${deleteSafetyTipId}"]`);
            if (tipCard) {
                tipCard.style.transition = 'opacity 0.3s ease';
                tipCard.style.opacity = '0';
                setTimeout(() => {
                    tipCard.remove();
                    // Check if list is empty
                    const list = document.getElementById('safety-tips-list');
                    if (list && list.querySelectorAll('.safety-tip-card').length === 0) {
                        list.innerHTML = '<div class="empty-state"><i class="fas fa-info-circle"></i><p>No safety tips yet. Click "Add Safety Tip" to create one.</p></div>';
                    }
                }, 300);
            }
            closeDeleteSafetyTipDialog();
            showToast('Safety tip deleted successfully', 'success');
        } else {
            showToast('Error: ' + (data.error || 'Failed to delete safety tip'), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error deleting safety tip', 'error');
    });
}

function closeDeleteSafetyTipDialog() {
    deleteSafetyTipId = null;
    const deleteDialog = document.getElementById('delete-safety-tip-dialog');
    if (deleteDialog) {
        deleteDialog.classList.remove('active');
    }
    document.getElementById('modal-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

function saveSafetyTip() {
    const form = document.getElementById('safety-tip-form');
    const id = document.getElementById('safety-tip-id').value;
    const content = document.getElementById('safety-tip-content').value;
    
    if (!content.trim()) {
        alert('Please enter safety tip content');
        return;
    }
    
    const data = {
        action: id ? 'update' : 'create',
        id: id || null,
        content: content
    };
    
    fetch('/admin-panel/alerts/safety-tip/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeSafetyTipModal();
            if (id) {
                updateSafetyTipCard(data.tip);
            } else {
                addSafetyTipCard(data.tip);
            }
            showToast(id ? 'Safety tip updated successfully' : 'Safety tip created successfully', 'success');
        } else {
            showToast('Error: ' + (data.error || 'Failed to save safety tip'), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error saving safety tip', 'error');
    });
}

function addSafetyTipCard(tip) {
    const list = document.getElementById('safety-tips-list');
    if (!list) return;
    
    // Remove empty state if exists
    const emptyState = list.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    const card = document.createElement('div');
    card.className = 'safety-tip-card';
    card.setAttribute('data-id', tip.id);
    
    const createdDate = new Date(tip.created_at);
    const formattedDate = createdDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    
    card.innerHTML = `
        <div class="safety-tip-card-header">
            <div class="safety-tip-card-actions">
                <button class="btn-icon edit-safety-tip-btn" data-id="${tip.id}" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger delete-safety-tip-btn" data-id="${tip.id}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="safety-tip-card-content">
            <p>${escapeHtml(tip.content)}</p>
        </div>
        <div class="safety-tip-card-footer">
            <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
        </div>
    `;
    
    list.insertBefore(card, list.firstChild);
}

function updateSafetyTipCard(tip) {
    const card = document.querySelector(`.safety-tip-card[data-id="${tip.id}"]`);
    if (!card) return;
    
    const createdDate = new Date(tip.created_at);
    const formattedDate = createdDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    
    card.querySelector('.safety-tip-card-content p').textContent = tip.content;
    card.querySelector('.safety-tip-card-footer').innerHTML = `<span><i class="fas fa-calendar"></i> ${formattedDate}</span>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Store original district options globally (outside DOMContentLoaded)
let originalDistrictOptions = null;

// Store delete IDs globally
let deleteSafetyTipId = null;

// Make function accessible globally
window.storeOriginalDistrictOptions = function(force = false) {
    const districtSelect = document.getElementById('emergency-contact-district');
    if (districtSelect) {
        // If we already have options stored and not forcing, check if we have enough
        if (!force && originalDistrictOptions && originalDistrictOptions.length > 0) {
            return; // Already stored
        }
        
        // Store all options including the empty one
        const allOptions = Array.from(districtSelect.querySelectorAll('option'));
        const stored = allOptions.map(opt => ({
            value: opt.value,
            text: opt.textContent,
            cityId: opt.dataset.cityId || ''
        }));
        // Only store non-empty options for filtering
        originalDistrictOptions = stored.filter(opt => opt.value !== '');
        
        // Debug log
        console.log('Stored district options:', originalDistrictOptions.length);
    }
};

// Emergency Contact Functions
function openEmergencyContactModal(id = null, locationType = null, locationName = null, districtId = null) {
    const modal = document.getElementById('emergency-contact-modal');
    const overlay = document.getElementById('modal-overlay');
    const form = document.getElementById('emergency-contact-form');
    const title = document.getElementById('emergency-contact-modal-title');
    const locationGroup = document.getElementById('emergency-contact-location-group');
    const districtGroup = document.getElementById('emergency-contact-district-group');
    const districtSelect = document.getElementById('emergency-contact-district');
    const citySelect = document.getElementById('emergency-contact-city');
    const cityGroup = document.getElementById('emergency-contact-city-group');
    
    if (id) {
        title.textContent = 'Edit Emergency Contact';
        // Hide city and district fields when editing (we already know which district)
        if (locationGroup) {
            locationGroup.style.display = 'none';
        }
        // Fetch contact data for editing
        fetch(`/admin-panel/alerts/location-contact/?id=${id}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.contact) {
                    document.getElementById('emergency-contact-id').value = data.contact.id;
                    document.getElementById('emergency-contact-label').value = data.contact.label;
                    document.getElementById('emergency-contact-phone').value = data.contact.phone;
                    // Pre-fill district (hidden) for form submission
                    if (districtSelect) {
                        districtSelect.value = data.contact.district_id || '';
                        districtSelect.disabled = false; // Enable for form submission
                    }
                }
            });
    } else {
        title.textContent = 'Add Emergency Contact';
        
        // Reset form first
        form.reset();
        document.getElementById('emergency-contact-id').value = '';
        
        // Always restore ALL original district options from stored variable
        // This ensures we have all options available even if modal was closed/opened multiple times
        if (districtSelect) {
            // After form.reset(), the select might have been reset to template state
            // But we need to ensure we have the original options stored
            // Try to get fresh options from DOM first (after reset, they should be there)
            const currentOptions = Array.from(districtSelect.querySelectorAll('option[data-city-id]'));
            if (currentOptions.length > 0 && (!originalDistrictOptions || originalDistrictOptions.length === 0)) {
                // Store from current DOM state
                originalDistrictOptions = currentOptions.map(opt => ({
                    value: opt.value,
                    text: opt.textContent,
                    cityId: opt.dataset.cityId || ''
                }));
            } else if (!originalDistrictOptions || originalDistrictOptions.length === 0) {
                // Force re-store
                window.storeOriginalDistrictOptions(true);
            }
            
            // Always restore ALL original district options (even if they're already there from reset)
            // This ensures consistency
            districtSelect.innerHTML = '<option value="">Select District</option>';
            if (originalDistrictOptions && originalDistrictOptions.length > 0) {
                originalDistrictOptions.forEach(optData => {
                    if (optData.value) {
                        const option = document.createElement('option');
                        option.value = optData.value;
                        option.textContent = optData.text;
                        option.dataset.cityId = optData.cityId || '';
                        districtSelect.appendChild(option);
                    }
                });
            } else {
                // Last resort: if we still don't have options, log error
                console.error('Could not restore district options. originalDistrictOptions:', originalDistrictOptions);
            }
        }
        
        // If adding from a specific district card, pre-fill and hide both city and district fields
        if (districtId && locationType === 'district') {
            if (districtSelect) {
                districtSelect.value = districtId;
                districtSelect.disabled = false; // Enable for form submission
                // Load city based on selected district
                updateCityFromDistrict(districtId);
            }
            // Hide both city and district fields since we already know which district
            if (locationGroup) {
                locationGroup.style.display = 'none';
            }
        } else {
            // Show both city and district fields if adding from main button
            if (locationGroup) {
                locationGroup.style.display = 'flex';
            }
            // Reset and disable district dropdown until city is selected
            if (districtSelect) {
                districtSelect.value = '';
                districtSelect.disabled = true;
                // Update placeholder text
                const firstOption = districtSelect.querySelector('option[value=""]');
                if (firstOption) {
                    firstOption.textContent = 'Select City First';
                }
            }
            if (citySelect) {
                citySelect.value = '';
            }
            // Call filter to set initial state (disabled) - this will use the restored options
            filterDistrictsByCity(originalDistrictOptions);
        }
    }
    
    modal.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Function to update city dropdown based on selected district
function updateCityFromDistrict(districtId) {
    const districtSelect = document.getElementById('emergency-contact-district');
    const citySelect = document.getElementById('emergency-contact-city');
    if (!districtSelect || !citySelect) return;
    
    // Find the option with the district ID (check all options, including hidden ones)
    const allOptions = Array.from(document.querySelectorAll('#emergency-contact-district option[data-city-id]'));
    const selectedOption = allOptions.find(opt => opt.value === districtId.toString());
    
    if (selectedOption) {
        const cityId = selectedOption.dataset.cityId;
        if (cityId) {
            citySelect.value = cityId;
            // Don't call filterDistrictsByCity here since we're pre-filling from a card
            // Just enable the district select
            if (districtSelect) {
                districtSelect.disabled = false;
            }
        }
    }
}

// Function to filter districts based on selected city
function filterDistrictsByCity(originalOptions = null) {
    const citySelect = document.getElementById('emergency-contact-city');
    const districtSelect = document.getElementById('emergency-contact-district');
    
    if (!citySelect || !districtSelect) return;
    
    const selectedCityId = citySelect.value;
    
    if (!selectedCityId) {
        // No city selected - disable district dropdown
        districtSelect.disabled = true;
        districtSelect.value = '';
        districtSelect.innerHTML = '<option value="">Select City First</option>';
        return;
    }
    
    // Enable district dropdown
    districtSelect.disabled = false;
    
    // Get original options if not provided - use stored global variable
    if (!originalOptions) {
        if (originalDistrictOptions && originalDistrictOptions.length > 0) {
            originalOptions = originalDistrictOptions;
        } else {
            // Fallback: get from DOM if stored options not available
            window.storeOriginalDistrictOptions();
            originalOptions = originalDistrictOptions;
        }
    }
    
    if (!originalOptions || originalOptions.length === 0) {
        console.error('No original district options available');
        return;
    }
    
    const currentValue = districtSelect.value;
    
    // Clear and rebuild options
    districtSelect.innerHTML = '<option value="">Select District</option>';
    
    // Add districts that match the selected city (compare as strings)
    let foundDistricts = false;
    originalOptions.forEach(optData => {
        // Skip empty options
        if (!optData.value) return;
        
        // Compare city IDs as strings
        const optCityId = String(optData.cityId || '');
        const selectedCityIdStr = String(selectedCityId || '');
        
        if (optCityId === selectedCityIdStr && optCityId !== '') {
            const option = document.createElement('option');
            option.value = optData.value;
            option.textContent = optData.text;
            option.dataset.cityId = optData.cityId || '';
            districtSelect.appendChild(option);
            foundDistricts = true;
        }
    });
    
    // If no districts found, show a message
    if (!foundDistricts) {
        districtSelect.innerHTML = '<option value="">No districts available for this city</option>';
        districtSelect.disabled = true;
    }
    
    // Reset selection if current value is not in the filtered list
    const availableOptions = Array.from(districtSelect.querySelectorAll('option')).map(opt => opt.value);
    if (currentValue && !availableOptions.includes(currentValue)) {
        districtSelect.value = '';
    }
}

function closeEmergencyContactModal() {
    const modal = document.getElementById('emergency-contact-modal');
    const overlay = document.getElementById('modal-overlay');
    modal.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function editEmergencyContact(id) {
    openEmergencyContactModal(id);
}

let deleteEmergencyContactId = null;

function deleteEmergencyContact(id) {
    deleteEmergencyContactId = id;
    const dialog = document.getElementById('delete-emergency-contact-dialog');
    if (dialog) {
        dialog.classList.add('active');
    }
}

function confirmDeleteEmergencyContact() {
    if (!deleteEmergencyContactId) return;
    
    const id = deleteEmergencyContactId;
    deleteEmergencyContactId = null;
    
    fetch('/admin-panel/alerts/location-contact/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({
            action: 'delete',
            id: id
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeDeleteEmergencyContactDialog();
            // Remove the contact item from DOM
            const contactItem = document.querySelector(`.emergency-contact-item[data-id="${id}"]`);
            if (contactItem) {
                contactItem.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    contactItem.remove();
                    // Check if the card is now empty
                    const card = contactItem.closest('.emergency-contact-card');
                    if (card) {
                        const list = card.querySelector('.emergency-contact-list');
                        if (list && list.children.length === 0) {
                            card.remove();
                            // Check if list is empty
                            const contactsList = document.getElementById('emergency-contacts-list');
                            if (contactsList && contactsList.children.length === 0) {
                                contactsList.innerHTML = '<div class="empty-state"><i class="fas fa-info-circle"></i><p>No emergency contacts yet. Click "Add Emergency Contact" to create one.</p></div>';
                            }
                        }
                    }
                }, 300);
            }
            showToast('Emergency contact deleted successfully', 'success');
        } else {
            showToast('Error: ' + (data.error || 'Failed to delete emergency contact'), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error deleting emergency contact', 'error');
    });
}

function closeDeleteEmergencyContactDialog() {
    const dialog = document.getElementById('delete-emergency-contact-dialog');
    if (dialog) {
        dialog.classList.remove('active');
    }
    deleteEmergencyContactId = null;
}

function saveEmergencyContact() {
    const id = document.getElementById('emergency-contact-id').value;
    const districtId = document.getElementById('emergency-contact-district').value;
    
    if (!districtId) {
        showToast('Please select a district', 'error');
        return;
    }
    
    const data = {
        action: id ? 'update' : 'create',
        id: id || null,
        label: document.getElementById('emergency-contact-label').value,
        phone: document.getElementById('emergency-contact-phone').value,
        district_id: districtId
    };
    
    fetch('/admin-panel/alerts/location-contact/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeEmergencyContactModal();
            showToast(id ? 'Emergency contact updated successfully' : 'Emergency contact created successfully', 'success');
            
            if (data.contact) {
                if (id) {
                    // Update existing contact
                    updateEmergencyContactItem(data.contact);
                } else {
                    // Add new contact
                    addEmergencyContactItem(data.contact);
                }
            }
        } else {
            showToast('Error: ' + (data.error || 'Failed to save emergency contact'), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error saving emergency contact', 'error');
    });
}

// Function to add a new emergency contact item to the DOM
function addEmergencyContactItem(contact) {
    const contactsList = document.getElementById('emergency-contacts-list');
    if (!contactsList) return;
    
    // Remove empty state if it exists
    const emptyState = contactsList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    const locationType = 'district';
    const locationName = contact.district;
    const locationKey = `district_${contact.district_id}`;
    
    // Find or create the card for this location
    let card = contactsList.querySelector(`.emergency-contact-card[data-location-type="${locationType}"][data-location-name="${locationName}"]`);
    
    if (!card) {
        // Create new card
        const cardHTML = `
            <div class="emergency-contact-card" data-location-type="${locationType}" data-location-name="${locationName}">
                <div class="emergency-contact-card-header">
                    <div class="emergency-contact-location">
                        <i class="fas fa-map-marker-alt"></i>
                        <h3>${escapeHtml(locationName)}</h3>
                    </div>
                    <button class="btn-icon emergency-contact-add-btn" data-location-type="${locationType}" data-location-name="${escapeHtml(locationName)}" data-district-id="${contact.district_id}" title="Add Contact">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="emergency-contact-card-body">
                    <ul class="emergency-contact-list"></ul>
                </div>
            </div>
        `;
        contactsList.insertAdjacentHTML('beforeend', cardHTML);
        card = contactsList.querySelector(`.emergency-contact-card[data-location-type="${locationType}"][data-location-name="${locationName}"]`);
    }
    
    const list = card.querySelector('.emergency-contact-list');
    const itemHTML = `
        <li class="emergency-contact-item" data-id="${contact.id}">
            <div class="emergency-contact-info">
                <span class="emergency-contact-label">${escapeHtml(contact.label)}</span>
                <a href="tel:${escapeHtml(contact.phone)}" class="emergency-contact-phone">
                    <i class="fas fa-phone"></i> ${escapeHtml(contact.phone)}
                </a>
            </div>
            <div class="emergency-contact-actions">
                <button class="btn-icon-sm edit-emergency-contact-btn" data-id="${contact.id}" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon-sm btn-danger delete-emergency-contact-btn" data-id="${contact.id}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </li>
    `;
    list.insertAdjacentHTML('beforeend', itemHTML);
}

// Function to update an existing emergency contact item
function updateEmergencyContactItem(contact) {
    const item = document.querySelector(`.emergency-contact-item[data-id="${contact.id}"]`);
    if (!item) {
        // If item doesn't exist, add it
        addEmergencyContactItem(contact);
        return;
    }
    
    // Update label and phone
    const labelEl = item.querySelector('.emergency-contact-label');
    const phoneEl = item.querySelector('.emergency-contact-phone');
    
    if (labelEl) {
        labelEl.textContent = contact.label;
    }
    if (phoneEl) {
        phoneEl.href = `tel:${contact.phone}`;
        phoneEl.innerHTML = `<i class="fas fa-phone"></i> ${escapeHtml(contact.phone)}`;
    }
    
    // If location changed, move the item to the correct card
    const currentCard = item.closest('.emergency-contact-card');
    const locationType = 'district';
    const locationName = contact.district;
    
    if (!currentCard || 
        currentCard.dataset.locationType !== locationType || 
        currentCard.dataset.locationName !== locationName) {
        // Location changed, need to move item
        const contactsList = document.getElementById('emergency-contacts-list');
        let newCard = contactsList.querySelector(`.emergency-contact-card[data-location-type="${locationType}"][data-location-name="${locationName}"]`);
        
        if (!newCard) {
            // Create new card
            const cardHTML = `
                <div class="emergency-contact-card" data-location-type="${locationType}" data-location-name="${locationName}">
                    <div class="emergency-contact-card-header">
                        <div class="emergency-contact-location">
                            <i class="fas fa-map-marker-alt"></i>
                            <h3>${escapeHtml(locationName)}</h3>
                        </div>
                        <button class="btn-icon emergency-contact-add-btn" data-location-type="${locationType}" data-location-name="${escapeHtml(locationName)}" data-district-id="${contact.district_id}" title="Add Contact">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="emergency-contact-card-body">
                        <ul class="emergency-contact-list"></ul>
                    </div>
                </div>
            `;
            contactsList.insertAdjacentHTML('beforeend', cardHTML);
            newCard = contactsList.querySelector(`.emergency-contact-card[data-location-type="${locationType}"][data-location-name="${locationName}"]`);
        }
        
        const newList = newCard.querySelector('.emergency-contact-list');
        newList.appendChild(item);
        
        // Remove old card if empty
        const oldList = currentCard.querySelector('.emergency-contact-list');
        if (oldList && oldList.children.length === 0) {
            currentCard.remove();
        }
    }
}

// Announcement Functions
function openAnnouncementModal(id = null) {
    const modal = document.getElementById('announcement-modal');
    const overlay = document.getElementById('modal-overlay');
    const form = document.getElementById('announcement-form');
    const title = document.getElementById('announcement-modal-title');
    const imagePreview = document.getElementById('announcement-image-preview');
    const imagePreviewImg = document.getElementById('announcement-image-preview-img');
    
    if (!id) {
        // Create mode - reset form
        title.textContent = 'Add Announcement';
        form.reset();
        document.getElementById('announcement-id').value = '';
        document.getElementById('announcement-community').value = '';
        if (imagePreview) {
            imagePreview.style.display = 'none';
        }
        // Set default start date to now
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('announcement-start-date').value = now.toISOString().slice(0, 16);
    } else {
        // Edit mode - will be populated by editAnnouncement function
        title.textContent = 'Edit Announcement';
    }
    
    // Image preview handler
    const imageInput = document.getElementById('announcement-image');
    if (imageInput) {
        imageInput.onchange = function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    imagePreviewImg.src = e.target.result;
                    imagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                imagePreview.style.display = 'none';
            }
        };
    }
    
    modal.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAnnouncementModal() {
    const modal = document.getElementById('announcement-modal');
    const overlay = document.getElementById('modal-overlay');
    modal.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

let deleteAnnouncementId = null;

function editAnnouncement(id) {
    // Fetch announcement data first
    fetch(`/admin-panel/alerts/announcement/?id=${id}`, {
        method: 'GET',
        headers: {
            'X-CSRFToken': getCookie('csrftoken'),
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.announcement) {
            const ann = data.announcement;
            openAnnouncementModal(id);
            
            // Populate form fields
            document.getElementById('announcement-id').value = ann.id;
            document.getElementById('announcement-title').value = ann.title;
            document.getElementById('announcement-content').value = ann.content;
            document.getElementById('announcement-community').value = ann.community_id || '';
            
            // Set dates (convert ISO to local datetime format)
            if (ann.start_date) {
                const startDate = new Date(ann.start_date);
                startDate.setMinutes(startDate.getMinutes() - startDate.getTimezoneOffset());
                document.getElementById('announcement-start-date').value = startDate.toISOString().slice(0, 16);
            }
            
            if (ann.end_date) {
                const endDate = new Date(ann.end_date);
                endDate.setMinutes(endDate.getMinutes() - endDate.getTimezoneOffset());
                document.getElementById('announcement-end-date').value = endDate.toISOString().slice(0, 16);
            }
            
            // Show existing image if available
            const imagePreview = document.getElementById('announcement-image-preview');
            const imagePreviewImg = document.getElementById('announcement-image-preview-img');
            if (ann.image_url) {
                imagePreviewImg.src = ann.image_url;
                imagePreview.style.display = 'block';
            } else {
                imagePreview.style.display = 'none';
            }
        } else {
            showToast('Error loading announcement data', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error loading announcement data', 'error');
    });
}

function deleteAnnouncement(id) {
    deleteAnnouncementId = id;
    const dialog = document.getElementById('delete-dialog');
    if (dialog) {
        dialog.classList.add('active');
    }
}

function confirmDeleteAnnouncement() {
    if (!deleteAnnouncementId) return;
    
    const id = deleteAnnouncementId;
    deleteAnnouncementId = null;
    
    fetch('/admin-panel/alerts/announcement/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({
            action: 'delete',
            id: id
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeDeleteDialog();
            showToast('Announcement deleted successfully', 'success');
            
            // Refresh announcements list via AJAX
            const currentPage = getCurrentAnnouncementPage();
            updateAnnouncements(currentPage);
        } else {
            showToast('Error: ' + (data.error || 'Failed to delete announcement'), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error deleting announcement', 'error');
    });
}

function closeDeleteDialog() {
    const dialog = document.getElementById('delete-dialog');
    if (dialog) {
        dialog.classList.remove('active');
    }
    deleteAnnouncementId = null;
}

let isSavingAnnouncement = false;

function saveAnnouncement() {
    if (isSavingAnnouncement) return; // Prevent duplicate submissions
    
    const form = document.getElementById('announcement-form');
    const formData = new FormData(form);
    const id = document.getElementById('announcement-id').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Disable submit button
    isSavingAnnouncement = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }
    
    formData.append('action', id ? 'update' : 'create');
    if (id) {
        formData.append('id', id);
    }
    
    // Convert local datetime to ISO format for backend
    const startDate = document.getElementById('announcement-start-date').value;
    const endDate = document.getElementById('announcement-end-date').value;
    
    if (startDate) {
        const startDateISO = new Date(startDate).toISOString();
        formData.set('start_date', startDateISO);
    }
    
    if (endDate) {
        const endDateISO = new Date(endDate).toISOString();
        formData.set('end_date', endDateISO);
    }
    
    fetch('/admin-panel/alerts/announcement/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        isSavingAnnouncement = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save';
        }
        
        if (data.success) {
            closeAnnouncementModal();
            showToast(id ? 'Announcement updated successfully' : 'Announcement created successfully', 'success');
            
            // Refresh announcements list via AJAX (go to page 1 for new announcements, stay on current page for updates)
            const currentPage = getCurrentAnnouncementPage();
            if (id) {
                // Update: stay on current page
                updateAnnouncements(currentPage);
            } else {
                // Create: go to page 1 to show the new announcement
                updateAnnouncements(1);
            }
        } else {
            showToast('Error: ' + (data.error || 'Failed to save announcement'), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        isSavingAnnouncement = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save';
        }
        showToast('Error saving announcement', 'error');
    });
}

function closeAllModals() {
    closeSafetyTipModal();
    closeEmergencyContactModal();
    closeAnnouncementModal();
    closeDeleteDialog();
}

// Toast Notification Functions
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info} toast-icon"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, 5000);
}

// Add slideOutRight animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Image Modal Functions (defined before DOMContentLoaded so they're available)
function openImageModal(imageUrl, imageTitle) {
    const imageModal = document.getElementById('image-modal');
    const imageModalImg = document.getElementById('image-modal-img');
    const imageModalTitle = document.getElementById('image-modal-title');
    
    if (imageModal && imageModalImg) {
        imageModalImg.src = imageUrl;
        imageModalImg.alt = imageTitle || 'Announcement Image';
        if (imageModalTitle) {
            imageModalTitle.textContent = imageTitle || '';
        }
        imageModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        console.error('Image modal elements not found');
    }
}

function closeImageModal() {
    const imageModal = document.getElementById('image-modal');
    if (imageModal) {
        imageModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Function to add a new announcement card to the DOM
function addAnnouncementCard(announcement) {
    const announcementsList = document.getElementById('announcements-list');
    if (!announcementsList) return;
    
    // Remove empty state if it exists
    const emptyState = announcementsList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    // Format dates
    const startDate = new Date(announcement.start_date);
    const startDateFormatted = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    let endDateFormatted = '';
    if (announcement.end_date) {
        const endDate = new Date(announcement.end_date);
        endDateFormatted = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    // Create card HTML
    const cardHTML = `
        <div class="announcement-card" data-id="${announcement.id}">
            ${announcement.image_url ? `
            <div class="announcement-card-image" data-image-url="${announcement.image_url}" data-image-title="${escapeHtml(announcement.title)}">
              <img src="${announcement.image_url}" alt="${escapeHtml(announcement.title)}" class="announcement-image-clickable">
              <div class="image-overlay">
                <i class="fas fa-expand"></i>
              </div>
            </div>
            ` : ''}
            <div class="announcement-card-content">
              <div class="announcement-card-header">
                <h3 class="announcement-card-title announcement-card-toggle">${escapeHtml(announcement.title)}</h3>
                <div class="announcement-card-actions">
                  <button class="btn-icon edit-announcement-btn" data-id="${announcement.id}" title="Edit">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn-icon btn-danger delete-announcement-btn" data-id="${announcement.id}" title="Delete">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="announcement-card-body announcement-card-collapsible">
                <p class="announcement-card-text">${escapeHtml(announcement.content).replace(/\n/g, '<br>')}</p>
              </div>
              <div class="announcement-card-footer">
                <span class="announcement-badge ${announcement.community_id ? 'community-specific' : 'all-communities'}">
                  <i class="fas fa-${announcement.community_id ? 'building' : 'globe'}"></i>
                  ${announcement.community_name || 'All Communities'}
                </span>
                <div class="announcement-dates">
                  <span><i class="fas fa-calendar"></i> ${startDateFormatted}</span>
                  ${announcement.end_date ? `<span><i class="fas fa-calendar-times"></i> ${endDateFormatted}</span>` : ''}
                </div>
              </div>
            </div>
          </div>
    `;
    
    // Insert at the beginning of the list
    announcementsList.insertAdjacentHTML('afterbegin', cardHTML);
    
    // Add fade-in animation
    const newCard = announcementsList.querySelector(`.announcement-card[data-id="${announcement.id}"]`);
    if (newCard) {
        newCard.style.opacity = '0';
        newCard.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            newCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            newCard.style.opacity = '1';
            newCard.style.transform = 'translateY(0)';
        }, 10);
    }
}

// Function to update an existing announcement card
function updateAnnouncementCard(announcement) {
    const card = document.querySelector(`.announcement-card[data-id="${announcement.id}"]`);
    if (!card) {
        // If card doesn't exist, add it
        addAnnouncementCard(announcement);
        return;
    }
    
    // Format dates
    const startDate = new Date(announcement.start_date);
    const startDateFormatted = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    let endDateFormatted = '';
    if (announcement.end_date) {
        const endDate = new Date(announcement.end_date);
        endDateFormatted = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    // Update title
    const titleEl = card.querySelector('.announcement-card-title');
    if (titleEl) {
        titleEl.textContent = announcement.title;
    }
    
    // Update content
    const contentEl = card.querySelector('.announcement-card-text');
    if (contentEl) {
        contentEl.innerHTML = escapeHtml(announcement.content).replace(/\n/g, '<br>');
    }
    
    // Update image if it exists or was added
    const imageContainer = card.querySelector('.announcement-card-image');
    if (announcement.image_url) {
        if (!imageContainer) {
            // Add image container if it doesn't exist
            const cardContent = card.querySelector('.announcement-card-content');
            if (cardContent) {
                const imageHTML = `
                    <div class="announcement-card-image" data-image-url="${announcement.image_url}" data-image-title="${escapeHtml(announcement.title)}">
                      <img src="${announcement.image_url}" alt="${escapeHtml(announcement.title)}" class="announcement-image-clickable">
                      <div class="image-overlay">
                        <i class="fas fa-expand"></i>
                      </div>
                    </div>
                `;
                cardContent.insertAdjacentHTML('beforebegin', imageHTML);
            }
        } else {
            // Update existing image
            const img = imageContainer.querySelector('img');
            if (img) {
                img.src = announcement.image_url;
                img.alt = announcement.title;
            }
            imageContainer.dataset.imageUrl = announcement.image_url;
            imageContainer.dataset.imageTitle = announcement.title;
        }
    } else if (imageContainer) {
        // Remove image if it was removed
        imageContainer.remove();
    }
    
    // Update badge
    const badge = card.querySelector('.announcement-badge');
    if (badge) {
        badge.className = `announcement-badge ${announcement.community_id ? 'community-specific' : 'all-communities'}`;
        badge.innerHTML = `
            <i class="fas fa-${announcement.community_id ? 'building' : 'globe'}"></i>
            ${announcement.community_name || 'All Communities'}
        `;
    }
    
    // Update dates
    const datesEl = card.querySelector('.announcement-dates');
    if (datesEl) {
        datesEl.innerHTML = `
            <span><i class="fas fa-calendar"></i> ${startDateFormatted}</span>
            ${announcement.end_date ? `<span><i class="fas fa-calendar-times"></i> ${endDateFormatted}</span>` : ''}
        `;
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Get CSRF token from cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
