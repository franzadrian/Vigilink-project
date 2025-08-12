/**
 * Payment Page JavaScript
 */

// Initialize global flag to track redirection state
window.isRedirectingToPayPal = false;

document.addEventListener('DOMContentLoaded', function() {
    // Store plan details for the API call
    const planType = document.getElementById('plan-type').dataset.planType;
    const billingCycle = document.getElementById('billing-cycle').dataset.billingCycle;
    
    // Initialize PayPal if the SDK is loaded
    if (typeof paypal !== 'undefined') {
        // Render the PayPal button
        paypal.Buttons({
            // Custom styling
            style: {
                layout: 'vertical',
                color: 'blue',
                shape: 'pill',
                label: 'pay'
            },
            
            // Set up the transaction
            createOrder: function(data, actions) {
                // Show loading overlay
                showLoadingOverlay();
                
                // Call server to create the order
                return fetch('/user/payment/create/', {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({
                        plan_type: planType,
                        billing_cycle: billingCycle
                    })
                })
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    // Remove loading overlay
                    hideLoadingOverlay();
                    
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    if (data.approval_url) {
                        // Set flag to prevent error messages during redirect
                        window.isRedirectingToPayPal = true;
                        // Redirect directly to PayPal's site in the same window without showing error
                        window.location.href = data.approval_url;
                        return null; // Prevent further execution
                    }
                    return data.id; // Return order ID if available
                });
            },
            
            // Execute the payment
            onApprove: function(data, actions) {
                // Show processing message
                showProcessingMessage();
                
                // Call server to capture the order
                return fetch('/user/payment/capture/', {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({
                        order_id: data.orderID
                    })
                })
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    // Show success message
                    showSuccessMessage();
                    
                    // Redirect to success page after a short delay
                    setTimeout(function() {
                        window.location.href = '/user/payment/success/';
                    }, 1500);
                })
                .catch(function(error) {
                    console.error('Payment capture error:', error);
                    showErrorMessage('Payment processing failed. Please try again or contact support.');
                });
            },
            
            onError: function(err) {
                console.error('PayPal Error:', err);
                // Only show error message if we're not already redirecting to PayPal
                if (!window.isRedirectingToPayPal) {
                    showErrorMessage('Payment processing failed. Please try again or contact support.');
                }
            }
        }).render('#paypal-button-container');
    }
    
    // Helper Functions
    function showLoadingOverlay() {
        const container = document.getElementById('paypal-button-container');
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner"></div>';
        container.appendChild(overlay);
    }
    
    function hideLoadingOverlay() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    function showProcessingMessage() {
        const container = document.getElementById('paypal-button-container');
        container.innerHTML = `
            <div class="status-message info">
                <div class="status-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12" y2="8"></line>
                    </svg>
                </div>
                <div>
                    <h5>Processing Payment</h5>
                    <p>Please wait while we confirm your payment...</p>
                </div>
            </div>
        `;
    }
    
    function showSuccessMessage() {
        const container = document.getElementById('paypal-button-container');
        container.innerHTML = `
            <div class="status-message success">
                <div class="status-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                </div>
                <div>
                    <h5>Payment Successful!</h5>
                    <p>Redirecting to confirmation page...</p>
                </div>
            </div>
        `;
    }
    
    function showErrorMessage(message) {
        const container = document.getElementById('paypal-button-container');
        container.innerHTML = `
            <div class="status-message error">
                <div class="status-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                </div>
                <div>
                    <h5>Payment Error</h5>
                    <p>${message}</p>
                </div>
            </div>
        `;
    }
    
    function showInfoMessage(message) {
        const container = document.getElementById('paypal-button-container');
        container.innerHTML = `
            <div class="status-message info">
                <div class="status-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12" y2="8"></line>
                    </svg>
                </div>
                <div>
                    <h5>PayPal Checkout</h5>
                    <p>${message}</p>
                    <button id="retry-paypal" class="btn btn-primary mt-3" style="background-color: #0070ba; color: white; border: none; padding: 10px 20px; border-radius: 25px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.3s ease;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-repeat" viewBox="0 0 16 16" style="margin-right: 5px;">
                            <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                            <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
                        </svg>
                        Retry PayPal Payment
                    </button>
                </div>
            </div>
        `;
        
        // Add event listener to the retry button with hover effect
        setTimeout(() => {
            const retryButton = document.getElementById('retry-paypal');
            if (retryButton) {
                retryButton.addEventListener('click', function() {
                    // Reload the page to restart the payment process
                    window.location.reload();
                });
                
                // Add hover effects
                retryButton.addEventListener('mouseover', function() {
                    this.style.backgroundColor = '#005ea6';
                    this.style.transform = 'translateY(-2px)';
                    this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                });
                
                retryButton.addEventListener('mouseout', function() {
                    this.style.backgroundColor = '#0070ba';
                    this.style.transform = 'translateY(0)';
                    this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                });
            }
        }, 100);
    }
    
    function showPayPalModal(paypalUrl) {
        // Create modal container
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'paypal-modal-overlay';
        modalOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: center; align-items: center;';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'paypal-modal-content';
        modalContent.style.cssText = 'background-color: white; border-radius: 8px; width: 90%; max-width: 800px; height: 80%; max-height: 600px; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column;';
        
        // Create modal header
        const modalHeader = document.createElement('div');
        modalHeader.className = 'paypal-modal-header';
        modalHeader.style.cssText = 'padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;';
        
        // Add PayPal logo
        const paypalLogo = document.createElement('div');
        paypalLogo.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="30" viewBox="0 0 124 33"><path fill="#253B80" d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.97-1.142-2.694-1.746-4.985-1.746zM47 13.154c-.374 2.454-2.249 2.454-4.062 2.454h-1.032l.724-4.583a.57.57 0 0 1 .563-.481h.473c1.235 0 2.4 0 3.002.704.359.42.469 1.044.332 1.906zM66.654 13.075h-3.275a.57.57 0 0 0-.563.481l-.145.916-.229-.332c-.709-1.029-2.29-1.373-3.868-1.373-3.619 0-6.71 2.741-7.312 6.586-.313 1.918.132 3.752 1.22 5.031.998 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .562.66h2.95a.95.95 0 0 0 .939-.803l1.77-11.209a.568.568 0 0 0-.561-.658zm-4.565 6.374c-.316 1.871-1.801 3.127-3.695 3.127-.951 0-1.711-.305-2.199-.883-.484-.574-.668-1.391-.514-2.301.295-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.499.589.697 1.411.554 2.317zM84.096 13.075h-3.291a.954.954 0 0 0-.787.417l-4.539 6.686-1.924-6.425a.953.953 0 0 0-.912-.678h-3.234a.57.57 0 0 0-.541.754l3.625 10.638-3.408 4.811a.57.57 0 0 0 .465.9h3.287a.949.949 0 0 0 .781-.408l10.946-15.8a.57.57 0 0 0-.468-.895z"/><path fill="#179BD7" d="M94.992 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.971-1.142-2.694-1.746-4.983-1.746zm.789 6.405c-.373 2.454-2.248 2.454-4.062 2.454h-1.031l.725-4.583a.568.568 0 0 1 .562-.481h.473c1.234 0 2.4 0 3.002.704.359.42.468 1.044.331 1.906zM115.434 13.075h-3.273a.567.567 0 0 0-.562.481l-.145.916-.23-.332c-.709-1.029-2.289-1.373-3.867-1.373-3.619 0-6.709 2.741-7.311 6.586-.312 1.918.131 3.752 1.219 5.031 1 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .564.66h2.949a.95.95 0 0 0 .938-.803l1.771-11.209a.571.571 0 0 0-.565-.658zm-4.565 6.374c-.314 1.871-1.801 3.127-3.695 3.127-.949 0-1.711-.305-2.199-.883-.484-.574-.666-1.391-.514-2.301.297-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.501.589.699 1.411.554 2.317zM119.295 7.23l-2.807 17.858a.569.569 0 0 0 .562.658h2.822c.469 0 .867-.34.939-.803l2.768-17.536a.57.57 0 0 0-.562-.659h-3.16a.571.571 0 0 0-.562.482z"/></svg>';
        modalHeader.appendChild(paypalLogo);
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.style.cssText = 'background: none; border: none; font-size: 24px; cursor: pointer; color: #666;';
        closeButton.onclick = function() {
            document.body.removeChild(modalOverlay);
            // Show retry message
            showInfoMessage('PayPal checkout was closed. You can try again.');
        };
        modalHeader.appendChild(closeButton);
        
        // Create iframe container
        const iframeContainer = document.createElement('div');
        iframeContainer.style.cssText = 'flex: 1; padding: 0; overflow: hidden;';
        
        // Create iframe for PayPal
        const iframe = document.createElement('iframe');
        iframe.src = paypalUrl;
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
        iframe.name = 'paypal-checkout-iframe'; // Add name for targeting
        iframe.id = 'paypal-checkout-iframe'; // Add ID for easier reference
        
        // Add event listeners to handle iframe messages and errors
        window.addEventListener('message', function(event) {
            // Check if the message is from PayPal
            if (event.data && typeof event.data === 'string') {
                // Handle PayPal success redirect
                if (event.data.indexOf('success') !== -1 || event.data.indexOf('return') !== -1) {
                    // Redirect to success page
                    window.location.href = '/user/payment/success/';
                }
                // Handle PayPal cancel
                if (event.data.indexOf('cancel') !== -1) {
                    document.body.removeChild(modalOverlay);
                    showInfoMessage('PayPal checkout was cancelled. You can try again.');
                }
            }
        });
        
        iframe.onload = function() {
            // Hide loading spinner when iframe is loaded
            loadingSpinner.style.display = 'none';
            
            // Check if the iframe loaded with an error page
            try {
                // This will throw an error if cross-origin
                const iframeContent = iframe.contentWindow.document.body.innerHTML;
                
                // If we can access it and it contains error messages
                if (iframeContent && (iframeContent.indexOf('error') !== -1 || iframeContent.indexOf('sorry') !== -1)) {
                    showErrorMessage('There was a problem connecting to PayPal. Please try again.');
                    document.body.removeChild(modalOverlay);
                }
            } catch (e) {
                // Cross-origin error is expected and normal
                console.log('Cross-origin iframe access prevented as expected');
            }
        };
        
        // Add error handler
        iframe.onerror = function() {
            loadingSpinner.style.display = 'none';
            showErrorMessage('Failed to load PayPal checkout. Please try again.');
            document.body.removeChild(modalOverlay);
        };
        
        // Create loading spinner
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'loading-spinner';
        loadingSpinner.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #0070ba; border-radius: 50%; animation: spin 1s linear infinite;';
        
        // Add keyframes for spinner animation
        const style = document.createElement('style');
        style.textContent = '@keyframes spin { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }';
        document.head.appendChild(style);
        
        // Assemble modal
        iframeContainer.appendChild(iframe);
        iframeContainer.appendChild(loadingSpinner);
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(iframeContainer);
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        // Update PayPal button container
        const container = document.getElementById('paypal-button-container');
        container.innerHTML = `
            <div class="status-message info">
                <div class="status-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12" y2="8"></line>
                    </svg>
                </div>
                <div>
                    <h5>PayPal Checkout</h5>
                    <p>PayPal checkout is open in a modal window.</p>
                </div>
            </div>
        `;
    }
    
    // Function to get CSRF token from cookies
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
});