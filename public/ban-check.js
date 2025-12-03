/**
 * Ban Check System
 * Uses localStorage to persist ban information across sessions
 * Redirects banned users to ip-banned.html with strict access control
 */

(function() {
  'use strict';

  const BAN_STORAGE_KEY = 'cbx_quiz_ban_info';
  const BAN_PAGE = 'ip-banned.html';
  const ALLOWED_PAGES = ['ip-banned.html', 'game-banned.html', 'tos.html', 'privacy.html'];

  /**
   * Check if current page is in allowed list
   */
  function isAllowedPage() {
    const currentPath = window.location.pathname;
    return ALLOWED_PAGES.some(page => currentPath.endsWith(page));
  }

  /**
   * Redirect to ban page
   */
  function redirectToBanPage() {
    if (!window.location.pathname.endsWith(BAN_PAGE)) {
      window.location.href = BAN_PAGE;
    }
  }

  /**
   * Check if user is banned (from localStorage)
   */
  function checkLocalBan() {
    try {
      const banInfo = localStorage.getItem(BAN_STORAGE_KEY);
      if (banInfo) {
        const ban = JSON.parse(banInfo);
        // Check if ban is still valid (bans don't expire by default)
        if (ban.banned) {
          return ban;
        }
      }
    } catch (error) {
      console.error('Error checking ban status:', error);
    }
    return null;
  }

  /**
   * Store ban information in localStorage
   */
  function storeBan(banData) {
    try {
      const banInfo = {
        banned: true,
        reason: banData.reason || 'Prohibited conduct',
        ip: banData.ip || 'Unknown',
        timestamp: Date.now(),
        unbanDate: banData.unbanDate || null
      };
      localStorage.setItem(BAN_STORAGE_KEY, JSON.stringify(banInfo));
    } catch (error) {
      console.error('Error storing ban:', error);
    }
  }

  /**
   * Block navigation modal for banned users
   */
  function blockNavigationModal() {
    // Disable ./ keyboard shortcut
    document.addEventListener('keydown', function(e) {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && 
          document.activeElement.tagName !== 'TEXTAREA') {
        const beforeSlash = window.lastKeyWasperiod || false;
        if (beforeSlash) {
          e.preventDefault();
          e.stopPropagation();
          console.log('Navigation modal blocked: User is banned');
          return false;
        }
      }
      
      if (e.key === '.') {
        window.lastKeyWasperiod = true;
        setTimeout(() => { window.lastKeyWasperiod = false; }, 500);
      } else {
        window.lastKeyWasperiod = false;
      }
    }, true);
  }

  /**
   * Intercept all navigation attempts
   */
  function blockUnauthorizedNavigation() {
    // Intercept link clicks
    document.addEventListener('click', function(e) {
      const target = e.target.closest('a');
      if (target && target.href) {
        const url = new URL(target.href);
        const path = url.pathname;
        
        // Check if navigation is to an allowed page
        const isAllowed = ALLOWED_PAGES.some(page => path.endsWith(page));
        
        if (!isAllowed) {
          e.preventDefault();
          e.stopPropagation();
          alert('Access denied: You are banned and can only view Terms of Service and Privacy Policy.');
          return false;
        }
      }
    }, true);

    // Intercept form submissions
    document.addEventListener('submit', function(e) {
      e.preventDefault();
      alert('Access denied: You are banned from using this service.');
      return false;
    }, true);

    // Prevent back/forward navigation to blocked pages
    window.addEventListener('popstate', function(e) {
      if (!isAllowedPage()) {
        redirectToBanPage();
      }
    });

    // Prevent programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function() {
      console.log('Navigation blocked: User is banned');
      return;
    };

    history.replaceState = function() {
      console.log('Navigation blocked: User is banned');
      return;
    };
  }

  // Check for existing ban on page load
  const banInfo = checkLocalBan();
  
  if (banInfo) {
    // User is banned
    if (!isAllowedPage()) {
      // Not on an allowed page, redirect immediately
      redirectToBanPage();
      return;
    } else {
      // On allowed page (tos.html, privacy.html, or ip-banned.html)
      // Block navigation modal and unauthorized navigation
      blockNavigationModal();
      blockUnauthorizedNavigation();
    }
  }

  // Listen for ban events from server (only if not already banned)
  if (!banInfo && typeof io !== 'undefined') {
    const socket = io();
    
    socket.on('banned', (data) => {
      console.log('Received ban from server:', data);
      storeBan(data);
      redirectToBanPage();
    });

    // Also listen for disconnect with ban reason
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server disconnected us, might be a ban
        // Check if we received ban info
        setTimeout(() => {
          const newBanInfo = localStorage.getItem(BAN_STORAGE_KEY);
          if (newBanInfo) {
            redirectToBanPage();
          }
        }, 100);
      }
    });
  }

  // Expose function to check ban status (for debugging)
  window.checkBanStatus = function() {
    const banInfo = localStorage.getItem(BAN_STORAGE_KEY);
    if (banInfo) {
      console.log('Ban info:', JSON.parse(banInfo));
      return JSON.parse(banInfo);
    } else {
      console.log('No ban info found');
      return null;
    }
  };

  // Expose function to clear ban (for testing/admin override)
  window.clearBan = function() {
    localStorage.removeItem(BAN_STORAGE_KEY);
    console.log('Ban info cleared. Please refresh the page.');
    alert('Ban cleared from browser. If your IP is still banned on the server, you will be re-banned on reconnection.');
  };

})();
