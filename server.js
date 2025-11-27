require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the public directory
app.use(express.static('public'));

// API endpoint to get available subjects
app.get('/api/subjects', (req, res) => {
  const subjectList = Object.keys(subjects).map(key => ({
    id: key,
    name: key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    questionCount: subjects[key].length
  }));
  res.json(subjectList);
});

// Load all question files
const subjects = {};
const questionFiles = {
  'general': 'general-knowledge.json',
  'english': 'english-nz-year9-10.json',
  'mathematics': 'mathematics.json',
  'science': 'science.json',
  'history': 'history.json',
  'earth-science': 'earth-science-year9-10.json'
};

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
    questionStartTime: null // Track when question was sent
  };
  console.log(`Room ${roomCode} created`);
}

/**
 * Get sanitized question (without answer for certain types)
 */
function getSanitizedQuestion(question) {
  const sanitized = { ...question };
  // Don't send the answer to clients for questions that need validation
  if (question.type === 'multiple-choice' || question.type === 'truefalse') {
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
  console.log(`User connected: ${socket.id}`);

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

    // Don't allow changing subject after game has started
    if (rooms[roomCode].gameStarted) {
      socket.emit('error', { message: 'Cannot change subject after game has started' });
      return;
    }

    rooms[roomCode].subject = subject;
    rooms[roomCode].questions = subjects[subject];
    rooms[roomCode].questionIndex = -1; // Reset question index

    socket.emit('subject-changed', { 
      subject, 
      questionCount: subjects[subject].length 
    });
    
    console.log(`Room ${roomCode} subject changed to ${subject}`);
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

    rooms[roomCode].gameStarted = true;
    io.to(roomCode).emit('game-started');
    console.log(`Game started in room ${roomCode}`);
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
    
    io.to(roomCode).emit('game-ended', {
      message: 'Game ended by host',
      finalScores: Object.values(room.players)
    });
    console.log(`Game ended in room ${roomCode}`);
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
   * PLAYER: Join a room
   */
  socket.on('player-join-room', (data) => {
    const { roomCode, playerName } = data;
    
    if (!rooms[roomCode]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Validate username
    if (!isUsernameAppropriate(playerName)) {
      socket.emit('error', { message: 'Username contains inappropriate content. Please choose a different name.' });
      return;
    }

    // Add player to room
    rooms[roomCode].players[socket.id] = {
      name: playerName,
      score: 0,
      socketId: socket.id
    };

    socket.join(roomCode);
    socket.emit('room-joined', { roomCode, playerName });

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
    
    // Send current state to presenter
    socket.emit('player-list-updated', {
      players: Object.values(rooms[roomCode].players)
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

// Start the server
const PORT = process.env.PORT || 3000;
const URL = process.env.URL || `http://localhost:${PORT}`;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Host dashboard: http://localhost:${PORT}/host.html`);
  console.log(`Player interface: http://localhost:${PORT}`);
  console.log(`Quick Redirect: ${URL}`);
  console.log(`<--->\nLogs will appear below as players and hosts connect.\n<--->`);
});
