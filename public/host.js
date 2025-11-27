// Initialize Socket.io connection
const socket = io();

// DOM Elements
const createScreen = document.getElementById('createScreen');
const controlScreen = document.getElementById('controlScreen');
const createRoomButton = document.getElementById('createRoomButton');
const subjectSelect = document.getElementById('subjectSelect');
const subjectInfo = document.getElementById('subjectInfo');

const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const gameStatus = document.getElementById('gameStatus');

const startButton = document.getElementById('startButton');
const nextButton = document.getElementById('nextButton');
const endButton = document.getElementById('endButton');
const broadcastButton = document.getElementById('broadcastButton');
const broadcastInput = document.getElementById('broadcastInput');
const presenterButton = document.getElementById('presenterButton');
const revealButton = document.getElementById('revealButton');

const totalPlayers = document.getElementById('totalPlayers');
const currentQuestion = document.getElementById('currentQuestion');
const answeredCount = document.getElementById('answeredCount');

const currentQuestionSection = document.getElementById('currentQuestionSection');
const questionTypeDisplay = document.getElementById('questionTypeDisplay');
const questionTextDisplay = document.getElementById('questionTextDisplay');
const answersListDisplay = document.getElementById('answersListDisplay');

const playersList = document.getElementById('playersList');
const playerCount = document.getElementById('playerCount');
const errorDisplay = document.getElementById('errorDisplay');

// State
let roomCode = '';
let players = [];
let gameStarted = false;
let questionIndex = 0;
let currentAnswers = [];
let selectedSubject = 'general';

/**
 * Load available subjects from server
 */
async function loadSubjects() {
  try {
    const response = await fetch('/api/subjects');
    const subjects = await response.json();
    
    subjectSelect.innerHTML = '';
    subjects.forEach(subject => {
      const option = document.createElement('option');
      option.value = subject.id;
      option.textContent = `${subject.name} (${subject.questionCount} questions)`;
      if (subject.id === 'general') {
        option.selected = true;
      }
      subjectSelect.appendChild(option);
    });
    
    // Set initial subject info
    updateSubjectInfo();
  } catch (error) {
    console.error('Error loading subjects:', error);
    subjectSelect.innerHTML = '<option value="general">General Knowledge</option>';
    showError('Could not load subjects. Using default.');
  }
}

/**
 * Update subject info display
 */
function updateSubjectInfo() {
  const selectedOption = subjectSelect.options[subjectSelect.selectedIndex];
  if (selectedOption) {
    subjectInfo.textContent = `Selected: ${selectedOption.textContent}`;
  }
}

// Load subjects when page loads
loadSubjects();

// Update subject info when selection changes
subjectSelect.addEventListener('change', () => {
  selectedSubject = subjectSelect.value;
  updateSubjectInfo();
});

/**
 * Show a specific screen
 */
function showScreen(screen) {
  createScreen.classList.remove('active');
  controlScreen.classList.remove('active');
  screen.classList.add('active');
}

/**
 * Show error message
 */
function showError(message) {
  errorDisplay.textContent = message;
  errorDisplay.style.display = 'block';
  setTimeout(() => {
    errorDisplay.style.display = 'none';
  }, 5000);
}

/**
 * Update player list display
 */
function updatePlayersList() {
  totalPlayers.textContent = players.length;
  playerCount.textContent = players.length;

  if (players.length === 0) {
    playersList.innerHTML = '<div class="empty-state">No players connected yet</div>';
    return;
  }

  playersList.innerHTML = '';
  players.forEach(player => {
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    playerCard.innerHTML = `
      <span class="player-name">${player.name}</span>
      <div style="display: flex; gap: 10px; align-items: center;">
        <span class="player-score">${player.score} pts</span>
        <button class="btn-kick" data-socket-id="${player.socketId}" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px;">❌ Kick</button>
      </div>
    `;
    playersList.appendChild(playerCard);
  });
  
  // Add event listeners to kick buttons
  document.querySelectorAll('.btn-kick').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const socketId = e.target.dataset.socketId;
      const player = players.find(p => p.socketId === socketId);
      if (player && confirm(`Remove ${player.name} from the game?`)) {
        socket.emit('host-kick-player', { roomCode, socketId });
      }
    });
  });
}

/**
 * Update answers display
 */
function updateAnswersDisplay() {
  if (currentAnswers.length === 0) {
    answersListDisplay.innerHTML = '<p style="color: #999; font-style: italic;">No answers yet...</p>';
    return;
  }

  answersListDisplay.innerHTML = '<h4 style="margin-bottom: 10px;">Player Responses:</h4>';
  currentAnswers.forEach(answerData => {
    const answerDiv = document.createElement('div');
    answerDiv.className = 'answer-item';
    
    if (answerData.correct === true) {
      answerDiv.classList.add('correct');
    } else if (answerData.correct === false) {
      answerDiv.classList.add('incorrect');
    }

    let answerText = '';
    if (typeof answerData.answer === 'number') {
      answerText = `Option ${answerData.answer + 1}`;
    } else {
      answerText = answerData.answer;
    }

    let resultIcon = '';
    let scoreText = '';
    if (answerData.correct === true) {
      resultIcon = '✅';
      // Calculate position-based score display
      const sortedAnswers = currentAnswers.filter(a => a.correct).sort((a, b) => a.timestamp - b.timestamp);
      const position = sortedAnswers.findIndex(a => a.timestamp === answerData.timestamp);
      const score = Math.max(100, 1000 - (position * 100));
      scoreText = ` (+${score} pts)`;
    } else if (answerData.correct === false) {
      resultIcon = '❌';
    } else {
      resultIcon = '📝';
    }

    answerDiv.innerHTML = `
      <span><strong>${answerData.playerName}:</strong> ${answerText}${scoreText}</span>
      <span>${resultIcon}</span>
    `;
    answersListDisplay.appendChild(answerDiv);
  });
}

/**
 * Create a new room
 */
createRoomButton.addEventListener('click', () => {
  socket.emit('host-create-room');
  createRoomButton.disabled = true;
  createRoomButton.textContent = 'Creating room...';
});

/**
 * Handle room created
 */
socket.on('room-created', (data) => {
  roomCode = data.roomCode;
  roomCodeDisplay.textContent = roomCode;
  
  // Set the subject for this room
  socket.emit('host-set-subject', { roomCode, subject: selectedSubject });
  
  showScreen(controlScreen);
  gameStatus.textContent = 'Room created! Waiting for players...';
  console.log('Room created:', roomCode);
});

/**
 * Open presenter view
 */
presenterButton.addEventListener('click', () => {
  if (!roomCode) {
    showError('Please create a room first');
    return;
  }
  
  // Open presenter view in a new window
  const presenterUrl = `/presenter.html?room=${roomCode}`;
  window.open(presenterUrl, 'presenter', 'width=1920,height=1080');
});

/**
 * Start the game
 */
startButton.addEventListener('click', () => {
  if (players.length === 0) {
    showError('Cannot start game - no players connected!');
    return;
  }

  socket.emit('host-start-game', { roomCode });
  startButton.disabled = true;
  gameStarted = true;
  gameStatus.textContent = 'Game started! Use "Next Question" to begin.';
  nextButton.disabled = false;
  endButton.disabled = false;
  revealButton.disabled = false;
});

/**
 * Load next question
 */
nextButton.addEventListener('click', () => {
  socket.emit('host-next-question', { roomCode });
  questionIndex++;
  currentQuestion.textContent = questionIndex;
  answeredCount.textContent = '0';
  currentAnswers = [];
  gameStatus.textContent = `Question ${questionIndex} active - waiting for answers...`;
  revealButton.disabled = false;
  revealButton.textContent = '👁️ Reveal Answer';
});

/**
 * Reveal answer on presenter
 */
revealButton.addEventListener('click', () => {
  socket.emit('host-reveal-answer', { roomCode });
  revealButton.disabled = true;
  revealButton.textContent = '✓ Answer Revealed';
  setTimeout(() => {
    revealButton.textContent = '👁️ Reveal Answer';
  }, 2000);
});

/**
 * End the game
 */
endButton.addEventListener('click', () => {
  if (confirm('Are you sure you want to end the game?')) {
    socket.emit('host-end-game', { roomCode });
    gameStatus.textContent = 'Game ended!';
    startButton.disabled = false;
    nextButton.disabled = true;
    endButton.disabled = true;
    revealButton.disabled = true;
    gameStarted = false;
    questionIndex = 0;
    currentQuestion.textContent = '0';
    currentQuestionSection.style.display = 'none';
  }
});

/**
 * Broadcast message
 */
broadcastButton.addEventListener('click', () => {
  const message = broadcastInput.value.trim();
  if (!message) {
    showError('Please enter a message');
    return;
  }

  socket.emit('host-broadcast-message', { roomCode, message });
  broadcastInput.value = '';
  
  // Show confirmation
  gameStatus.textContent = `Broadcast sent: "${message}"`;
  setTimeout(() => {
    if (gameStarted) {
      gameStatus.textContent = `Question ${questionIndex} active - waiting for answers...`;
    } else {
      gameStatus.textContent = 'Waiting to start game...';
    }
  }, 3000);
});

// Enable Enter key for broadcast
broadcastInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    broadcastButton.click();
  }
});

/**
 * Handle player list updates
 */
socket.on('player-list-updated', (data) => {
  players = data.players;
  updatePlayersList();
  
  if (!gameStarted && players.length > 0) {
    gameStatus.textContent = `${players.length} player(s) connected. Ready to start!`;
  }
});

/**
 * Handle new question sent to players
 */
socket.on('new-question', (data) => {
  currentQuestionSection.style.display = 'block';
  questionTypeDisplay.textContent = data.question.type.toUpperCase();
  questionTextDisplay.textContent = data.question.question;
  
  // Clear previous answers
  answersListDisplay.innerHTML = '<p style="color: #999; font-style: italic;">Waiting for player responses...</p>';
  currentAnswers = [];
  answeredCount.textContent = '0';
});

/**
 * Handle player answered
 */
socket.on('player-answered', (data) => {
  console.log('Player answered:', data);
  // The answer stats event will update the display
});

/**
 * Handle answer statistics
 */
socket.on('answer-stats', (data) => {
  answeredCount.textContent = data.answered;
  currentAnswers = data.answers;
  updateAnswersDisplay();
  
  if (data.answered === players.length && players.length > 0) {
    gameStatus.textContent = `All players answered! Click "Next Question" to continue.`;
  }
});

/**
 * Handle game started confirmation
 */
socket.on('game-started', () => {
  console.log('Game started event received');
});

/**
 * Handle game ended confirmation
 */
socket.on('game-ended', (data) => {
  console.log('Game ended:', data);
  currentQuestionSection.style.display = 'none';
});

/**
 * Handle errors
 */
socket.on('error', (data) => {
  showError(data.message);
});

/**
 * Handle subject changed confirmation
 */
socket.on('subject-changed', (data) => {
  console.log(`Subject changed to ${data.subject} (${data.questionCount} questions)`);
  gameStatus.textContent = `Room created! Subject: ${data.subject} (${data.questionCount} questions). Waiting for players...`;
});

/**
 * Handle disconnection
 */
socket.on('disconnect', () => {
  showError('Disconnected from server');
});

/**
 * Handle reconnection
 */
socket.on('connect', () => {
  console.log('Connected to server');
  if (errorDisplay.textContent === 'Disconnected from server') {
    errorDisplay.style.display = 'none';
  }
});
