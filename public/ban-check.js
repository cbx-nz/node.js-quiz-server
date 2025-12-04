/**
 * Ban Check System
 * Uses localStorage to persist ban information across sessions
 * Checks both IP bans and UUID bans
 * Redirects banned users to appropriate ban pages with strict access control
 */

(function() {
  'use strict';

  const IP_BAN_STORAGE_KEY = 'cbx_quiz_ban_info';
  const UUID_BAN_STORAGE_KEY = 'cbx_uuid_ban_info';
  const BANNED_UUIDS_KEY = 'cbx_banned_uuids';
  const USER_UUID_KEY = 'cbx_user_uuid';
  const IP_BAN_PAGE = 'ip-banned.html';
  const UUID_BAN_PAGE = 'game-banned.html';
  const ALLOWED_PAGES = ['ip-banned.html', 'game-banned.html', 'tos.html', 'privacy.html'];
  const CHECK_INTERVAL = 5000; // Check every 5 seconds

  /**
   * Get user UUID
   */
  function getUserUUID() {
    return localStorage.getItem(USER_UUID_KEY) || '';
  }

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
  function redirectToBanPage(isUUIDBan = false) {
    const targetPage = isUUIDBan ? UUID_BAN_PAGE : IP_BAN_PAGE;
    if (!window.location.pathname.endsWith(targetPage)) {
      window.location.href = targetPage;
    }
  }

  /**
   * Check if user has UUID ban (from localStorage)
   */
  function checkLocalUUIDBan() {
    try {
      const bannedUUIDs = JSON.parse(localStorage.getItem(BANNED_UUIDS_KEY) || '[]');
      const userUUID = getUserUUID();
      
      if (userUUID && bannedUUIDs.includes(userUUID)) {
        return { banned: true, type: 'uuid', uuid: userUUID };
      }
    } catch (error) {
      console.error('Error checking UUID ban:', error);
    }
    return null;
  }

  /**
   * Check if user is IP banned (from localStorage)
   */
  function checkLocalIPBan() {
    try {
      const banInfo = localStorage.getItem(IP_BAN_STORAGE_KEY);
      if (banInfo) {
        const ban = JSON.parse(banInfo);
        
        // Check if ban has expired
        if (ban.unbanDate) {
          const unbanTime = new Date(ban.unbanDate);
          if (new Date() > unbanTime) {
            // Ban expired, clear it
            localStorage.removeItem(IP_BAN_STORAGE_KEY);
            return null;
          }
        }
        
        if (ban.banned) {
          return { banned: true, type: 'ip', ...ban };
        }
      }
    } catch (error) {
      console.error('Error checking IP ban status:', error);
    }
    return null;
  }

  /**
   * Check ban status via API
   */
  async function checkBanViaAPI() {
    try {
      // Check UUID ban
      const userUUID = getUserUUID();
      if (userUUID) {
        const uuidResponse = await fetch(`/api/check-ban?uuid=${encodeURIComponent(userUUID)}`);
        const uuidData = await uuidResponse.json();
        
        if (uuidData.banned) {
          // Store UUID ban
          const bannedUUIDs = JSON.parse(localStorage.getItem(BANNED_UUIDS_KEY) || '[]');
          if (!bannedUUIDs.includes(userUUID)) {
            bannedUUIDs.push(userUUID);
            localStorage.setItem(BANNED_UUIDS_KEY, JSON.stringify(bannedUUIDs));
          }
          
          // Store ban info if available
          if (uuidData.reason) {
            localStorage.setItem(UUID_BAN_STORAGE_KEY, JSON.stringify({
              reason: uuidData.reason,
              uuid: userUUID,
              bannedAt: uuidData.bannedAt,
              unbanDate: uuidData.unbanDate,
              timestamp: Date.now()
            }));
          }
          
          return { banned: true, type: 'uuid' };
        }
      }
      
      // Check IP ban
      const ipResponse = await fetch('/api/check-ip-ban');
      const ipData = await ipResponse.json();
      
      if (ipData.banned) {
        // Store IP ban
        localStorage.setItem(IP_BAN_STORAGE_KEY, JSON.stringify({
          banned: true,
          reason: ipData.reason || 'Prohibited conduct',
          ip: ipData.ip || 'Unknown',
          bannedAt: ipData.bannedAt,
          unbanDate: ipData.unbanDate,
          timestamp: Date.now()
        }));
        
        return { banned: true, type: 'ip' };
      }
      
      return null;
    } catch (error) {
      console.error('Error checking ban via API:', error);
      return null;
    }
  }

  /**
   * Periodic ban check
   */
  async function periodicBanCheck() {
    // First check localStorage (fast)
    const uuidBan = checkLocalUUIDBan();
    if (uuidBan && !isAllowedPage()) {
      redirectToBanPage(true);
      return;
    }
    
    const ipBan = checkLocalIPBan();
    if (ipBan && !isAllowedPage()) {
      redirectToBanPage(false);
      return;
    }
    
    // Then check API (authoritative)
    const apiBan = await checkBanViaAPI();
    if (apiBan && !isAllowedPage()) {
      redirectToBanPage(apiBan.type === 'uuid');
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
  const uuidBan = checkLocalUUIDBan();
  const ipBan = checkLocalIPBan();
  
  if (uuidBan) {
    // User is UUID banned
    if (!isAllowedPage()) {
      redirectToBanPage(true);
      return;
    } else {
      blockNavigationModal();
      blockUnauthorizedNavigation();
    }
  } else if (ipBan) {
    // User is IP banned
    if (!isAllowedPage()) {
      redirectToBanPage(false);
      return;
    } else {
      blockNavigationModal();
      blockUnauthorizedNavigation();
    }
  }

  // Start periodic checking
  periodicBanCheck();
  setInterval(periodicBanCheck, CHECK_INTERVAL);

  // Listen for ban events from server (Socket.IO)
  if (typeof io !== 'undefined') {
    const socket = io();
    
    // UUID ban event
    socket.on('uuid-banned', (data) => {
      console.log('Received UUID ban from server:', data);
      const bannedUUIDs = JSON.parse(localStorage.getItem(BANNED_UUIDS_KEY) || '[]');
      if (!bannedUUIDs.includes(data.uuid)) {
        bannedUUIDs.push(data.uuid);
        localStorage.setItem(BANNED_UUIDS_KEY, JSON.stringify(bannedUUIDs));
      }
      localStorage.setItem(UUID_BAN_STORAGE_KEY, JSON.stringify({
        reason: data.reason,
        playerName: data.playerName,
        bannedAt: data.bannedAt,
        unbanDate: data.unbanDate,
        uuid: data.uuid,
        timestamp: Date.now()
      }));
      redirectToBanPage(true);
    });

    // Broadcast UUID ban check
    socket.on('check-uuid-ban', (data) => {
      const userUUID = getUserUUID();
      if (userUUID === data.uuid) {
        console.log('UUID banned by admin, redirecting...');
        const bannedUUIDs = JSON.parse(localStorage.getItem(BANNED_UUIDS_KEY) || '[]');
        if (!bannedUUIDs.includes(data.uuid)) {
          bannedUUIDs.push(data.uuid);
          localStorage.setItem(BANNED_UUIDS_KEY, JSON.stringify(bannedUUIDs));
        }
        localStorage.setItem(UUID_BAN_STORAGE_KEY, JSON.stringify({
          reason: data.reason,
          playerName: data.playerName,
          bannedAt: data.bannedAt,
          unbanDate: data.unbanDate,
          uuid: data.uuid,
          timestamp: Date.now()
        }));
        redirectToBanPage(true);
      }
    });

    // IP ban event (legacy)
    socket.on('banned', (data) => {
      console.log('Received IP ban from server:', data);
      localStorage.setItem(IP_BAN_STORAGE_KEY, JSON.stringify({
        banned: true,
        reason: data.reason || 'Prohibited conduct',
        ip: data.ip || 'Unknown',
        bannedAt: data.bannedAt,
        unbanDate: data.unbanDate,
        timestamp: Date.now()
      }));
      redirectToBanPage(false);
    });
  }

  // Expose function to check ban status (for debugging)
  window.checkBanStatus = function() {
    console.log('=== Ban Status Check ===');
    
    const ipBanInfo = localStorage.getItem(IP_BAN_STORAGE_KEY);
    if (ipBanInfo) {
      console.log('IP Ban info:', JSON.parse(ipBanInfo));
    } else {
      console.log('No IP ban info found');
    }
    
    const uuidBanInfo = localStorage.getItem(UUID_BAN_STORAGE_KEY);
    if (uuidBanInfo) {
      console.log('UUID Ban info:', JSON.parse(uuidBanInfo));
    } else {
      console.log('No UUID ban info found');
    }
    
    const bannedUUIDs = localStorage.getItem(BANNED_UUIDS_KEY);
    if (bannedUUIDs) {
      console.log('Banned UUIDs:', JSON.parse(bannedUUIDs));
    }
    
    const userUUID = getUserUUID();
    console.log('Current UUID:', userUUID);
    
    return {
      ipBan: ipBanInfo ? JSON.parse(ipBanInfo) : null,
      uuidBan: uuidBanInfo ? JSON.parse(uuidBanInfo) : null,
      bannedUUIDs: bannedUUIDs ? JSON.parse(bannedUUIDs) : [],
      userUUID: userUUID
    };
  };

  // Expose function to clear ban (for testing/admin override)
  window.clearBan = function() {
    localStorage.removeItem(IP_BAN_STORAGE_KEY);
    localStorage.removeItem(UUID_BAN_STORAGE_KEY);
    localStorage.removeItem(BANNED_UUIDS_KEY);
    console.log('All ban info cleared. Please refresh the page.');
    alert('Ban cleared from browser. If your IP/UUID is still banned on the server, you will be re-banned on reconnection.');
  };

})();
