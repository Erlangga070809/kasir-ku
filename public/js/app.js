(function () {
    const themeKey = 'kasir-digital-theme';
    
    function getTheme() {
        const saved = localStorage.getItem(themeKey);
        if (saved) return saved;
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    }
    
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(themeKey, theme);
    }
    
    setTheme(getTheme());
    
    window.toggleTheme = function () {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);
    };
    
    window.showToast = function (message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 200ms ease';
            setTimeout(() => toast.remove(), 200);
        }, 3500);
    };
    
    window.formatCurrency = function (amount) {
        return 'Rp' + Number(amount).toLocaleString('id-ID');
    };
    
    window.formatDate = function (dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    
    window.formatDateTime = function (dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    
    window.api = async function (url, options = {}) {
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
        };
        const mergedOptions = { ...defaultOptions, ...options };
        if (mergedOptions.body && typeof mergedOptions.body === 'object' && !(mergedOptions.body instanceof FormData)) {
            mergedOptions.body = JSON.stringify(mergedOptions.body);
        }
        const response = await fetch(url, mergedOptions);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Terjadi kesalahan');
        }
        return data;
    };
    
    window.openModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    };
    
    window.closeModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    };
    
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('modal-close')) {
            const modal = e.target.closest('.modal');
            if (modal) modal.classList.remove('active');
        }
        if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
            e.target.classList.remove('active');
        }
    });
    
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        }
    });
    
    const sidebarLinks = {
        owner: [
            { href: '/dashboard.html', label: 'Dashboard', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' },
            { href: '/pos.html', label: 'POS', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>' },
            { href: '/transactions.html', label: 'Transaksi', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
            { href: '/products.html', label: 'Produk', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' },
            { href: '/inventory.html', label: 'Inventori', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>' },
            { href: '/reports.html', label: 'Laporan', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' },
            { href: '/employees.html', label: 'Staff', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' },
            { href: '/expenses.html', label: 'Pengeluaran', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' },
            { href: '/settings.html', label: 'Pengaturan', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
        ],
        staff: [
            { href: '/pos.html', label: 'POS', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>' },
            { href: '/transactions.html', label: 'Transaksi', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
        ]
    };
    
    const mobileLinks = {
        owner: [
            { href: '/dashboard.html', label: 'Dashboard', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' },
            { href: '/pos.html', label: 'POS', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/></svg>' },
            { href: '/transactions.html', label: 'Transaksi', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>' },
            { href: '/products.html', label: 'Produk', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' },
        ],
        staff: [
            { href: '/pos.html', label: 'POS', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/></svg>' },
            { href: '/transactions.html', label: 'Transaksi', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>' },
        ]
    };
    
    async function initApp() {
        try {
            const data = await api('/api/auth/me');
            const user = data.data;
            const role = user.role;
            
            const sidebarNav = document.getElementById('sidebarNav');
            if (sidebarNav) {
                const links = sidebarLinks[role] || sidebarLinks.staff;
                const currentPath = window.location.pathname;
                sidebarNav.innerHTML = links.map(link => {
                    const isActive = currentPath.includes(link.href.split('/').pop()) || 
                        (currentPath === '/' && link.href === '/dashboard.html');
                    return `<a href="${link.href}" class="${isActive ? 'active' : ''}">${link.icon} ${link.label}</a>`;
                }).join('');
            }
            
            const mobileNav = document.getElementById('mobileNav');
            if (mobileNav) {
                const links = mobileLinks[role] || mobileLinks.staff;
                const currentPath = window.location.pathname;
                mobileNav.innerHTML = links.map(link => {
                    const isActive = currentPath.includes(link.href.split('/').pop());
                    return `<a href="${link.href}" class="${isActive ? 'active' : ''}">${link.icon} ${link.label}</a>`;
                }).join('');
            }
            
            const userAvatar = document.getElementById('userAvatar');
            if (userAvatar) {
                userAvatar.textContent = user.name.charAt(0).toUpperCase();
            }
            
            const userNameDisplay = document.getElementById('userNameDisplay');
            if (userNameDisplay) {
                userNameDisplay.textContent = user.name;
            }
            
            const topbarGreeting = document.getElementById('topbarGreeting');
            if (topbarGreeting) {
                const hour = new Date().getHours();
                let greeting = 'Selamat pagi';
                if (hour >= 12 && hour < 15) greeting = 'Selamat siang';
                else if (hour >= 15 && hour < 18) greeting = 'Selamat sore';
                else if (hour >= 18) greeting = 'Selamat malam';
                topbarGreeting.textContent = `${greeting}, ${user.name}`;
            }
            
            return user;
        } catch (err) {
            const isAuthPage = window.location.pathname.includes('login') || 
                               window.location.pathname.includes('register') ||
                               window.location.pathname === '/';
            if (!isAuthPage) {
                window.location.href = '/login.html';
            }
        }
    }
    
    document.addEventListener('DOMContentLoaded', initApp);
    
    document.addEventListener('DOMContentLoaded', function () {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', window.toggleTheme);
        }
        
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        if (menuToggle && sidebar) {
            let overlay = document.querySelector('.sidebar-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'sidebar-overlay';
                document.body.appendChild(overlay);
            }
            
            menuToggle.addEventListener('click', function () {
                sidebar.classList.toggle('mobile-open');
                overlay.classList.toggle('active');
            });
            
            overlay.addEventListener('click', function () {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');
            });
        }
        
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', function () {
                const input = this.parentElement.querySelector('input');
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
            });
        });
    });
    
    if (window.location.pathname.includes('pos.html')) {
        document.addEventListener('DOMContentLoaded', function () {
            const cartPanel = document.querySelector('.pos-cart-panel');
            const mobileNav = document.getElementById('mobileNav');
            if (cartPanel && mobileNav && window.innerWidth <= 1024) {
                const cartToggle = document.createElement('button');
                cartToggle.className = 'btn-primary';
                cartToggle.style.cssText = 'position:fixed;bottom:70px;right:16px;z-index:150;border-radius:50%;width:52px;height:52px;padding:0;box-shadow:var(--shadow-lg);';
                cartToggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
                cartToggle.setAttribute('aria-label', 'Buka keranjang');
                document.body.appendChild(cartToggle);
                
                cartToggle.addEventListener('click', function () {
                    cartPanel.classList.toggle('mobile-open');
                });
                
                cartPanel.addEventListener('click', function (e) {
                    if (e.target === cartPanel) {
                        cartPanel.classList.remove('mobile-open');
                    }
                });
            }
        });
    }
})();
