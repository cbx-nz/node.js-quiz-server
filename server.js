require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

// Start admin server
const adminServer = require('./admin-server');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Pass IO instance to admin server for real-time ban notifications
adminServer.setMainServerIO(io);

// Middleware for parsing JSON uploads (with size limit for security)
app.use(express.json({ limit: '5mb' }));

// Block access to admin.html from main server (only accessible via admin server port)
app.use((req, res, next) => {
  if (req.path === '/admin.html' || req.path === '/admin') {
    return res.status(403).send('Forbidden: Admin panel is only accessible on the admin server port');
  }
  next();
});

/**
 * Normalize IP address to handle localhost variations
 * Converts ::1, ::ffff:127.0.0.1, and 127.0.0.1 to a consistent format
 */
function normalizeIP(ip) {
  if (!ip) return ip;
  
  // Remove IPv6 prefix for IPv4-mapped addresses
  let normalized = ip.replace('::ffff:', '');
  
  // Convert IPv6 localhost (::1) to IPv4 localhost (127.0.0.1)
  if (normalized === '::1') {
    normalized = '127.0.0.1';
  }
  
  return normalized;
}

// IP ban middleware - check IP for page access (but not API endpoints)
app.use((req, res, next) => {
  // Skip IP check for API endpoints to prevent loops in devtunnel scenarios
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Skip IP check for ban page itself and allowed pages
  const allowedPaths = ['/ip-banned.html', '/game-banned.html', '/tos.html', '/privacy.html'];
  if (allowedPaths.some(path => req.path === path || req.path.endsWith(path))) {
    return next();
  }
  
  // Normalize client IP to handle localhost variations
  let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  clientIP = normalizeIP(clientIP);
  
  const ipBanInfo = adminServer.getBanInfo(clientIP);
  
  if (ipBanInfo) {
    // Redirect to ban page
    return res.redirect('/ip-banned.html');
  }
  
  next();
});

// API endpoint to check ban status (UUID only - IP checked via middleware)
// Note: This endpoint only checks the UUID ban status, not the requester's IP.
// This prevents loops when using devtunnels where all requests come from 127.0.0.1
app.get('/api/check-ban', (req, res) => {
  const userUUID = req.query.uuid;
  
  // Only check UUID ban (not requester's IP)
  if (userUUID && adminServer.isUUIDBanned(userUUID)) {
    const uuidBanInfo = adminServer.getUUIDBanInfo(userUUID);
    return res.json({
      banned: true,
      type: 'uuid',
      uuid: userUUID,
      reason: uuidBanInfo.reason,
      timestamp: uuidBanInfo.timestamp
    });
  }
  
  res.json({ banned: false });
});

// API endpoint to check IP ban status (for ip-banned.html page only)
app.get('/api/check-ip-ban', (req, res) => {
  let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  clientIP = normalizeIP(clientIP);
  const ipBanInfo = adminServer.getBanInfo(clientIP);
  
  if (ipBanInfo) {
    return res.json({
      banned: true,
      type: 'ip',
      ip: clientIP,
      reason: ipBanInfo.reason,
      bannedAt: ipBanInfo.bannedAt,
      unbanDate: ipBanInfo.unbanDate
    });
  }
  
  res.json({ banned: false });
});

// API endpoint to get available subjects
app.get('/api/subjects', (req, res) => {
  const subjectList = Object.keys(subjects).map(key => ({
    id: key,
    name: key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    questionCount: subjects[key].length
  }));
  res.json(subjectList);
});

// API endpoint to validate and use custom JSON questions (security-hardened)
app.post('/api/validate-questions', (req, res) => {
  try {
    const { questions: customQuestions } = req.body;

    // Security check 1: Validate input exists
    if (!customQuestions || !Array.isArray(customQuestions)) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Invalid format: Expected an array of questions' 
      });
    }

    // Security check 2: Limit number of questions (prevent DoS)
    if (customQuestions.length > 500) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Too many questions. Maximum is 500 questions per set.' 
      });
    }

    // Security check 3: Validate each question structure
    const validQuestions = [];
    const errors = [];

    customQuestions.forEach((q, index) => {
      // Check required fields
      if (!q.type || !q.question) {
        errors.push(`Question ${index + 1}: Missing required fields (type, question)`);
        return;
      }

      // Validate question type
      const validTypes = ['multiple-choice', 'truefalse', 'text', 'flashcard', 'decision'];
      if (!validTypes.includes(q.type)) {
        errors.push(`Question ${index + 1}: Invalid type "${q.type}"`);
        return;
      }

      // Security check 4: Sanitize strings (prevent XSS)
      const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        return str
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .substring(0, 5000); // Limit string length
      };

      // Build sanitized question object
      const sanitizedQuestion = {
        type: q.type,
        question: sanitizeString(q.question),
        explanation: q.explanation ? sanitizeString(q.explanation) : ''
      };

      // Validate type-specific fields
      if (q.type === 'multiple-choice' || q.type === 'truefalse') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          errors.push(`Question ${index + 1}: Invalid options array`);
          return;
        }
        if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length) {
          errors.push(`Question ${index + 1}: Invalid answer index`);
          return;
        }
        sanitizedQuestion.options = q.options.map(opt => sanitizeString(String(opt))).slice(0, 10);
        sanitizedQuestion.answer = q.answer;
      }

      validQuestions.push(sanitizedQuestion);
    });

    // Return validation results
    if (errors.length > 0 && validQuestions.length === 0) {
      return res.status(400).json({ 
        valid: false, 
        error: errors.join('; ') 
      });
    }

    res.json({ 
      valid: true, 
      questionCount: validQuestions.length,
      questions: validQuestions,
      warnings: errors.length > 0 ? errors : null
    });

  } catch (error) {
    console.error('Error validating questions:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Server error while validating questions' 
    });
  }
});

// Serve static files from the public directory (AFTER API routes)
app.use(express.static('public'));

// Load all question files
const subjects = {};
let questionFiles = {};

// Load question files mapping from JSON
try {
  const questionFilesData = fs.readFileSync(path.join(__dirname, 'question-files.json'), 'utf8');
  questionFiles = JSON.parse(questionFilesData);
  console.log('Loaded question files mapping from question-files.json');
} catch (error) {
  console.error('Error loading question-files.json:', error);
}

try {
  for (const [key, filename] of Object.entries(questionFiles)) {
    const questionsData = fs.readFileSync(path.join(__dirname, 'questions', filename), 'utf8');
    subjects[key] = JSON.parse(questionsData);
    console.log(`Loaded ${subjects[key].length} questions for ${key}`);
  }
} catch (error) {
  console.error('Error loading questions:', error);
}

// For backward compatibility, set default questions
let questions = subjects['general'] || [];

// Load inappropriate words filter
let inappropriateWords = [];
try {
  const wordsData = fs.readFileSync(path.join(__dirname, 'inappropriate-words.json'), 'utf8');
  inappropriateWords = JSON.parse(wordsData).map(word => word.toLowerCase());
  console.log(`Loaded ${inappropriateWords.length} inappropriate words`);
} catch (error) {
  console.error('Error loading inappropriate words:', error);
}

// Store room data: { roomCode: { players: {}, currentQuestion: null, questionIndex: 0, answers: {} } }
const rooms = {};

/**
 * Generate a random 6-character room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Check if code already exists
  if (rooms[code]) {
    return generateRoomCode();
  }
  return code;
}

/**
 * Initialize a new room
 */
function createRoom(roomCode) {
  rooms[roomCode] = {
    players: {}, // { socketId: { name, score, socketId } }
    currentQuestion: null,
    questionIndex: -1,
    answers: {}, // { socketId: { answer, correct, timestamp } }
    gameStarted: false,
    gameEnded: false,
    host: null,
    presenters: [], // Array of presenter socket IDs
    subject: 'general', // Default subject
    questions: subjects['general'] || [], // Questions for this room
    questionStartTime: null, // Track when question was sent
    clapCount: 0 // Track total claps for end of game
  };
  console.log(`Room ${roomCode} created`);
}

/**
 * Get sanitized question (without answer for certain types)
 */
function getSanitizedQuestion(question) {
  const sanitized = { ...question };
  // Don't send the answer to clients for questions that need validation
  if (question.type === 'multiple-choice' || question.type === 'truefalse' || question.type === 'multi-choice') {
    delete sanitized.answer;
  }
  return sanitized;
}

/**
 * Check if an answer is correct
 */
function checkAnswer(question, userAnswer) {
  if (question.type === 'multiple-choice' || question.type === 'truefalse') {
    return question.answer === userAnswer;
  }
  if (question.type === 'multi-choice') {
    // Multi-choice: compare arrays (all correct answers must be selected)
    if (!Array.isArray(userAnswer) || !Array.isArray(question.answer)) {
      return false;
    }
    // Sort both arrays and compare
    const sortedUser = [...userAnswer].sort((a, b) => a - b);
    const sortedCorrect = [...question.answer].sort((a, b) => a - b);
    return JSON.stringify(sortedUser) === JSON.stringify(sortedCorrect);
  }
  // For decision, flashcard, and open questions, there's no "correct" answer
  return null;
}

/**
 * Validate username against inappropriate words
 */
function isUsernameAppropriate(username) {
  const lowerUsername = username.toLowerCase();
  for (const word of inappropriateWords) {
    if (lowerUsername.includes(word)) {
      return false;
    }
  }
  return true;
}

/**
 * Calculate score based on answer time (max 1000 points)
 */
function calculateScore(room, timestamp) {
  const answeredPlayers = Object.values(room.answers);
  const sortedByTime = answeredPlayers.sort((a, b) => a.timestamp - b.timestamp);
  const position = sortedByTime.findIndex(a => a.timestamp === timestamp);
  
  // First player gets 1000, decreases by 100 for each position
  const baseScore = Math.max(100, 1000 - (position * 100));
  return baseScore;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  // Get client IP address and normalize it
  let clientIP = socket.handshake.address || '';
  clientIP = normalizeIP(clientIP);
  console.log(`User connected: ${socket.id} from IP: ${clientIP}`);

  // Check if IP is banned
  if (adminServer.isIPBanned(clientIP)) {
    const banInfo = adminServer.getBanInfo(clientIP);
    console.log(`Blocked connection from banned IP: ${clientIP}`);
    socket.emit('banned', { 
      message: 'Your IP address has been banned from this server.',
      reason: banInfo ? banInfo.reason : 'Prohibited conduct',
      ip: clientIP,
      unbanDate: banInfo ? banInfo.unbanDate : null
    });
    socket.disconnect(true);
    return;
  }

  /**
   * HOST: Create a new room
   */
  socket.on('host-create-room', () => {
    const roomCode = generateRoomCode();
    createRoom(roomCode);
    rooms[roomCode].host = socket.id;
    socket.join(roomCode);
    socket.emit('room-created', { roomCode });
    console.log(`Host ${socket.id} created room ${roomCode}`);
  });

  /**
   * HOST: Set subject for the room
   */
  socket.on('host-set-subject', (data) => {
    const { roomCode, subject } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    if (!subjects[subject]) {
      socket.emit('error', { message: 'Invalid subject' });
      return;
    }

    // Don't allow changing subject while game is actively running
    if (rooms[roomCode].gameStarted && !rooms[roomCode].gameEnded) {
      socket.emit('error', { message: 'Cannot change subject while game is running' });
      return;
    }

    rooms[roomCode].subject = subject;
    rooms[roomCode].questions = subjects[subject];
    rooms[roomCode].questionIndex = -1; // Reset question index

    socket.emit('subject-changed', { 
      subject, 
      questionCount: subjects[subject].length 
    });
    
    // Notify presenters of subject change
    if (rooms[roomCode].presenters) {
      rooms[roomCode].presenters.forEach(presenterSocketId => {
        io.to(presenterSocketId).emit('subject-info', {
          subject: subject
        });
      });
    }
    
    console.log(`Room ${roomCode} subject changed to ${subject}`);
  });

  /**
   * HOST: Set custom questions for the room
   */
  socket.on('host-set-custom-questions', (data) => {
    const { roomCode, questions } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      socket.emit('error', { message: 'Invalid questions array' });
      return;
    }

    // Don't allow changing questions while game is actively running
    if (rooms[roomCode].gameStarted && !rooms[roomCode].gameEnded) {
      socket.emit('error', { message: 'Cannot change questions while game is running' });
      return;
    }

    rooms[roomCode].subject = 'custom';
    rooms[roomCode].questions = questions;
    rooms[roomCode].questionIndex = -1; // Reset question index

    socket.emit('subject-changed', { 
      subject: 'custom', 
      questionCount: questions.length 
    });
    
    // Notify presenters of subject change to custom
    if (rooms[roomCode].presenters) {
      rooms[roomCode].presenters.forEach(presenterSocketId => {
        io.to(presenterSocketId).emit('subject-info', {
          subject: 'custom'
        });
      });
    }
    
    console.log(`Room ${roomCode} loaded ${questions.length} custom questions`);
  });

  /**
   * HOST: Start the game
   */
  socket.on('host-start-game', (data) => {
    const { roomCode } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    const room = rooms[roomCode];
    room.gameStarted = true;
    room.gameEnded = false;
    
    // Reset all player scores if starting a new game after ending
    Object.values(room.players).forEach(player => {
      player.score = 0;
    });
    
    // Immediately load the first question
    room.questionIndex = 0;
    room.answers = {};
    room.currentQuestion = room.questions[room.questionIndex];
    room.questionStartTime = Date.now();

    // Notify game started
    io.to(roomCode).emit('game-started');
    
    // Send updated player list with reset scores
    io.to(roomCode).emit('player-list-updated', {
      players: Object.values(room.players)
    });

    // Send first question to everyone
    const sanitizedQuestion = getSanitizedQuestion(room.currentQuestion);
    io.to(roomCode).emit('new-question', {
      question: sanitizedQuestion,
      questionNumber: room.questionIndex + 1,
      totalQuestions: room.questions.length
    });

    console.log(`Game started in room ${roomCode} with first question`);
  });

  /**
   * HOST: Kick a player from the room
   */
  socket.on('host-kick-player', (data) => {
    const { roomCode, socketId } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    const room = rooms[roomCode];
    if (room.players[socketId]) {
      const playerName = room.players[socketId].name;
      
      // Notify the kicked player
      io.to(socketId).emit('kicked', { message: 'You have been removed from the game by the host' });
      
      // Remove player
      delete room.players[socketId];
      delete room.answers[socketId];
      
      // Update player list for everyone
      io.to(roomCode).emit('player-list-updated', {
        players: Object.values(room.players)
      });
      
      console.log(`Host kicked player ${playerName} (${socketId}) from room ${roomCode}`);
    }
  });

  /**
   * HOST: Request a ban for a player
   */
  socket.on('host-request-ban', (data) => {
    const { roomCode, socketId, playerName, reason } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    const room = rooms[roomCode];
    const player = room.players[socketId];
    
    if (!player) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    // Get player's UUID and IP from room data and socket
    const playerUUID = player.userUUID || 'unknown';
    const playerSocket = io.sockets.sockets.get(socketId);
    let playerIP = playerSocket ? (playerSocket.handshake.headers['x-forwarded-for'] || playerSocket.handshake.address) : 'unknown';
    playerIP = normalizeIP(playerIP);

    // Create ban request
    const banRequest = {
      playerName: playerName,
      uuid: playerUUID,
      playerIP: playerIP,
      reason: reason,
      requestedBy: `Host of room ${roomCode}`,
      roomCode: roomCode,
      timestamp: Date.now()
    };

    // Add to admin server's ban requests
    adminServer.addBanRequest(banRequest);

    console.log(`Ban request submitted for ${playerName} (UUID: ${playerUUID}) in room ${roomCode}`);
  });

  /**
   * HOST: Load next question
   */
  socket.on('host-next-question', (data) => {
    const { roomCode } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    const room = rooms[roomCode];
    
    // Check if game has been ended
    if (room.gameEnded) {
      socket.emit('error', { message: 'Game has ended. Cannot load more questions.' });
      return;
    }
    
    room.questionIndex++;
    
    if (room.questionIndex >= room.questions.length) {
      room.gameEnded = true;
      io.to(roomCode).emit('game-ended', { 
        message: 'No more questions!',
        finalScores: Object.values(room.players)
      });
      return;
    }

    // Clear previous answers and set start time
    room.answers = {};
    room.currentQuestion = room.questions[room.questionIndex];
    room.questionStartTime = Date.now();

    // Send sanitized question to everyone including presenters
    const sanitizedQuestion = getSanitizedQuestion(room.currentQuestion);
    io.to(roomCode).emit('new-question', {
      question: sanitizedQuestion,
      questionNumber: room.questionIndex + 1,
      totalQuestions: room.questions.length
    });

    console.log(`Room ${roomCode}: Question ${room.questionIndex + 1} sent`);
  });

  /**
   * HOST: End the game
   */
  socket.on('host-end-game', (data) => {
    const { roomCode } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    const room = rooms[roomCode];
    room.gameEnded = true;
    room.gameStarted = false;
    room.clapCount = 0; // Reset clap count for next game
    
    // Don't delete room or players, just end the game
    io.to(roomCode).emit('game-ended', {
      message: 'Game ended by host. Waiting for next game...',
      finalScores: Object.values(room.players)
    });
    console.log(`Game ended in room ${roomCode} (room still active)`);
  });

  /**
   * HOST: End room completely (disconnect all players and delete room)
   */
  socket.on('host-end-room', (data) => {
    const { roomCode } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    // Notify all players that room is closing
    io.to(roomCode).emit('room-closed', {
      message: 'Room has been closed by the host'
    });

    // Delete the room
    delete rooms[roomCode];
    console.log(`Room ${roomCode} completely closed and deleted`);
  });

  /**
   * HOST: Reveal answer on presenter
   */
  socket.on('host-reveal-answer', (data) => {
    const { roomCode } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    const room = rooms[roomCode];
    if (!room.currentQuestion) {
      socket.emit('error', { message: 'No active question' });
      return;
    }

    // Send reveal to presenters
    room.presenters.forEach(presenterSocketId => {
      io.to(presenterSocketId).emit('reveal-answer', {
        correctAnswer: room.currentQuestion.answer,
        explanation: room.currentQuestion.explanation
      });
    });
    
    // Also send reveal to all players
    io.to(roomCode).emit('reveal-answer-players', {
      correctAnswer: room.currentQuestion.answer,
      explanation: room.currentQuestion.explanation
    });

    // Send individual results to each player who answered
    Object.keys(room.players).forEach(playerId => {
      const playerAnswer = room.answers[playerId];
      if (playerAnswer) {
        io.to(playerId).emit('answer-result', {
          correct: playerAnswer.correct,
          correctAnswer: room.currentQuestion.answer,
          explanation: room.currentQuestion.explanation,
          score: playerAnswer.correct ? calculateScore(room, playerAnswer.timestamp) : 0
        });
      }
    });

    console.log(`Host revealed answer in room ${roomCode}`);
  });

  /**
   * HOST: Broadcast message to all players
   */
  socket.on('host-broadcast-message', (data) => {
    const { roomCode, message } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    io.to(roomCode).emit('host-message', { message });
    console.log(`Host broadcast to room ${roomCode}: ${message}`);
  });

  /**
   * HOST: Broadcast message to specific players
   */
  socket.on('host-broadcast-targeted', (data) => {
    const { roomCode, message, playerIds } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    // Send to specific players
    playerIds.forEach(playerId => {
      io.to(playerId).emit('host-message', { message });
    });
    
    console.log(`Host sent targeted broadcast to ${playerIds.length} players in room ${roomCode}`);
  });

  /**
   * HOST: Broadcast message to presenter
   */
  socket.on('host-broadcast-presenter', (data) => {
    const { roomCode, message } = data;
    if (!rooms[roomCode] || rooms[roomCode].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized or room not found' });
      return;
    }

    // Send to all presenters
    rooms[roomCode].presenters.forEach(presenterSocketId => {
      io.to(presenterSocketId).emit('presenter-message', { message });
    });
    
    console.log(`Host sent broadcast to presenter in room ${roomCode}`);
  });

  /**
   * PLAYER: Join a room
   */
  socket.on('player-join-room', (data) => {
    const { roomCode, playerName, userUUID } = data;
    
    if (!rooms[roomCode]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Check if UUID is banned
    if (userUUID && adminServer.isUUIDBanned(userUUID)) {
      const banInfo = adminServer.getUUIDBanInfo(userUUID);
      console.log(`Blocked connection from banned UUID: ${userUUID}`);
      socket.emit('uuid-banned', { 
        message: 'You have been banned from this server.',
        reason: banInfo ? banInfo.reason : 'Prohibited conduct',
        playerName: banInfo ? banInfo.playerName : playerName,
        bannedAt: banInfo ? banInfo.bannedAt : Date.now(),
        unbanDate: banInfo ? banInfo.unbanDate : null,
        uuid: userUUID
      });
      socket.disconnect(true);
      return;
    }
    
    // Validate username
    if (!isUsernameAppropriate(playerName)) {
      socket.emit('error', { message: 'Username contains inappropriate content. Please choose a different name.' });
      return;
    }

    // Add player to room with UUID
    rooms[roomCode].players[socket.id] = {
      name: playerName,
      score: 0,
      socketId: socket.id,
      userUUID: userUUID || null
    };

    socket.join(roomCode);
    socket.emit('room-joined', { 
      roomCode, 
      playerName,
      score: rooms[roomCode].players[socket.id].score
    });

    // Notify host and all players of the new player
    io.to(roomCode).emit('player-list-updated', {
      players: Object.values(rooms[roomCode].players)
    });
    
    // If game is in progress, send current question to new player
    if (rooms[roomCode].gameStarted && rooms[roomCode].currentQuestion) {
      const sanitizedQuestion = getSanitizedQuestion(rooms[roomCode].currentQuestion);
      socket.emit('new-question', {
        question: sanitizedQuestion,
        questionNumber: rooms[roomCode].questionIndex + 1,
        totalQuestions: rooms[roomCode].questions.length
      });
    }

    console.log(`Player ${playerName} (${socket.id}) joined room ${roomCode}`);
  });

  /**
   * PRESENTER: Join a room as presenter
   */
  socket.on('presenter-join-room', (data) => {
    const { roomCode } = data;
    
    if (!rooms[roomCode]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Add presenter to room
    rooms[roomCode].presenters.push(socket.id);
    socket.join(roomCode);
    
    // Send current state to presenter including subject info
    socket.emit('player-list-updated', {
      players: Object.values(rooms[roomCode].players)
    });
    
    // Send subject information
    socket.emit('subject-info', {
      subject: rooms[roomCode].subject,
      questionCount: rooms[roomCode].questions.length
    });

    // If game has started and there's a current question, send it
    if (rooms[roomCode].gameStarted && rooms[roomCode].currentQuestion) {
      const room = rooms[roomCode];
      const sanitizedQuestion = getSanitizedQuestion(room.currentQuestion);
      
      socket.emit('new-question', {
        question: sanitizedQuestion,
        questionNumber: room.questionIndex + 1,
        totalQuestions: room.questions.length
      });
      
      // Send current answer stats
      const totalPlayers = Object.keys(room.players).length;
      const answeredCount = Object.keys(room.answers).length;
      socket.emit('answer-stats', {
        answered: answeredCount,
        total: totalPlayers,
        answers: Object.values(room.answers)
      });
      
      // If all players have answered, send reveal event
      if (answeredCount === totalPlayers && totalPlayers > 0) {
        socket.emit('reveal-answer', {
          correctAnswer: room.currentQuestion.answer,
          explanation: room.currentQuestion.explanation
        });
      }
    }

    console.log(`Presenter (${socket.id}) joined room ${roomCode}`);
  });

  /**
   * PLAYER: Submit an answer
   */
  socket.on('player-submit-answer', (data) => {
    const { roomCode, answer } = data;
    
    if (!rooms[roomCode]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const room = rooms[roomCode];
    if (!room.currentQuestion) {
      socket.emit('error', { message: 'No active question' });
      return;
    }

    // Check if answer is correct
    const isCorrect = checkAnswer(room.currentQuestion, answer);
    
    // Store the answer
    const timestamp = Date.now();
    room.answers[socket.id] = {
      answer,
      correct: isCorrect,
      timestamp: timestamp,
      playerName: room.players[socket.id]?.name
    };

    // Calculate score based on position (time-based)
    let scoreToAdd = 0;
    if (isCorrect === true) {
      scoreToAdd = calculateScore(room, timestamp);
      room.players[socket.id].score += scoreToAdd;
    }

    // DON'T send feedback to the player yet - wait for reveal
    // Just acknowledge receipt
    socket.emit('answer-submitted', {
      message: 'Answer submitted! Waiting for results...'
    });

    // Notify host of the answer
    io.to(room.host).emit('player-answered', {
      playerName: room.players[socket.id]?.name,
      answer,
      correct: isCorrect,
      score: scoreToAdd
    });

    // Send updated statistics to everyone
    const totalPlayers = Object.keys(room.players).length;
    const answeredCount = Object.keys(room.answers).length;
    
    io.to(roomCode).emit('answer-stats', {
      answered: answeredCount,
      total: totalPlayers,
      answers: Object.values(room.answers)
    });

    // Update player list with new scores for host and presenter
    io.to(roomCode).emit('player-list-updated', {
      players: Object.values(room.players)
    });

    // If all players have answered, reveal the correct answer to everyone
    if (answeredCount === totalPlayers && totalPlayers > 0) {
      // Reveal to presenters
      room.presenters.forEach(presenterSocketId => {
        io.to(presenterSocketId).emit('reveal-answer', {
          correctAnswer: room.currentQuestion.answer,
          explanation: room.currentQuestion.explanation
        });
      });
      
      // Reveal to all players
      io.to(roomCode).emit('reveal-answer-players', {
        correctAnswer: room.currentQuestion.answer,
        explanation: room.currentQuestion.explanation
      });
      
      // Send individual results to each player
      Object.keys(room.players).forEach(playerId => {
        const playerAnswer = room.answers[playerId];
        if (playerAnswer) {
          io.to(playerId).emit('answer-result', {
            correct: playerAnswer.correct,
            correctAnswer: room.currentQuestion.answer,
            explanation: room.currentQuestion.explanation,
            score: playerAnswer.correct ? calculateScore(room, playerAnswer.timestamp) : 0
          });
        }
      });
    }

    console.log(`Player ${socket.id} answered in room ${roomCode}`);
  });

  /**
   * PLAYER: Clap button pressed
   */
  socket.on('player-clap', (data) => {
    const { roomCode } = data;
    
    if (!rooms[roomCode]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const room = rooms[roomCode];
    
    // Increment clap count
    room.clapCount++;
    
    // Broadcast updated clap count to everyone in the room
    io.to(roomCode).emit('clap-update', {
      totalClaps: room.clapCount
    });

    console.log(`Player clapped in room ${roomCode}, total claps: ${room.clapCount}`);
  });

  /**
   * Handle player disconnect (explicit)
   */
  socket.on('player-disconnect', ({ roomCode, playerName }) => {
    if (!rooms[roomCode]) return;

    const room = rooms[roomCode];
    
    // Remove the player
    if (room.players[socket.id]) {
      delete room.players[socket.id];
      delete room.answers[socket.id];
      
      const playersList = Object.keys(room.players).map(id => ({
        name: room.players[id].name,
        score: room.players[id].score,
        socketId: id
      }));

      io.to(roomCode).emit('player-list-updated', {
        players: playersList,
        count: playersList.length
      });

      console.log(`Player ${playerName} (${socket.id}) disconnected from room ${roomCode}`);
    }
  });

  /**
   * Handle disconnection
   */
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    // Remove player from all rooms
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      
      // If host disconnected, notify players
      if (room.host === socket.id) {
        io.to(roomCode).emit('host-disconnected');
        delete rooms[roomCode];
        console.log(`Room ${roomCode} deleted (host disconnected)`);
        continue;
      }

      // If player disconnected, remove them
      if (room.players[socket.id]) {
        const playerName = room.players[socket.id].name;
        delete room.players[socket.id];
        delete room.answers[socket.id];
        
        io.to(roomCode).emit('player-list-updated', {
          players: Object.values(room.players)
        });
        
        console.log(`Player ${playerName} (${socket.id}) left room ${roomCode}`);
      }
    }
  });
});

// Update global stats for admin panel
function updateGlobalStats() {
  global.activeRooms = Object.keys(rooms).length;
  
  // Count only players and hosts (not presenters or other connections)
  let playerAndHostCount = 0;
  for (const roomCode in rooms) {
    const room = rooms[roomCode];
    // Add 1 for the host
    playerAndHostCount += 1;
    // Add the number of players
    playerAndHostCount += Object.keys(room.players).length;
  }
  
  global.connectedUsers = playerAndHostCount;
}

// Update stats every 5 seconds
setInterval(updateGlobalStats, 5000);

// Start the server
const PORT = process.env.PORT || 3000;
const URL = process.env.URL || `http://localhost:${PORT}`;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Host dashboard: http://localhost:${PORT}/host.html`);
  console.log(`Player interface: http://localhost:${PORT}`);
  console.log(`cbx-nz developer link: ${URL}`);
  console.log(`<--->\nLogs will appear below as players and hosts connect.\n<--->`);
  updateGlobalStats();
});
