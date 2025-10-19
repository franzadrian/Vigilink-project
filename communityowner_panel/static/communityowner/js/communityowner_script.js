 // Sample data
        const users = [
            { id: 1, name: "Alex Johnson", email: "alex.johnson@example.com", role: "Admin", initials: "AJ" },
            { id: 2, name: "Maria Garcia", email: "maria.garcia@example.com", role: "Editor", initials: "MG" },
            { id: 3, name: "James Wilson", email: "james.wilson@example.com", role: "Viewer", initials: "JW" },
            { id: 4, name: "Sarah Miller", email: "sarah.miller@example.com", role: "Editor", initials: "SM" },
            { id: 5, name: "Robert Chen", email: "robert.chen@example.com", role: "Admin", initials: "RC" },
            { id: 6, name: "Lisa Thompson", email: "lisa.thompson@example.com", role: "Viewer", initials: "LT" }
        ];

        const reports = [
            { id: 1, title: "Monthly User Activity", date: "2023-10-15", type: "PDF", size: "2.4 MB", status: "Completed" },
            { id: 2, title: "System Performance Analysis", date: "2023-10-10", type: "CSV", size: "1.8 MB", status: "Completed" },
            { id: 3, title: "Security Audit Report", date: "2023-10-05", type: "PDF", size: "3.1 MB", status: "In Progress" },
            { id: 4, title: "Quarterly Financial Summary", date: "2023-09-28", type: "Excel", size: "4.2 MB", status: "Completed" },
            { id: 5, title: "Weekly Performance Metrics", date: "2023-10-12", type: "PDF", size: "1.2 MB", status: "Completed" },
            { id: 6, title: "User Engagement Analysis", date: "2023-10-08", type: "CSV", size: "2.1 MB", status: "Completed" }
        ];

        // Removed downloadOptions and billingHistory as Download & Billing sections were removed

        // DOM Elements
        const navCards = document.querySelectorAll('.nav-card');
        const contentSections = document.querySelectorAll('.content-section');
        const userGrid = document.querySelector('.user-grid');
        const reportList = document.querySelector('.report-list');
        // Removed downloadGrid and billingHistoryTable queries
        const revealBtn = document.getElementById('reveal-btn');
        const codeDisplay = document.getElementById('code-display');
        const copyBtn = document.getElementById('copy-code-btn');
        let reportsRendered = false;
        
        // Stats elements
        const totalUsersEl = document.getElementById('total-users');
        const totalReportsEl = document.getElementById('total-reports');
        const activeReportsEl = document.getElementById('active-reports');
        const weekReportsEl = document.getElementById('week-reports');

        // Initialize the dashboard
        document.addEventListener('DOMContentLoaded', function() {
            updateStats();
            // Stagger rendering to keep first paint snappy
            requestAnimationFrame(() => {
                renderUsers();
                // Defer reports until first open
            });
            
            // Set up event listeners for navigation cards
            navCards.forEach(card => {
                card.addEventListener('click', function() {
                    const targetId = this.getAttribute('data-target');
                    if (this.classList.contains('active')) return; // avoid unnecessary reflows
                    
                    // Update active card
                    navCards.forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Show corresponding content section
                    contentSections.forEach(section => {
                        section.classList.remove('active');
                        if (section.id === targetId) {
                            section.classList.add('active');
                        }
                    });
                    if (targetId === 'reports' && !reportsRendered) {
                        renderReports();
                        reportsRendered = true;
                    }
                });
            });
            
            // Auto-show code if provided by server
            if (codeDisplay && codeDisplay.dataset && codeDisplay.dataset.code) {
                const cd = codeDisplay.dataset.code.trim();
                if (cd) {
                    codeDisplay.textContent = cd;
                    codeDisplay.classList.add('revealed');
                }
            }

            // Optional legacy reveal support
            if (revealBtn) {
                revealBtn.addEventListener('click', revealSecretCode);
            }

            // Copy code button
            if (copyBtn && codeDisplay) {
                copyBtn.addEventListener('click', function () {
                    const text = (codeDisplay.textContent || '').trim();
                    if (!text) return;
                    const onSuccess = () => {
                        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                        setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Code'; }, 1500);
                    };
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).then(onSuccess).catch(() => {/* ignore */});
                    } else {
                        const ta = document.createElement('textarea');
                        ta.value = text;
                        document.body.appendChild(ta);
                        ta.select();
                        try { document.execCommand('copy'); onSuccess(); } catch (e) {}
                        document.body.removeChild(ta);
                    }
                });
            }
        });

        // Update stats
        function updateStats() {
            // Calculate stats
            const totalUsers = users.length;
            const totalReports = reports.length;
            const activeReports = reports.filter(report => report.status === 'Completed').length;
            const weekReports = reports.filter(report => {
                const reportDate = new Date(report.date);
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                return reportDate >= oneWeekAgo;
            }).length;
            
            // Animate stats counting up
            animateValue(totalUsersEl, 0, totalUsers, 1000);
            animateValue(totalReportsEl, 0, totalReports, 1000);
            animateValue(activeReportsEl, 0, activeReports, 1000);
            animateValue(weekReportsEl, 0, weekReports, 1000);
        }

        // Animate value counting up
        function animateValue(element, start, end, duration) {
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                element.innerHTML = Math.floor(progress * (end - start) + start);
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };
            window.requestAnimationFrame(step);
        }

        // Render user cards
        function renderUsers() {
            if (!userGrid) return;
            userGrid.innerHTML = '';
            const frag = document.createDocumentFragment();
            users.forEach(user => {
                const userCard = document.createElement('div');
                userCard.className = 'user-card';
                userCard.innerHTML = `
                    <div class="user-header">
                        <div class="user-avatar">${user.initials}</div>
                        <div class="user-info">
                            <h3>${user.name}</h3>
                            <span class="user-role">${user.role}</span>
                        </div>
                    </div>
                    <div class="user-email">${user.email}</div>
                    <div class="user-actions">
                        <button class="action-btn edit-btn">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="action-btn delete-btn">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                `;
                frag.appendChild(userCard);
            });
            userGrid.appendChild(frag);
        }

        // Render report cards
        function renderReports() {
            if (!reportList) return;
            reportList.innerHTML = '';
            const frag = document.createDocumentFragment();
            reports.forEach(report => {
                const reportCard = document.createElement('div');
                reportCard.className = 'report-card';
                reportCard.innerHTML = `
                    <div class="report-header">
                        <div>
                            <div class="report-title">${report.title}</div>
                            <div class="report-meta">
                                <span><i class="far fa-calendar"></i> ${report.date}</span>
                                <span><i class="far fa-file"></i> ${report.type}</span>
                                <span><i class="fas fa-weight-hanging"></i> ${report.size}</span>
                            </div>
                        </div>
                        <span class="report-badge">${report.status}</span>
                    </div>
                    <div class="report-actions">
                        <button class="action-btn edit-btn">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="action-btn edit-btn">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                `;
                frag.appendChild(reportCard);
            });
            reportList.appendChild(frag);
        }

        // Removed renderDownloadOptions and renderBillingHistory

        // Reveal secret code
        function revealSecretCode() {
            const embedded = codeDisplay?.dataset?.code;
            const secretCode = embedded && embedded.trim() ? embedded.trim() : "7X9P-2R8Q-4T6W-1S3V";
            codeDisplay.textContent = secretCode;
            codeDisplay.classList.add('revealed');
            revealBtn.innerHTML = '<i class="fas fa-check"></i> Code Revealed!';
            revealBtn.classList.add('revealed');
        }
