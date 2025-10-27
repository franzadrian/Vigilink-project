// Emergency Contacts Filter System
document.addEventListener('DOMContentLoaded', function() {
    const communityContactsData = document.getElementById('community-contacts-data');
    const locationContactsData = document.getElementById('location-contacts-data');
    const contactsList = document.getElementById('emergency-contacts-list');
    const communityBtn = document.getElementById('show-community-contacts');
    const locationBtn = document.getElementById('show-location-contacts');
    
    if (!communityContactsData || !locationContactsData || !contactsList) {
        return; // Exit if required elements not found
    }
    
    let communityContacts = [];
    let locationContacts = [];
    
    try {
        communityContacts = JSON.parse(communityContactsData.textContent || '[]');
        locationContacts = JSON.parse(locationContactsData.textContent || '[]');
    } catch (e) {
        console.error('Error parsing contacts data:', e);
        return;
    }
    
    // Only show filter if community contacts exist
    if (communityContacts.length === 0) {
        return;
    }
    
    // Show community filter button
    if (communityBtn) {
        communityBtn.style.display = 'flex';
    }
    
    // Show location filter button only if location contacts exist
    if (locationBtn && locationContacts.length > 0) {
        locationBtn.style.display = 'flex';
    }
    
    // Render contacts dynamically
    function renderContacts(contacts) {
        contactsList.innerHTML = '';
        
        contacts.forEach(contact => {
            const li = document.createElement('li');
            li.className = 'contact-item';
            li.setAttribute('data-source', contact.source);
            
            li.innerHTML = `
                <span class="contact-label">${contact.label}</span>
                <a class="contact-number" href="tel:${contact.phone}">
                    <i class="fa-solid fa-phone"></i> ${contact.phone}
                </a>
            `;
            
            contactsList.appendChild(li);
        });
    }
    
    // Update active button
    function updateActiveButton(activeSource) {
        if (communityBtn && locationBtn) {
            communityBtn.classList.toggle('active', activeSource === 'community');
            locationBtn.classList.toggle('active', activeSource === 'location');
        }
    }
    
    // Event listeners for filter buttons
    if (communityBtn) {
        communityBtn.addEventListener('click', function() {
            renderContacts(communityContacts);
            updateActiveButton('community');
        });
    }
    
    if (locationBtn) {
        locationBtn.addEventListener('click', function() {
            renderContacts(locationContacts);
            updateActiveButton('location');
        });
    }
    
    // Initialize with community contacts (default)
    if (communityContacts.length > 0) {
        renderContacts(communityContacts);
        updateActiveButton('community');
    }
});