/* =========================================================================
   shell.js — Shared shell (sidebar, topbar, mobile menu, theme).
   Used by ALL logged-in panels (student, tutor, advisor, director).
   ========================================================================= */

let layoutViewportHeight = window.innerHeight;

function isMobileLayout() {
    return window.innerWidth <= 900 || window.innerHeight <= 500;
}

function isFormField(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        el.isContentEditable;
}

function isLikelyKeyboardOpen(vv) {
    if (!vv) return false;
    return vv.height < layoutViewportHeight * 0.72;
}

function setAppViewportHeight() {
    const vv = window.visualViewport;
    const typing = isFormField(document.activeElement);
    let height = window.innerHeight;

    if (vv) {
        if (typing && isLikelyKeyboardOpen(vv)) {
            height = layoutViewportHeight;
        } else {
            height = vv.height;
            if (!isLikelyKeyboardOpen(vv)) {
                layoutViewportHeight = Math.max(window.innerHeight, vv.height);
            }
        }
    }

    document.documentElement.style.setProperty('--app-vh', (height * 0.01) + 'px');
}

export function scrollAppShellToReveal(element, margin = 16) {
    const shell = document.querySelector('.app-shell');
    if (!shell || !element) return;
    const shellRect = shell.getBoundingClientRect();
    const elRect = element.getBoundingClientRect();
    if (elRect.bottom > shellRect.bottom - margin) {
        shell.scrollTop += elRect.bottom - shellRect.bottom + margin;
    }
}

export function updateAppTopbarOffset() {
    if (!isMobileLayout()) {
        document.documentElement.style.removeProperty('--app-topbar-offset');
        return;
    }
    let topbar = null;
    document.querySelectorAll('.app-content').forEach((section) => {
        if (window.getComputedStyle(section).display === 'none') return;
        topbar = section.querySelector('.app-topbar');
    });
    if (topbar && topbar.offsetHeight > 0) {
        document.documentElement.style.setProperty('--app-topbar-offset', topbar.offsetHeight + 'px');
    }
}

function refreshMobileChromeMetrics() {
    setAppViewportHeight();
    updateAppTopbarOffset();
}

refreshMobileChromeMetrics();
window.addEventListener('resize', refreshMobileChromeMetrics);
window.addEventListener('orientationchange', () => {
    layoutViewportHeight = window.innerHeight;
    setTimeout(refreshMobileChromeMetrics, 120);
});
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setAppViewportHeight);
}

document.addEventListener('focusout', (e) => {
    if (!isFormField(e.target)) return;
    setTimeout(() => {
        layoutViewportHeight = window.innerHeight;
        refreshMobileChromeMetrics();
    }, 120);
});

function initShellDOM() {
    if (document.body && document.body.dataset.sppShellInit === 'true') return;
    if (document.body) document.body.dataset.sppShellInit = 'true';

    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuToggles = document.querySelectorAll('.mobile-menu-toggle');
    const shell = document.querySelector('.app-shell');
    const sidebar = document.querySelector('.app-sidebar');
    const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');

    // Theme toggle
    themeToggleBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');

            themeToggleBtns.forEach((toggleBtn) => {
                const icon = toggleBtn.querySelector('i:first-child');
                const text = toggleBtn.querySelector('span');

                if (isDark) {
                    icon.classList.remove('fa-sun', 'fa-regular');
                    icon.classList.add('fa-moon', 'fa-solid');
                    text.textContent = 'Dark';
                } else {
                    icon.classList.remove('fa-moon', 'fa-solid');
                    icon.classList.add('fa-sun', 'fa-regular');
                    text.textContent = 'Light';
                }
            });
        });
    });

    // Tab navigation
    const navLinks = document.querySelectorAll('.app-nav-link');
    const sections = document.querySelectorAll('.app-content');

    const preActive = document.querySelector('.app-nav-link[data-active], .app-nav-link[data-activo]');
    if (preActive) {
        navLinks.forEach((nav) => {
            nav.classList.remove('app-nav-link--active');
            nav.removeAttribute('aria-current');
        });
        preActive.classList.add('app-nav-link--active');
        preActive.setAttribute('aria-current', 'page');
    }

    navLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            if (link.hasAttribute('data-externo') || link.hasAttribute('data-external')) return;
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);

            navLinks.forEach((nav) => {
                nav.classList.remove('app-nav-link--active');
                nav.removeAttribute('aria-current');
            });
            link.classList.add('app-nav-link--active');
            link.setAttribute('aria-current', 'page');

            sections.forEach((section) => {
                if (section.id === targetId) {
                    section.style.display = isMobileLayout() ? 'block' : 'flex';
                    const wrapper = section.querySelector('.practice-content-wrapper');
                    if (wrapper) wrapper.style.display = '';
                } else {
                    section.style.display = 'none';
                }
            });

            window.scrollTo(0, 0);
            if (shell) shell.scrollTop = 0;
            document.querySelectorAll('.app-shell, .practice-content-wrapper, .reports-wrapper').forEach((el) => {
                el.scrollTop = 0;
            });
            updateAppTopbarOffset();
            requestAnimationFrame(updateAppTopbarOffset);

            if (isMobileLayout() && shell.classList.contains('sidebar-open')) {
                closeMobileMenu();
            }
        });
    });

    navLinks.forEach((nav) => {
        nav.classList.remove('app-nav-link--active');
        nav.removeAttribute('aria-current');
    });
    const hashId = (window.location.hash || '').slice(1);
    const hashLink = hashId
        ? Array.prototype.find.call(navLinks, (nav) => nav.getAttribute('href') === '#' + hashId)
        : null;
    const landingLink = hashLink || navLinks[0];
    const landingId = landingLink ? (landingLink.getAttribute('href') || '').slice(1) : '';
    sections.forEach((section) => {
        if (section.id === landingId) {
            section.style.display = isMobileLayout() ? 'block' : 'flex';
            const wrapper = section.querySelector('.practice-content-wrapper');
            if (wrapper) wrapper.style.display = '';
        } else {
            section.style.display = 'none';
        }
    });
    if (landingLink) {
        landingLink.classList.add('app-nav-link--active');
        landingLink.setAttribute('aria-current', 'page');
    }

    updateAppTopbarOffset();

    function blockBackgroundScroll(event) {
        if (sidebar && !sidebar.contains(event.target)) {
            event.preventDefault();
        }
    }

    function openMobileMenu() {
        shell.classList.add('sidebar-open');
        shell.addEventListener('wheel', blockBackgroundScroll, { passive: false });
        shell.addEventListener('touchmove', blockBackgroundScroll, { passive: false });
    }

    function closeMobileMenu() {
        shell.classList.remove('sidebar-open');
        shell.removeEventListener('wheel', blockBackgroundScroll);
        shell.removeEventListener('touchmove', blockBackgroundScroll);
    }

    function toggleMobileMenu() {
        if (shell.classList.contains('sidebar-open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            if (!isMobileLayout()) {
                shell.classList.toggle('sidebar-collapsed');
            } else {
                toggleMobileMenu();
            }
        });
    }

    mobileMenuToggles.forEach((toggle) => {
        toggle.addEventListener('click', toggleMobileMenu);
    });

    document.addEventListener('click', (event) => {
        const accountBtn = event.target.closest('.app-account');
        if (accountBtn) {
            event.preventDefault();
            activateNav('#profile');
        }
    });

    document.addEventListener('click', (event) => {
        if (!shell) return;
        if (isMobileLayout()) {
            let clickedOnMobileToggle = false;
            mobileMenuToggles.forEach((toggle) => {
                if (toggle.contains(event.target)) {
                    clickedOnMobileToggle = true;
                }
            });

            if (shell.classList.contains('sidebar-open') &&
                sidebar && !sidebar.contains(event.target) &&
                (!sidebarToggle || !sidebarToggle.contains(event.target)) &&
                !clickedOnMobileToggle) {
                closeMobileMenu();
            }
        }
    });

    window.addEventListener('resize', () => {
        if (!isMobileLayout() && shell?.classList.contains('sidebar-open')) {
            closeMobileMenu();
        }
    });

    if (sidebar && shell) {
        let tooltip = document.getElementById('sidebar-collapsed-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'sidebar-collapsed-tooltip';
            tooltip.className = 'sidebar-tooltip';
            tooltip.setAttribute('role', 'tooltip');
            tooltip.setAttribute('aria-hidden', 'true');
            document.body.appendChild(tooltip);
        }

        function showTooltip(el) {
            if (!shell.classList.contains('sidebar-collapsed') || isMobileLayout()) {
                hideTooltip();
                return;
            }
            let label = el.querySelector('span')?.textContent?.replace(/\s+/g, ' ').trim();
            if (!label) {
                if (el.classList.contains('sidebar-toggle')) {
                    label = 'Menú';
                } else {
                    label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
                }
            }
            if (!label) return;

            tooltip.textContent = label;
            const rect = el.getBoundingClientRect();
            const left = Math.round(rect.right + 12);
            const top = Math.round(rect.top + (rect.height / 2));

            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            tooltip.classList.add('is-visible');
        }

        function hideTooltip() {
            if (tooltip) {
                tooltip.classList.remove('is-visible');
            }
        }

        const menuItems = sidebar.querySelectorAll('.app-nav-link, .app-logout, .sidebar-toggle');
        menuItems.forEach((item) => {
            item.addEventListener('mouseenter', () => showTooltip(item));
            item.addEventListener('mouseleave', hideTooltip);
            item.addEventListener('focus', () => showTooltip(item));
            item.addEventListener('blur', hideTooltip);
            item.addEventListener('click', hideTooltip);
        });

        sidebar.addEventListener('mouseleave', hideTooltip);
        window.addEventListener('scroll', hideTooltip, { passive: true });

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', hideTooltip);
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShellDOM);
} else {
    initShellDOM();
}

export function initShell() {
    initShellDOM();
}

export function activateNav(hash) {
    if (typeof document === 'undefined' || !hash) return;
    const link =
        document.querySelector(`.app-navigation a[href="${hash}"]`) ||
        document.querySelector(`.app-nav-link[href="${hash}"]`) ||
        document.querySelector(`a[href="${hash}"]`);
    if (link) link.click();
}

export function onNavClick(hash, handler) {
    if (typeof document === 'undefined' || !hash || typeof handler !== 'function') {
        return () => {};
    }
    const link =
        document.querySelector(`.app-navigation a[href="${hash}"]`) ||
        document.querySelector(`a[href="${hash}"]`);
    if (!link) return () => {};
    link.addEventListener('click', handler);
    return () => link.removeEventListener('click', handler);
}

export function scrollCardIntoShellView(card, sectionId) {
    if (typeof document === 'undefined' || !card) return;
    const shell = document.querySelector('.app-shell');
    const isMobile = isMobileLayout();
    if (isMobile && shell) {
        const sectionEl = sectionId ? document.getElementById(sectionId) : null;
        const topbar = sectionEl && sectionEl.querySelector('.app-topbar');
        const topbarHeight = topbar ? topbar.offsetHeight : 0;
        const cardTop =
            card.getBoundingClientRect().top -
            shell.getBoundingClientRect().top +
            shell.scrollTop;
        shell.scrollTo({
            top: Math.max(0, cardTop - topbarHeight - 24),
            behavior: 'smooth'
        });
        window.scrollTo(0, 0);
    } else {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

export function initLoginSplash() {
    if (typeof document === 'undefined') return () => {};
    const splash = document.getElementById('spp-splash');
    if (!splash) return () => {};

    let shouldShow = false;
    try {
        if (!sessionStorage.getItem('spp-intro-shown')) {
            sessionStorage.setItem('spp-intro-shown', '1');
            shouldShow = true;
        }
    } catch (_) {
        shouldShow = true;
    }

    if (shouldShow) {
        splash.classList.remove('is-hidden');
        const timer = setTimeout(() => {
            splash.classList.add('splash-out');
            splash.addEventListener(
                'animationend',
                () => {
                    splash.remove();
                },
                { once: true }
            );
        }, 1700);
        return () => clearTimeout(timer);
    }
    splash.remove();
    return () => {};
}

export function bindLogoutLinks(handler) {
    if (typeof document === 'undefined' || typeof handler !== 'function') return () => {};
    const logoutLinks = Array.from(document.querySelectorAll('.app-logout'));
    logoutLinks.forEach((link) => link.addEventListener('click', handler));
    return () => {
        logoutLinks.forEach((link) => link.removeEventListener('click', handler));
    };
}

export function updateProfileDOM(user, rolesMap) {
    if (typeof document === 'undefined' || !user) return;
    const fullName = ((user.firstName || '') + ' ' + (user.lastName || '')).trim();

    document.querySelectorAll('.app-account').forEach((el) => {
        el.setAttribute('title', 'Ver perfil');
    });
    document.querySelectorAll('.app-account strong').forEach((el) => {
        el.textContent = fullName;
    });
    document.querySelectorAll('.app-account small').forEach((el) => {
        el.textContent = (rolesMap && rolesMap[user.role]) || user.role;
    });

    const capitalize = (text) =>
        text ? String(text).charAt(0).toUpperCase() + String(text).slice(1) : '';

    document.querySelectorAll('.profile-info-text').forEach((block) => {
        const labelEl = block.querySelector('.profile-info-label');
        const label = ((labelEl && labelEl.textContent) || '').trim().toLowerCase();
        const value = block.querySelector('.profile-info-value');
        if (!value) return;
        if (label.includes('name')) value.textContent = fullName;
        else if (label.startsWith('id'))
            value.textContent = (user.documentType || '') + ' ' + (user.documentNumber || '');
        else if (label.includes('email')) value.textContent = user.email || '';
        else if (label.includes('program')) value.textContent = user.program || 'Unassigned';
        else if (label.includes('status')) value.textContent = capitalize(user.status);
    });
}

export function syncNotificationBellBadges(unread) {
    if (typeof document === 'undefined') return;
    const buttons = Array.from(
        document.querySelectorAll('.topbar-icon[aria-label="Notifications"]')
    );
    buttons.forEach((button) => {
        let badge = button.querySelector('.bell-badge');
        if (!unread) {
            if (badge) badge.remove();
            button.removeAttribute('data-unread');
            return;
        }
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'bell-badge';
            button.appendChild(badge);
        }
        badge.textContent = unread > 99 ? '99+' : String(unread);
        button.setAttribute('data-unread', String(unread));
    });
}

export function getNotificationBellButtons() {
    if (typeof document === 'undefined') return [];
    return Array.from(document.querySelectorAll('.topbar-icon[aria-label="Notifications"]'));
}

export default {
    scrollAppShellToReveal,
    updateAppTopbarOffset,
    initShell,
    activateNav,
    onNavClick,
    scrollCardIntoShellView,
    initLoginSplash,
    bindLogoutLinks,
    updateProfileDOM,
    syncNotificationBellBadges,
    getNotificationBellButtons
};
