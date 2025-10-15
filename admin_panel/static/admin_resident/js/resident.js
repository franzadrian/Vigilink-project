// Current user being viewed/edited
let currentUser = null;
let currentRow = null;
        
// Add event listeners for dialog close buttons
function setupDialogCloseButtons() {
    // Success dialog close button
    document.getElementById('closeSuccessBtn').addEventListener('click', function() {
        document.getElementById('successDialog').style.display = 'none';
    });
    
    // Error dialog close button
    document.getElementById('closeErrorBtn').addEventListener('click', function() {
        document.getElementById('errorDialog').style.display = 'none';
    });
}
        
// Add event listeners for view resident buttons
document.addEventListener('DOMContentLoaded', function() {
    // Detect server-side pagination mode
    const serverPaginate = !!document.querySelector('[data-server-pagination="1"]');
    // Setup dialog close buttons
    setupDialogCloseButtons();
    
    // Setup remove buttons for all residents
    const removeButtons = document.querySelectorAll('.remove-btn');
    removeButtons.forEach(button => {
        const row = button.closest('tr');
        const userId = row.getAttribute('data-id');
        const userName = row.cells[0].textContent;
        
        // Set the data-id attribute on the button
        button.setAttribute('data-id', userId);
        
        // Add click event listener
        button.onclick = function() {
            removeResident(this, userName);
        };
    });
    
    // Load saved users from localStorage if available
    try {
        const storedUsers = JSON.parse(localStorage.getItem('vigilinkUsers')) || [];
        if (storedUsers.length > 0) {
            // Filter out deleted users from the table
            const tableRows = document.querySelectorAll('#residentsTableBody tr');
            tableRows.forEach(row => {
                const rowId = row.getAttribute('data-id');
                // Check if this row's user exists in localStorage
                const userExists = storedUsers.some(user => user.id == rowId);
                if (!userExists && rowId) {
                    // If user doesn't exist in localStorage, it was deleted
                    row.remove();
                }
            });
        }
    } catch (error) {
                console.warn('Could not load data from localStorage:', error);
            }
            
            const viewButtons = document.querySelectorAll('.view-resident-btn');
            viewButtons.forEach(button => {
                button.addEventListener('click', function(event) {
                    const btn = event.currentTarget;
                    viewResident(
                        btn.dataset.name,
                        btn.dataset.username,
                        btn.dataset.joined,
                        btn.dataset.address,
                        btn.dataset.block,
                        btn.dataset.lot,
                        btn.dataset.phone
                    );
                });
            });
        });
        
        // View resident functionality
function viewResident(name, username, dateJoined, address, block, lot, contact) {
    // Get the current row for later reference
    if (event && event.currentTarget) {
        currentRow = event.currentTarget.closest('tr');
    } else if (document.activeElement && document.activeElement.closest) {
        currentRow = document.activeElement.closest('tr');
    }
    
    // Get the user ID from the button's data attribute
    const userId = event && event.currentTarget ? event.currentTarget.dataset.id : null;
    
    const cells = currentRow ? currentRow.cells : [];
    
    // Create blockLot string from block and lot
    const blockLot = (block && lot) ? `Block ${block}, Lot ${lot}` : 'Not provided';
    
    // First try to get user data from server-rendered content
    currentUser = {
        id: userId, // Add the user ID
        name: name || (cells[0] ? cells[0].textContent : 'Not provided'),
        email: cells[1] ? cells[1].textContent : 'Not provided',
        location: cells[2] ? cells[2].textContent : 'Not provided',
        role: cells[3] ? cells[3].textContent : 'Not provided',
        // Extract city and district from location
        city: cells[2] ? cells[2].textContent.split(',')[1] ? cells[2].textContent.split(',')[1].trim() : cells[2].textContent.trim() : 'Not provided',
        district: cells[2] && cells[2].textContent.includes(',') ? cells[2].textContent.split(',')[0].trim() : 'Not provided',
        // Log extracted values for debugging
        _debug_location: cells[2] ? cells[2].textContent : 'Not provided',
        // Store the raw values to help with dropdown matching
        _raw_city: cells[2] ? cells[2].textContent.split(',')[1] ? cells[2].textContent.split(',')[1].trim() : cells[2].textContent.trim() : '',
        _raw_district: cells[2] && cells[2].textContent.includes(',') ? cells[2].textContent.split(',')[0].trim() : '',
        // Use the passed parameters or default to "Not provided"
        username: username || 'Not provided',
        dateJoined: dateJoined || 'Not provided',
        address: address || 'Not provided',
        block: block || '',
        lot: lot || '',
        blockLot: blockLot,
        contact: contact || 'Not provided'
    };
    
    // Store user in localStorage to ensure persistence after deletion
    try {
        const users = JSON.parse(localStorage.getItem('vigilinkUsers') || '[]');
        const userExists = users.some(user => user.id === userId);
        
        if (!userExists && userId) {
            users.push(currentUser);
            localStorage.setItem('vigilinkUsers', JSON.stringify(users));
        }
    } catch (error) {
        console.warn('Could not save to localStorage:', error);
    }
    
    // Populate the modal with user details
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userRole').textContent = currentUser.role;
    document.getElementById('userUsername').textContent = currentUser.username;
    document.getElementById('userContact').textContent = currentUser.contact;
    document.getElementById('userDateJoined').textContent = currentUser.dateJoined;
    document.getElementById('userCity').textContent = currentUser.city;
    document.getElementById('userDistrict').textContent = currentUser.district;
    document.getElementById('userAddress').textContent = currentUser.address;
    document.getElementById('userBlockLot').textContent = currentUser.blockLot;
    
    // Also populate the edit form fields
    document.getElementById('editName').value = currentUser.name;
    document.getElementById('editUsername').value = currentUser.username;
    document.getElementById('editEmail').value = currentUser.email;
    document.getElementById('editContact').value = currentUser.contact;
    document.getElementById('editRole').value = currentUser.role.toLowerCase();
    document.getElementById('editDateJoined').value = currentUser.dateJoined;
    
    // Set city dropdown value
    const cityDropdown = document.getElementById('editCity');
    if (cityDropdown) {
        console.log('Current user city:', currentUser.city);
        console.log('Raw city value:', currentUser._raw_city);
        
        // First try to find an exact match
        let cityFound = false;
        for (let i = 0; i < cityDropdown.options.length; i++) {
            if (cityDropdown.options[i].value.toLowerCase() === currentUser.city.toLowerCase()) {
                cityDropdown.selectedIndex = i;
                cityFound = true;
                console.log('City exact match found at index:', i);
                break;
            }
        }
        
        // If no exact match, try a more flexible approach
        if (!cityFound) {
            for (let i = 0; i < cityDropdown.options.length; i++) {
                // Skip the empty option
                if (cityDropdown.options[i].value === '') continue;
                
                // Try to find a city that contains our value or vice versa
                if (cityDropdown.options[i].value.toLowerCase().includes(currentUser.city.toLowerCase()) ||
                    currentUser.city.toLowerCase().includes(cityDropdown.options[i].value.toLowerCase())) {
                    cityDropdown.selectedIndex = i;
                    cityFound = true;
                    console.log('City partial match found at index:', i);
                    break;
                }
            }
        }
        
        // If still no match, select the first non-empty option if available
        if (!cityFound && cityDropdown.options.length > 1) {
            cityDropdown.selectedIndex = 1; // Select the first city after the placeholder
            console.log('No city match found, selecting first option');
        }
        
        // Trigger the change event to filter districts
        const changeEvent = new Event('change');
        cityDropdown.dispatchEvent(changeEvent);
    }
    
    // Set district dropdown value after city change event has filtered the options
    setTimeout(() => {
        const districtDropdown = document.getElementById('editDistrict');
        if (districtDropdown) {
            console.log('Current user district:', currentUser.district);
            console.log('Raw district value:', currentUser._raw_district);
            
            // Log all available options after filtering
            console.log('Available district options:');
            for (let i = 0; i < districtDropdown.options.length; i++) {
                console.log(`- ${districtDropdown.options[i].value}`);
            }
            
            // First try to find an exact match
            let districtFound = false;
            for (let i = 0; i < districtDropdown.options.length; i++) {
                if (districtDropdown.options[i].value.toLowerCase() === currentUser.district.toLowerCase()) {
                    districtDropdown.selectedIndex = i;
                    districtFound = true;
                    console.log('District exact match found at index:', i);
                    break;
                }
            }
            
            // If no exact match, try a more flexible approach
            if (!districtFound) {
                for (let i = 0; i < districtDropdown.options.length; i++) {
                    // Skip the empty option
                    if (districtDropdown.options[i].value === '') continue;
                    
                    // Try to find a district that contains our value or vice versa
                    if (districtDropdown.options[i].value.toLowerCase().includes(currentUser.district.toLowerCase()) ||
                        currentUser.district.toLowerCase().includes(districtDropdown.options[i].value.toLowerCase())) {
                        districtDropdown.selectedIndex = i;
                        districtFound = true;
                        console.log('District partial match found at index:', i);
                        break;
                    }
                }
            }
            
            // If still no match, select the first visible option if available
            if (!districtFound && districtDropdown.options.length > 1) {
                // Find the first visible option (not hidden by the city filter)
                for (let i = 1; i < districtDropdown.options.length; i++) {
                    if (districtDropdown.options[i].style.display !== 'none') {
                        districtDropdown.selectedIndex = i;
                        console.log('No district match found, selecting first visible option at index:', i);
                        break;
                    }
                }
            }
        }
    }, 200); // Increased timeout to ensure city filtering completes
    
    document.getElementById('editAddress').value = currentUser.address;
    document.getElementById('editBlock').value = currentUser.block;
    document.getElementById('editLot').value = currentUser.lot;
    
    // Populate the new fields
    document.getElementById('userUsername').textContent = currentUser.username;
    document.getElementById('userDateJoined').textContent = currentUser.dateJoined;
    document.getElementById('userCity').textContent = currentUser.city || 'Not provided';
    document.getElementById('userDistrict').textContent = currentUser.district || 'Not provided';
    document.getElementById('userAddress').textContent = currentUser.address;
    document.getElementById('userBlockLot').textContent = currentUser.blockLot;
    document.getElementById('userContact').textContent = currentUser.contact;
    
    // Show the modal
    const modal = document.getElementById('userDetailsModal');
    modal.style.display = 'block';
    document.getElementById('viewMode').style.display = 'block';
    document.getElementById('editMode').style.display = 'none';
    
    // Make sure modal is responsive on all devices
    if (window.innerWidth < 768) {
        document.querySelector('.modal-content').style.width = '95%';
        document.querySelector('.modal-content').style.margin = '2% auto';
    } else {
        document.querySelector('.modal-content').style.width = '90%';
        document.querySelector('.modal-content').style.margin = '2% auto';
    }
}

        // Function to get CSRF token from cookies
        function getCsrfToken() {
            const name = 'csrftoken=';
            const decodedCookie = decodeURIComponent(document.cookie);
            const cookieArray = decodedCookie.split(';');
            
            for (let i = 0; i < cookieArray.length; i++) {
                let cookie = cookieArray[i].trim();
                if (cookie.indexOf(name) === 0) {
                    return cookie.substring(name.length, cookie.length);
                }
            }
            return '';
        }
        
        // Remove resident functionality
        function removeResident(button, name) {
            // Set the confirmation message
            document.getElementById('confirmationMessage').textContent = `Are you sure you want to remove ${name}?`;
            
            // Store the button reference for later use
            const deleteButton = button;
            
            // Show the confirmation dialog
            document.getElementById('confirmationDialog').style.display = 'block';
            
            // Set up the confirm button
            document.getElementById('confirmDeleteBtn').onclick = function() {
                // Get the user ID from the button's data attribute
                const userId = deleteButton.dataset.id;
                
                // Call the delete endpoint
                fetch('/admin-panel/delete-user/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({
                        user_id: userId
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        // Remove the row from the table
                        const row = deleteButton.closest('tr');
                        row.remove();
                        
                        // Update the users in localStorage to reflect the deletion
                        // This ensures the deletion persists after page refresh
                        const users = JSON.parse(localStorage.getItem('vigilinkUsers') || '[]');
                        const updatedUsers = users.filter(user => parseInt(user.id) !== parseInt(userId));
                        localStorage.setItem('vigilinkUsers', JSON.stringify(updatedUsers));
                        
                        // Show success message
                        document.getElementById('successMessage').textContent = 'User removed successfully!';
                        document.getElementById('successDialog').style.display = 'block';
                        
                        // Auto close success message after 2 seconds
                        setTimeout(function() {
                            document.getElementById('successDialog').style.display = 'none';
                        }, 2000);
                    } else {
                        // Show error message
                        document.getElementById('errorMessage').textContent = data.message || 'An error occurred while deleting the user.';
                        document.getElementById('errorDialog').style.display = 'block';
                    }
                })
                .catch(error => {
                    // Show error message
                    document.getElementById('errorMessage').textContent = 'An error occurred while deleting the user.';
                    document.getElementById('errorDialog').style.display = 'block';
                    console.error('Error:', error);
                });
                
                // Hide the confirmation dialog
                document.getElementById('confirmationDialog').style.display = 'none';
            };
            
            // Cancel delete button
            document.getElementById('cancelDeleteBtn').onclick = function() {
                document.getElementById('confirmationDialog').style.display = 'none';
            };
        };
        
        document.addEventListener('DOMContentLoaded', function() {
            // Close button for user details modal
            document.querySelector('.close').addEventListener('click', function() {
                document.getElementById('userDetailsModal').style.display = 'none';
            });
            
            // Ensure the close button works even after dialogs are shown
            document.addEventListener('click', function(event) {
                if (event.target.matches('.close')) {
                    document.getElementById('userDetailsModal').style.display = 'none';
                }
            }, true);
            
            // Edit button
            document.getElementById('editButton').addEventListener('click', function() {
                // Switch to edit mode
                document.getElementById('viewMode').style.display = 'none';
                document.getElementById('editMode').style.display = 'block';
                
                // Populate form fields with current user data
                document.getElementById('editName').value = currentUser.name;
                document.getElementById('editEmail').value = currentUser.email;
                document.getElementById('editCity').value = currentUser.city;
                document.getElementById('editDistrict').value = currentUser.district;
                
                // Set the correct role in the dropdown
                const roleSelect = document.getElementById('editRole');
                for (let i = 0; i < roleSelect.options.length; i++) {
                    if (roleSelect.options[i].text.toLowerCase() === currentUser.role.toLowerCase()) {
                        roleSelect.selectedIndex = i;
                        break;
                    }
                }
            });
            
            // Cancel edit button
            document.getElementById('cancelButton').addEventListener('click', function() {
                // Switch back to view mode
                document.getElementById('viewMode').style.display = 'block';
                document.getElementById('editMode').style.display = 'none';
            });
            
            // Save button
            document.getElementById('saveButton').addEventListener('click', function() {
                try {
                    // Get updated values
                    const updatedName = document.getElementById('editName').value;
                    const updatedUsername = document.getElementById('editUsername').value;
                    const updatedEmail = document.getElementById('editEmail').value;
                    const updatedContact = document.getElementById('editContact').value;
                    const updatedAddress = document.getElementById('editAddress').value;
                    const updatedCity = document.getElementById('editCity').value;
                    const updatedDistrict = document.getElementById('editDistrict').value;
                    const updatedBlock = document.getElementById('editBlock').value;
                    const updatedLot = document.getElementById('editLot').value;
                    const updatedRole = document.getElementById('editRole').options[document.getElementById('editRole').selectedIndex].text;
                    const updatedRoleValue = document.getElementById('editRole').value;
                    
                    // Format location and blockLot strings
                    const formattedLocation = (updatedCity && updatedDistrict) ?
                        `${updatedDistrict}, ${updatedCity}` :
                        (updatedCity || updatedDistrict || 'Not provided');
                    
                    const formattedBlockLot = (updatedBlock || updatedLot) ?
                        `Block ${updatedBlock || 'N/A'}, Lot ${updatedLot || 'N/A'}` :
                        'Not provided';
                    
                    // Log values before updating
                    console.log('Form values before update:', {
                        city: updatedCity,
                        district: updatedDistrict,
                        location: formattedLocation
                    });
                    
                    // Update the current user object with new values
                    currentUser = {
                        ...currentUser,
                        name: updatedName,
                        username: updatedUsername,
                        email: updatedEmail,
                        contact: updatedContact,
                        address: updatedAddress,
                        city: updatedCity,
                        district: updatedDistrict,
                        block: updatedBlock,
                        lot: updatedLot,
                        blockLot: formattedBlockLot,
                        location: formattedLocation,
                        role: updatedRole
                    };
                    
                    // Log updated user object
                    console.log('Updated user object:', {
                        city: currentUser.city,
                        district: currentUser.district,
                        location: currentUser.location
                    });
                    
                    // Update the view mode display with the latest data
                    document.getElementById('userName').textContent = currentUser.name;
                    document.getElementById('userUsername').textContent = currentUser.username;
                    document.getElementById('userEmail').textContent = currentUser.email;
                    document.getElementById('userContact').textContent = currentUser.contact;
                    document.getElementById('userAddress').textContent = currentUser.address;
                    document.getElementById('userCity').textContent = currentUser.city || 'Not provided';
                    document.getElementById('userDistrict').textContent = currentUser.district || 'Not provided';
                    document.getElementById('userBlockLot').textContent = currentUser.blockLot;
                    document.getElementById('userRole').textContent = currentUser.role;
                    
                    // Update the table row directly using the stored reference
                    if (currentRow) {
                        currentRow.cells[0].textContent = currentUser.name;
                        currentRow.cells[1].textContent = currentUser.email;
                        currentRow.cells[2].textContent = currentUser.location;
                        currentRow.cells[3].textContent = currentUser.role;
                        
                        // Update the data attributes on the view button to ensure persistence
                        const viewButton = currentRow.querySelector('.view-resident-btn');
                        if (viewButton) {
                            viewButton.dataset.id = currentUser.id;
                            viewButton.dataset.name = currentUser.name;
                            viewButton.dataset.username = currentUser.username;
                            viewButton.dataset.address = currentUser.address;
                            viewButton.dataset.block = currentUser.block;
                            viewButton.dataset.lot = currentUser.lot;
                            viewButton.dataset.phone = currentUser.contact;
                        }
                    }
                    
                    // Switch back to view mode
                    document.getElementById('viewMode').style.display = 'block';
                    document.getElementById('editMode').style.display = 'none';
                    
                    // Show success message with custom dialog
                    document.getElementById('successMessage').textContent = 'User information updated successfully! (Note: Changes will be lost on page refresh)';
                    document.getElementById('successDialog').style.display = 'block';
                    
                    // Send data to server for persistent storage
                    fetch('/admin-panel/update-user/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                        },
                        body: JSON.stringify({
                            user_id: currentUser.id,
                            name: currentUser.name,
                            username: currentUser.username,
                            email: currentUser.email,
                            contact: currentUser.contact,
                            address: currentUser.address,
                            city: currentUser.city,
                            district: currentUser.district,
                            block: currentUser.block,
                            lot: currentUser.lot,
                            role: currentUser.role.toLowerCase().replace(' ', '_')
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            console.log('User data saved successfully to server');
                            // Update success message to indicate server save
                            document.getElementById('successMessage').textContent = 'User information updated and saved to server successfully!';
                            // Also store in localStorage as backup
                            try {
                                let storedUsers = JSON.parse(localStorage.getItem('vigilinkUsers')) || [];
                                const userIndex = storedUsers.findIndex(user => user.id === currentUser.id);
                                if (userIndex !== -1) {
                                    storedUsers[userIndex] = currentUser;
                                } else {
                                    storedUsers.push(currentUser);
                                }
                                localStorage.setItem('vigilinkUsers', JSON.stringify(storedUsers));
                            } catch (storageError) {
                                console.warn('Could not save to localStorage:', storageError);
                            }
                        } else {
                            console.error('Server error:', data.message);
                            document.getElementById('errorMessage').textContent = data.message || 'Error saving to server';
                            document.getElementById('errorDialog').style.display = 'block';
                        }
                    })
                    .catch(error => {
                        console.error('Fetch error:', error);
                        document.getElementById('errorMessage').textContent = 'Network error while saving changes';
                        document.getElementById('errorDialog').style.display = 'block';
                    });
                    
                } catch (error) {
                    console.error('Error updating user:', error);
                    // Show error message
                    document.getElementById('errorMessage').textContent = 'An error occurred while updating user information.';
                    document.getElementById('errorDialog').style.display = 'block';
                }
            });
            
            // Close modals when clicking outside
            window.addEventListener('click', function(event) {
                const userModal = document.getElementById('userDetailsModal');
                const confirmModal = document.getElementById('confirmationDialog');
                
                if (event.target === userModal) {
                    userModal.style.display = 'none';
                }
                
                if (event.target === confirmModal) {
                    confirmModal.style.display = 'none';
                }
            });
        });
        
        document.addEventListener('DOMContentLoaded', function() {
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.querySelector('.main-content');
            const mobileMenuBtn = document.getElementById('mobile-menu-btn');
            const sidebarOverlay = document.getElementById('sidebarOverlay');
            const logoutBtn = document.getElementById('logout-btn');
            const roleFilterBtn = document.getElementById('roleFilterBtn');
            const roleDropdown = document.getElementById('roleDropdown');
            const searchInput = document.getElementById('searchInput');
            
            // Current filter state
            let currentRole = 'all';
            let currentSearchTerm = '';
            
            function toggleSidebar() {
                sidebar.classList.toggle('open');
                mainContent.classList.toggle('expanded');
                if (sidebarOverlay) {
                    sidebarOverlay.classList.toggle('active');
                }
                document.body.classList.toggle('sidebar-open');
            }
            
            function closeSidebar() {
                sidebar.classList.remove('open');
                mainContent.classList.remove('expanded');
                if (sidebarOverlay) {
                    sidebarOverlay.classList.remove('active');
                }
                document.body.classList.remove('sidebar-open');
            }
            
            if (mobileMenuBtn) {
                mobileMenuBtn.addEventListener('click', toggleSidebar);
            }
            
            if (sidebarOverlay) {
                sidebarOverlay.addEventListener('click', closeSidebar);
            }
            
            // Close sidebar on window resize if in mobile view
            window.addEventListener('resize', function() {
                if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                    closeSidebar();
                }
            });
            
            // Toggle dropdown visibility
            roleFilterBtn.addEventListener('click', function() {
                roleDropdown.style.display = roleDropdown.style.display === 'none' ? 'block' : 'none';
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', function(event) {
                if (!roleFilterBtn.contains(event.target) && !roleDropdown.contains(event.target)) {
                    roleDropdown.style.display = 'none';
                }
            });
            
            // Role filter functionality
            const roleLinks = document.querySelectorAll('#roleDropdown a');
            roleLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    if (serverPaginate) {
                        // Let the anchor navigate (server-side filter)
                        return;
                    }
                    e.preventDefault();
                    const selectedRole = this.getAttribute('data-role');
                    currentRole = selectedRole;
                    roleFilterBtn.textContent = this.textContent;
                    roleDropdown.style.display = 'none';
                    
                    // Add back the sort icons
                    const sortIcons = document.createElement('div');
                    sortIcons.className = 'sort-icons';
                    sortIcons.innerHTML = '<div class="sort-icon up"></div><div class="sort-icon down"></div>';
                    roleFilterBtn.appendChild(sortIcons);
                    
                    filterTable();
                });
            });
            
            // Search functionality
            searchInput.addEventListener('input', function(e) {
                currentSearchTerm = e.target.value.toLowerCase();
                filterTable();
            });
            
            // Combined filter function
            function filterTable() {
                const rows = document.querySelectorAll('#residentsTableBody tr');
                let visibleRows = 0;
                
                // Reset current page when filtering
                currentPage = 1;
                
                rows.forEach(row => {
                    // Skip the "No users found" row if it exists
                    if (row.cells.length === 1 && row.cells[0].classList.contains('text-center')) {
                        row.style.display = 'none';
                        return;
                    }
                    
                    // Store original display state if not already stored
                    if (!row.hasAttribute('data-original-display')) {
                        row.setAttribute('data-original-display', row.style.display || '');
                    }
                    
                    const name = row.cells[0] ? row.cells[0].textContent.toLowerCase() : '';
                    const email = row.cells[1] ? row.cells[1].textContent.toLowerCase() : '';
                    const location = row.cells[2] ? row.cells[2].textContent.toLowerCase() : '';
                    const role = row.cells[3] ? row.cells[3].textContent.toLowerCase() : '';
                    
                    // Check if row matches search term
                    const matchesSearch = currentSearchTerm === '' ||
                        name.includes(currentSearchTerm) ||
                        email.includes(currentSearchTerm) ||
                        location.includes(currentSearchTerm) ||
                        role.includes(currentSearchTerm);
                    
                    // Check if row matches selected role
                    const matchesRole = currentRole === 'all' ||
                        (currentRole === 'guest' && role.includes('guest')) ||
                        (currentRole === 'resident' && role.includes('resident')) ||
                        (currentRole === 'community_owner' && role.includes('community owner')) ||
                        (currentRole === 'security' && role.includes('security'));
                    
                    // Update data-original-display attribute based on filter
                    if (matchesSearch && matchesRole) {
                        row.setAttribute('data-original-display', '');
                        visibleRows++;
                    } else {
                        row.setAttribute('data-original-display', 'none');
                    }
                });
                
                // Show "No users found" message if no rows are visible
                 if (visibleRows === 0) {
                     let noResultsRow = document.querySelector('#residentsTableBody .no-results');
                     if (!noResultsRow) {
                         noResultsRow = document.createElement('tr');
                         noResultsRow.className = 'no-results';
                         const cell = document.createElement('td');
                         cell.colSpan = 5;
                         cell.className = 'text-center';
                         cell.textContent = 'No users found';
                         cell.style.textAlign = 'center';
                         cell.style.padding = '20px 0';
                         cell.style.fontSize = '16px';
                         noResultsRow.appendChild(cell);
                         document.getElementById('residentsTableBody').appendChild(noResultsRow);
                     } else {
                         noResultsRow.style.display = '';
                     }
                 }
                 
                 // Apply pagination
                 applyPagination();
             }
             
    // Pagination variables (client-side fallback only)
    let currentPage = 1;
    const rowsPerPage = 10;
             
             // Apply pagination to the table
    function applyPagination() {
        if (serverPaginate) return; // server handles page slicing
        // Get all rows except the "No results" row
                 const allRows = Array.from(document.querySelectorAll('#residentsTableBody tr:not(.no-results)'));
                 
                 // Store original display state
                 if (!allRows.some(row => row.hasAttribute('data-original-display'))) {
                     allRows.forEach(row => {
                         row.setAttribute('data-original-display', row.style.display || '');
                     });
                 }
                 
                 // Get visible rows based on filter
                 const visibleRows = allRows.filter(row => {
                     const originalDisplay = row.getAttribute('data-original-display');
                     return originalDisplay !== 'none';
                 });
                 
                 const totalRows = visibleRows.length;
                 const totalPages = Math.ceil(totalRows / rowsPerPage);
                 
                 // Ensure current page is valid
                 if (currentPage > totalPages && totalPages > 0) {
                     currentPage = totalPages;
                 }
                 
                 // Update pagination info if element exists
                 const totalItemsElement = document.getElementById('totalItems');
                 if (totalItemsElement) {
                     totalItemsElement.textContent = totalRows;
                 }
                 
                 // Hide all rows first
                 allRows.forEach(row => {
                     row.style.display = 'none';
                 });
                 
                 // Show only rows for current page
                 const startIndex = (currentPage - 1) * rowsPerPage;
                 const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
                 
                 for (let i = startIndex; i < endIndex; i++) {
                     if (visibleRows[i]) {
                         visibleRows[i].style.display = '';
                     }
                 }
                 
                 // Update pagination controls
                 updatePaginationControls(totalPages, startIndex, endIndex, totalRows);
             }
             
             // Update pagination controls
    function updatePaginationControls(totalPages, startIndex, endIndex, totalRows) {
        if (serverPaginate) {
            // In server mode, wire prev/next buttons to navigate via data-href
            const prevPageBtn = document.getElementById('prevPage');
            const nextPageBtn = document.getElementById('nextPage');
            if (prevPageBtn && prevPageBtn.dataset && prevPageBtn.dataset.href) {
                prevPageBtn.onclick = (e) => { e.preventDefault(); window.location.href = prevPageBtn.dataset.href; };
            }
            if (nextPageBtn && nextPageBtn.dataset && nextPageBtn.dataset.href) {
                nextPageBtn.onclick = (e) => { e.preventDefault(); window.location.href = nextPageBtn.dataset.href; };
            }
            return;
        }
        // Update page info if elements exist
                 const startIndexElement = document.getElementById('startIndex');
                 const endIndexElement = document.getElementById('endIndex');
                 const pageNumbers = document.getElementById('pageNumbers');
                 
                 if (startIndexElement) {
                     startIndexElement.textContent = totalRows > 0 ? startIndex + 1 : 0;
                 }
                 
                 if (endIndexElement) {
                     endIndexElement.textContent = endIndex;
                 }
                 
                 // Update page numbers if element exists
                 if (pageNumbers) {
                     pageNumbers.innerHTML = '';
                     
                     // Only show current page number as unclickable display
                     if (totalPages > 0) {
                         const pageDisplay = document.createElement('div');
                         pageDisplay.textContent = currentPage;
                         pageDisplay.style.minWidth = '36px';
                         pageDisplay.style.height = '36px';
                         pageDisplay.style.backgroundColor = '#2563EB';
                         pageDisplay.style.color = 'white';
                         pageDisplay.style.border = '2px solid #2563EB';
                         pageDisplay.style.borderRadius = '6px';
                         pageDisplay.style.display = 'flex';
                         pageDisplay.style.alignItems = 'center';
                         pageDisplay.style.justifyContent = 'center';
                         pageDisplay.style.fontWeight = '600';
                         pageDisplay.style.margin = '0 3px';
                         pageDisplay.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
                         pageNumbers.appendChild(pageDisplay);
                     }
                 }
                 
                 // Update prev/next buttons if elements exist
                 const prevPageBtn = document.getElementById('prevPage');
                 const nextPageBtn = document.getElementById('nextPage');
                 
                 if (prevPageBtn) {
                     // Hide previous button on first page
                     if (currentPage === 1) {
                         prevPageBtn.style.display = 'none';
                     } else {
                         prevPageBtn.style.display = 'flex';
                         prevPageBtn.disabled = false;
                     }
                 }
                 
                 if (nextPageBtn) {
                     // Hide next button on last page or when there are no pages
                     if (currentPage === totalPages || totalPages === 0) {
                         nextPageBtn.style.display = 'none';
                     } else {
                         nextPageBtn.style.display = 'flex';
                         nextPageBtn.disabled = false;
                     }
                 }
             }
             
             // Previous page button (if it exists)
    let prevPageBtn = document.getElementById('prevPage');
    if (prevPageBtn && !serverPaginate) {
        prevPageBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                applyPagination();
            }
        });
    }
             
             // Next page button (if it exists)
    let nextPageBtn = document.getElementById('nextPage');
    if (nextPageBtn && !serverPaginate) {
        nextPageBtn.addEventListener('click', function() {
            const visibleRows = Array.from(document.querySelectorAll('#residentsTableBody tr:not(.no-results)'))
                .filter(row => row.getAttribute('data-original-display') !== 'none');
            const totalPages = Math.ceil(visibleRows.length / rowsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                applyPagination();
            }
        });
    }
             
    // Initialize pagination
    applyPagination();
             
             // Initialize table filtering
             filterTable();
             
             // Setup city and district dropdowns
             const cityDropdown = document.getElementById('editCity');
             const districtDropdown = document.getElementById('editDistrict');
             
             if (cityDropdown && districtDropdown) {
                 // Store all district options for filtering
                 const allDistrictOptions = Array.from(districtDropdown.options);
                 
                 // Filter districts based on selected city
                 cityDropdown.addEventListener('change', function() {
                     const selectedCity = this.value;
                     
                     // Clear current options except the first one
                     while (districtDropdown.options.length > 1) {
                         districtDropdown.remove(1);
                     }
                     
                     // Reset to first option
                     districtDropdown.selectedIndex = 0;
                     
                     if (selectedCity) {
                         // Add matching districts
                         allDistrictOptions.forEach(option => {
                             if (option.dataset.city === selectedCity) {
                                 districtDropdown.add(option.cloneNode(true));
                             }
                         });
                     } else {
                         // If no city selected, add all districts back
                         allDistrictOptions.forEach(option => {
                             if (option.value) { // Skip the placeholder option
                                 districtDropdown.add(option.cloneNode(true));
                             }
                         });
                     }
                 });
             }
        }); // End of DOMContentLoaded event listener

