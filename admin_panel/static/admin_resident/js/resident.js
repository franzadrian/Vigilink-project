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
            // Setup dialog close buttons
            setupDialogCloseButtons();
            
            // Load saved users from localStorage if available
            try {
                const storedUsers = JSON.parse(localStorage.getItem('vigilinkUsers')) || [];
                if (storedUsers.length > 0) {
                    // Update table rows with stored data
                    storedUsers.forEach(user => {
                        const rows = document.querySelectorAll('#residentsTableBody tr');
                        rows.forEach(row => {
                            const viewButton = row.querySelector('.view-resident-btn');
                            if (viewButton && viewButton.dataset.id === user.id) {
                                // Update row data
                                row.cells[0].textContent = user.name;
                                row.cells[1].textContent = user.email;
                                row.cells[2].textContent = user.location;
                                row.cells[3].textContent = user.role;
                                
                                // Update button data attributes
                                viewButton.dataset.name = user.name;
                                viewButton.dataset.username = user.username;
                                viewButton.dataset.address = user.address;
                                viewButton.dataset.block = user.block;
                                viewButton.dataset.lot = user.lot;
                                viewButton.dataset.phone = user.contact;
                            }
                        });
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
    const userId = event.currentTarget.dataset.id;
    
    const cells = currentRow ? currentRow.cells : [];
    
    // Create blockLot string from block and lot
    const blockLot = (block && lot) ? `Block ${block}, Lot ${lot}` : 'Not provided';
    
    currentUser = {
        id: userId, // Add the user ID
        name: name || (cells[0] ? cells[0].textContent : 'Not provided'),
        email: cells[1] ? cells[1].textContent : 'Not provided',
        location: cells[2] ? cells[2].textContent : 'Not provided',
        role: cells[3] ? cells[3].textContent : 'Not provided',
        // Extract city and district from location
        city: cells[2] ? cells[2].textContent.split(',')[0].trim() : 'Not provided',
        district: cells[2] && cells[2].textContent.includes(',') ? cells[2].textContent.split(',')[1].trim() : 'Not provided',
        // Use the passed parameters or default to "Not provided"
        username: username || 'Not provided',
        dateJoined: dateJoined || 'Not provided',
        address: address || 'Not provided',
        block: block || '',
        lot: lot || '',
        blockLot: blockLot,
        contact: contact || 'Not provided'
    };
    
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
    document.getElementById('editCity').value = currentUser.city;
    document.getElementById('editDistrict').value = currentUser.district;
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
                // In a real application, you would send a delete request to the server
                // For this example, we'll just remove the row from the table
                const row = deleteButton.closest('tr');
                row.remove();
                
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
                        (updatedDistrict || updatedCity || 'Not provided');
                    
                    const formattedBlockLot = (updatedBlock || updatedLot) ?
                        `Block ${updatedBlock || 'N/A'}, Lot ${updatedLot || 'N/A'}` :
                        'Not provided';
                    
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
                    
                    // Store in localStorage for persistence within browser session
                    try {
                        // Get existing users or initialize empty array
                        let storedUsers = JSON.parse(localStorage.getItem('vigilinkUsers')) || [];
                        
                        // Find and update user if exists, otherwise add new
                        const userIndex = storedUsers.findIndex(user => user.id === currentUser.id);
                        if (userIndex !== -1) {
                            storedUsers[userIndex] = currentUser;
                        } else {
                            storedUsers.push(currentUser);
                        }
                        
                        // Save back to localStorage
                        localStorage.setItem('vigilinkUsers', JSON.stringify(storedUsers));
                    } catch (storageError) {
                        console.warn('Could not save to localStorage:', storageError);
                    }
                    
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
             
             // Pagination variables
             let currentPage = 1;
             const rowsPerPage = 10;
             
             // Apply pagination to the table
             function applyPagination() {
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
                 
                 // Generate page numbers (show max 5 pages)
                 let startPage = Math.max(1, currentPage - 2);
                 let endPage = Math.min(totalPages, startPage + 4);
                 
                 if (endPage - startPage < 4 && startPage > 1) {
                     startPage = Math.max(1, endPage - 4);
                 }
                 
                 for (let i = startPage; i <= endPage; i++) {
                     const pageBtn = document.createElement('button');
                     pageBtn.textContent = i;
                     pageBtn.classList.add('page-number');
                     if (i === currentPage) {
                         pageBtn.classList.add('active');
                     }
                     pageBtn.addEventListener('click', function() {
                         currentPage = i;
                         applyPagination();
                     });
                     pageNumbers.appendChild(pageBtn);
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
                     if (currentPage === totalPages || totalPages === 0) {
                         nextPageBtn.disabled = true;
                     } else {
                         nextPageBtn.disabled = false;
                     }
                 }
             }
             
             // Previous page button (if it exists)
             const prevPageBtn = document.getElementById('prevPage');
             if (prevPageBtn) {
                 prevPageBtn.addEventListener('click', function() {
                     if (currentPage > 1) {
                         currentPage--;
                         applyPagination();
                     }
                 });
             }
             
             // Next page button (if it exists)
             const nextPageBtn = document.getElementById('nextPage');
             if (nextPageBtn) {
                 nextPageBtn.addEventListener('click', function() {
                     // Get visible rows based on filter (using data-original-display attribute)
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
         });

