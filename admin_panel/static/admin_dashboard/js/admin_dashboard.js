// Admin Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Sidebar functionality
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

    // Chart initialization
    const roleCountsEl = document.getElementById('role-counts-data');
    const statusCountsEl = document.getElementById('status-counts-data');
    const subscriptionDataEl = document.getElementById('subscription-data');
    const commonReasonsEl = document.getElementById('common-reasons-data');
    
    if (!roleCountsEl || !statusCountsEl || !subscriptionDataEl) {
        return; // Exit if required data elements don't exist
    }
    
    // Get chart data from JSON scripts
    const roleCounts = JSON.parse(roleCountsEl.textContent);
    const statusCounts = JSON.parse(statusCountsEl.textContent);
    const subscriptionDataObj = JSON.parse(subscriptionDataEl.textContent);
    const commonReasonsData = commonReasonsEl ? JSON.parse(commonReasonsEl.textContent) : { labels: [], counts: [] };
    
    // Prepare chart data
    const userRoleData = {
        labels: ['Community Owners', 'Residents', 'Security', 'Guests'],
        data: [
            roleCounts.communityowner || 0,
            roleCounts.resident || 0,
            roleCounts.security || 0,
            roleCounts.guest || 0
        ]
    };
    
    const subscriptionData = {
        labels: ['Active Paid', 'Active Trials', 'Expired'],
        data: [
            subscriptionDataObj.active_paid || 0,
            subscriptionDataObj.active_trials || 0,
            subscriptionDataObj.expired || 0
        ]
    };
    
    const securityReportsData = {
        labels: ['Pending', 'Investigating', 'Resolved', 'False Alarm'],
        data: [
            statusCounts.pending || 0,
            statusCounts.investigating || 0,
            statusCounts.resolved || 0,
            statusCounts.false_alarm || 0
        ]
    };
    
    // Initialize User Role Chart
    const userRoleCtx = document.getElementById('userRoleChart');
    if (userRoleCtx) {
        new Chart(userRoleCtx, {
            type: 'doughnut',
            data: {
                labels: userRoleData.labels,
                datasets: [{
                    data: userRoleData.data,
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 15,
                            font: {
                                size: 13
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        bottom: 10
                    }
                }
            }
        });
    }
    
    // Initialize Subscription Chart
    const subscriptionCtx = document.getElementById('subscriptionChart');
    if (subscriptionCtx) {
        new Chart(subscriptionCtx, {
            type: 'doughnut',
            data: {
                labels: subscriptionData.labels,
                datasets: [{
                    data: subscriptionData.data,
                    backgroundColor: ['#10b981', '#06b6d4', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 15,
                            font: {
                                size: 13
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        bottom: 10
                    }
                }
            }
        });
    }
    
    // Initialize Security Reports Chart
    const securityReportsCtx = document.getElementById('securityReportsChart');
    if (securityReportsCtx) {
        new Chart(securityReportsCtx, {
            type: 'bar',
            data: {
                labels: securityReportsData.labels,
                datasets: [{
                    label: 'Reports',
                    data: securityReportsData.data,
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#6b7280'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 12
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        bottom: 10
                    }
                }
            }
        });
    }
    
    // Initialize Most Common Reasons Chart
    const commonReasonsCtx = document.getElementById('commonReasonsChart');
    if (commonReasonsCtx) {
        // Handle empty data case
        if (!commonReasonsData.labels || commonReasonsData.labels.length === 0) {
            // Display a message or empty chart
            const parentDiv = commonReasonsCtx.parentElement;
            parentDiv.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 40px;">No report reasons data available yet.</p>';
        } else {
        // Truncate long labels for better display
        const truncatedLabels = commonReasonsData.labels.map(label => {
            if (label.length > 20) {
                return label.substring(0, 17) + '...';
            }
            return label;
        });
        
        new Chart(commonReasonsCtx, {
            type: 'bar',
            data: {
                labels: truncatedLabels,
                datasets: [{
                    label: 'Report Count',
                    data: commonReasonsData.counts,
                    backgroundColor: [
                        '#ef4444',
                        '#f59e0b',
                        '#10b981',
                        '#3b82f6',
                        '#8b5cf6',
                        '#ec4899'
                    ],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bar chart
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        displayColors: false,
                        titleFont: {
                            size: 0
                        },
                        callbacks: {
                            title: function() {
                                return ''; // Remove title
                            },
                            label: function(context) {
                                const index = context.dataIndex;
                                const fullLabel = commonReasonsData.labels[index];
                                return fullLabel + ': ' + context.parsed.x + ' reports';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        bottom: 10
                    }
                }
            }
        });
        }
    }
});

