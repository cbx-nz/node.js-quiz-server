require('dotenv').config();
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');

const adminApp = express();
const adminServer = http.createServer(adminApp);

// Admin port (different from main server)
const ADMIN_PORT = process.env.ADMIN_PORT || 3001;

// Middleware
adminApp.use(express.json());
adminApp.use(express.static('public'));

// Files to store bans and requests
const BANNED_IPS_FILE = path.join(__dirname, 'banned-ips.json');
const BANNED_UUIDS_FILE = path.join(__dirname, 'banned-uuids.json');
const BAN_REQUESTS_FILE = path.join(__dirname, 'ban-requests.json');
const REQUESTS_BACKUP_FILE = path.join(__dirname, 'requests-backup.json');

// Load banned IPs from file
function loadBannedIPs() {
  try {
    if (fs.existsSync(BANNED_IPS_FILE)) {
      const data = fs.readFileSync(BANNED_IPS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading banned IPs:', error);
  }
  return [];
}

// Save banned IPs to file
function saveBannedIPs(bannedIPs) {
  try {
    fs.writeFileSync(BANNED_IPS_FILE, JSON.stringify(bannedIPs, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving banned IPs:', error);
    return false;
  }
}

// Load banned UUIDs from file
function loadBannedUUIDs() {
  try {
    if (fs.existsSync(BANNED_UUIDS_FILE)) {
      const data = fs.readFileSync(BANNED_UUIDS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading banned UUIDs:', error);
  }
  return [];
}

// Save banned UUIDs to file
function saveBannedUUIDs(bannedUUIDs) {
  try {
    fs.writeFileSync(BANNED_UUIDS_FILE, JSON.stringify(bannedUUIDs, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving banned UUIDs:', error);
    return false;
  }
}

// Load ban requests from file
function loadBanRequests() {
  try {
    if (fs.existsSync(BAN_REQUESTS_FILE)) {
      const data = fs.readFileSync(BAN_REQUESTS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading ban requests:', error);
  }
  return [];
}

// Save ban requests to file
function saveBanRequests(requests) {
  try {
    fs.writeFileSync(BAN_REQUESTS_FILE, JSON.stringify(requests, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving ban requests:', error);
    return false;
  }
}

// Load requests backup from file
function loadRequestsBackup() {
  try {
    if (fs.existsSync(REQUESTS_BACKUP_FILE)) {
      const data = fs.readFileSync(REQUESTS_BACKUP_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading requests backup:', error);
  }
  return [];
}

// Save request to backup (for history/audit)
function saveRequestToBackup(request, action) {
  try {
    const backup = loadRequestsBackup();
    backup.push({
      ...request,
      action: action, // 'approved' or 'rejected'
      actionTimestamp: Date.now(),
      actionDate: new Date().toISOString()
    });
    fs.writeFileSync(REQUESTS_BACKUP_FILE, JSON.stringify(backup, null, 2));
    console.log(`Request ${request.id} saved to backup with action: ${action}`);
    return true;
  } catch (error) {
    console.error('Error saving request to backup:', error);
    return false;
  }
}

// Clean up expired bans
function cleanupExpiredBans(bans) {
  const now = Date.now();
  const activeBans = bans.filter(ban => {
    // If no unbanDate, it's a permanent ban
    if (!ban.unbanDate) {
      return true;
    }
    // Check if ban has expired
    if (ban.unbanDate <= now) {
      console.log(`Removing expired ban for IP: ${ban.ip} (expired: ${new Date(ban.unbanDate).toLocaleString()})`);
      return false;
    }
    return true;
  });
  
  // If bans were removed, save the cleaned list
  if (activeBans.length < bans.length) {
    console.log(`Cleaned up ${bans.length - activeBans.length} expired ban(s)`);
    saveBannedIPs(activeBans);
  }
  
  return activeBans;
}

// In-memory storage for banned IPs and UUIDs
let bannedIPs = cleanupExpiredBans(loadBannedIPs());
let bannedUUIDs = loadBannedUUIDs();
let banRequests = loadBanRequests();

// Serve admin panel
adminApp.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Get banned IPs list
adminApp.get('/api/admin/banned-ips', (req, res) => {
  res.json({ bannedIPs });
});

// Get server statistics
adminApp.get('/api/admin/stats', (req, res) => {
  // These will be populated from the main server
  const stats = {
    activeRooms: global.activeRooms || 0,
    connectedUsers: global.connectedUsers || 0
  };
  res.json(stats);
});

// Get client's IP address
adminApp.get('/api/admin/my-ip', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  res.json({ ip: ip.replace('::ffff:', '') });
});

// Get banned UUIDs list
adminApp.get('/api/admin/banned-uuids', (req, res) => {
  res.json({ bannedUUIDs });
});

// Get ban requests
adminApp.get('/api/admin/ban-requests', (req, res) => {
  res.json({ banRequests });
});

// Approve ban request and add UUID to banned list
adminApp.post('/api/admin/approve-ban-request', (req, res) => {
  const { requestId, banType = 'uuid', unbanDate = null } = req.body;
  
  const request = banRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found' });
  }
  
  // Save request to backup before removing
  saveRequestToBackup(request, `approved-${banType}`);
  
  // Apply bans based on banType
  if (banType === 'uuid' || banType === 'both') {
    // Add to banned UUIDs
    bannedUUIDs.push({
      uuid: request.uuid,
      playerName: request.playerName,
      reason: request.reason,
      bannedAt: Date.now(),
      unbanDate: unbanDate,
      approvedBy: 'admin'
    });
    saveBannedUUIDs(bannedUUIDs);
    
    // Notify connected clients with this UUID in real-time
    if (module.exports.notifyUUIDBan) {
      module.exports.notifyUUIDBan(request.uuid, request.playerName, request.reason, Date.now(), unbanDate);
    }
  }
  
  if (banType === 'ip' || banType === 'both') {
    // Add to banned IPs (if IP is available)
    if (request.playerIP && request.playerIP !== 'unknown') {
      bannedIPs.push({
        ip: request.playerIP,
        playerName: request.playerName,
        reason: request.reason,
        bannedAt: Date.now()
      });
      saveBannedIPs(bannedIPs);
    }
  }
  
  // Remove from active requests
  banRequests = banRequests.filter(r => r.id !== requestId);
  saveBanRequests(banRequests);
  
  console.log(`✅ Ban request approved (${banType}) for ${request.playerName} (UUID: ${request.uuid}, IP: ${request.playerIP || 'N/A'})`);
  res.json({ success: true, message: `Ban request approved (${banType}) and saved to backup` });
});

// Reject ban request
adminApp.post('/api/admin/reject-ban-request', (req, res) => {
  const { requestId } = req.body;
  
  const request = banRequests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Request not found' });
  }
  
  // Save request to backup before removing
  saveRequestToBackup(request, 'rejected');
  
  // Remove from active requests
  banRequests = banRequests.filter(r => r.id !== requestId);
  saveBanRequests(banRequests);
  
  console.log(`❌ Ban request rejected for ${request.playerName} (UUID: ${request.uuid})`);
  res.json({ success: true, message: 'Ban request rejected and saved to backup' });
});

// Remove UUID ban
adminApp.post('/api/admin/unban-uuid', (req, res) => {
  const { uuid } = req.body;
  
  bannedUUIDs = bannedUUIDs.filter(ban => ban.uuid !== uuid);
  saveBannedUUIDs(bannedUUIDs);
  
  res.json({ success: true, message: 'UUID unbanned successfully' });
});

// Add IP ban
adminApp.post('/api/admin/ban-ip', (req, res) => {
  const { ip, reason, duration } = req.body;

  if (!ip || !reason) {
    return res.status(400).json({ 
      success: false, 
      error: 'IP address and reason are required' 
    });
  }

  // Check if already banned
  const existingBan = bannedIPs.find(ban => ban.ip === ip);
  if (existingBan) {
    return res.status(400).json({ 
      success: false, 
      error: 'IP address is already banned' 
    });
  }

  // Calculate unban date if duration is provided (in hours)
  let unbanDate = null;
  if (duration && duration > 0) {
    unbanDate = Date.now() + (duration * 60 * 60 * 1000); // Convert hours to milliseconds
  }

  // Add ban
  const ban = {
    ip,
    reason,
    timestamp: Date.now(),
    unbanDate,
    bannedBy: req.ip || 'admin'
  };

  bannedIPs.push(ban);
  
  if (saveBannedIPs(bannedIPs)) {
    const durationText = unbanDate ? ` (expires: ${new Date(unbanDate).toLocaleString()})` : ' (permanent)';
    console.log(`IP banned: ${ip} - Reason: ${reason}${durationText}`);
    res.json({ success: true, ban });
  } else {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save ban' 
    });
  }
});

// Remove IP ban
adminApp.post('/api/admin/unban-ip', (req, res) => {
  const { ip } = req.body;

  if (!ip) {
    return res.status(400).json({ 
      success: false, 
      error: 'IP address is required' 
    });
  }

  const initialLength = bannedIPs.length;
  bannedIPs = bannedIPs.filter(ban => ban.ip !== ip);

  if (bannedIPs.length === initialLength) {
    return res.status(404).json({ 
      success: false, 
      error: 'IP address not found in ban list' 
    });
  }

  if (saveBannedIPs(bannedIPs)) {
    console.log(`IP unbanned: ${ip}`);
    res.json({ success: true });
  } else {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save changes' 
    });
  }
});

// Import bans from JSON
adminApp.post('/api/admin/import-bans', (req, res) => {
  const { bans } = req.body;

  if (!Array.isArray(bans)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid format: Expected array of bans' 
    });
  }

  // Validate and merge bans (avoid duplicates)
  const existingIPs = new Set(bannedIPs.map(ban => ban.ip));
  let importCount = 0;

  bans.forEach(ban => {
    if (ban.ip && ban.reason && !existingIPs.has(ban.ip)) {
      bannedIPs.push({
        ip: ban.ip,
        reason: ban.reason,
        timestamp: ban.timestamp || Date.now(),
        bannedBy: 'imported'
      });
      existingIPs.add(ban.ip);
      importCount++;
    }
  });

  if (saveBannedIPs(bannedIPs)) {
    console.log(`Imported ${importCount} bans`);
    res.json({ success: true, count: importCount });
  } else {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save imported bans' 
    });
  }
});

// Clear all bans
adminApp.post('/api/admin/clear-bans', (req, res) => {
  bannedIPs = [];
  bannedUUIDs = [];
  
  const ipsSaved = saveBannedIPs(bannedIPs);
  const uuidsSaved = saveBannedUUIDs(bannedUUIDs);
  
  if (ipsSaved && uuidsSaved) {
    console.log('All bans cleared (IPs and UUIDs)');
    res.json({ success: true, message: 'All IP and UUID bans cleared' });
  } else {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear all bans' 
    });
  }
});

// Export function to check if IP is banned
function isIPBanned(ip) {
  const cleanIP = ip.replace('::ffff:', '');
  const ban = bannedIPs.find(ban => ban.ip === cleanIP);
  
  if (!ban) {
    return false;
  }
  
  // Check if ban has expired
  if (ban.unbanDate && ban.unbanDate <= Date.now()) {
    // Ban has expired, remove it
    console.log(`Ban expired for IP: ${cleanIP}, removing...`);
    bannedIPs = bannedIPs.filter(b => b.ip !== cleanIP);
    saveBannedIPs(bannedIPs);
    return false;
  }
  
  return true;
}

// Export function to get ban info
function getBanInfo(ip) {
  const cleanIP = ip.replace('::ffff:', '');
  const ban = bannedIPs.find(ban => ban.ip === cleanIP);
  
  if (!ban) {
    return null;
  }
  
  // Check if ban has expired
  if (ban.unbanDate && ban.unbanDate <= Date.now()) {
    // Ban has expired, remove it
    bannedIPs = bannedIPs.filter(b => b.ip !== cleanIP);
    saveBannedIPs(bannedIPs);
    return null;
  }
  
  return ban;
}

// Export function to reload bans (for external updates)
function reloadBannedIPs() {
  bannedIPs = loadBannedIPs();
}

// Start admin server
adminServer.listen(ADMIN_PORT, () => {
  console.log(`🔒 Admin panel running on http://localhost:${ADMIN_PORT}`);
  console.log(`⚠️  SECURITY: Ensure this port is protected by firewall rules!`);
});

// Export functions for use in main server
let mainServerIO = null; // Will be set by main server

module.exports = {
  isIPBanned,
  getBanInfo,
  reloadBannedIPs,
  getBannedIPs: () => bannedIPs,
  isUUIDBanned: (uuid) => {
    const ban = bannedUUIDs.find(ban => ban.uuid === uuid);
    if (!ban) return false;
    
    // Check if ban has expired
    if (ban.unbanDate && ban.unbanDate <= Date.now()) {
      // Ban has expired, remove it
      bannedUUIDs = bannedUUIDs.filter(b => b.uuid !== uuid);
      saveBannedUUIDs(bannedUUIDs);
      return false;
    }
    
    return true;
  },
  getUUIDBanInfo: (uuid) => {
    const ban = bannedUUIDs.find(ban => ban.uuid === uuid);
    if (!ban) return null;
    
    // Check if ban has expired
    if (ban.unbanDate && ban.unbanDate <= Date.now()) {
      // Ban has expired, remove it
      bannedUUIDs = bannedUUIDs.filter(b => b.uuid !== uuid);
      saveBannedUUIDs(bannedUUIDs);
      return null;
    }
    
    return ban;
  },
  addBanRequest: (request) => {
    request.id = Date.now() + Math.random().toString(36).substr(2, 9);
    request.status = 'pending';
    banRequests.push(request);
    saveBanRequests(banRequests);
  },
  setMainServerIO: (io) => {
    mainServerIO = io;
  },
  notifyUUIDBan: (uuid, playerName, reason, bannedAt, unbanDate) => {
    if (mainServerIO) {
      // Find all sockets with this UUID and disconnect them
      const sockets = mainServerIO.sockets.sockets;
      sockets.forEach((socket) => {
        // Check all connected players in all rooms
        const rooms = socket.rooms;
        rooms.forEach((roomCode) => {
          if (roomCode !== socket.id) { // Skip the socket's own room
            // This could be a game room, we need to check if this socket's UUID matches
            // We'll emit to all sockets and let them check their own UUID
          }
        });
      });
      
      // Broadcast to all connected clients to check if their UUID matches
      mainServerIO.emit('check-uuid-ban', { uuid, playerName, reason, bannedAt, unbanDate });
    }
  }
};
