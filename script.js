document.addEventListener('DOMContentLoaded', () => {
    // Menu Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    // Navigation and Sections
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            // Update page title
            const targetSection = item.getAttribute('data-target');
            if(pageTitle) {
                pageTitle.textContent = item.textContent.trim();
            }

            // Hide all sections and show target
            sections.forEach(sec => {
                sec.classList.remove('active');
                if (sec.id === targetSection) {
                    sec.classList.add('active');
                }
            });

            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('show');
            }
        });
    });

    // Settings Tabs
    const settingTabs = document.querySelectorAll('.setting-tab');
    
    settingTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            settingTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // Logic to switch settings content would go here
        });
    });
});
