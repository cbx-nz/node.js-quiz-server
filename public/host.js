// Check if UUID is banned before allowing access
function checkUUIDBan() {
  const bannedUUIDs = JSON.parse(localStorage.getItem('cbx_banned_uuids') || '[]');
  const userUUID = localStorage.getItem('cbx_user_uuid') || '';
  
  if (bannedUUIDs.includes(userUUID)) {
    // Redirect to game ban page
    window.location.href = '/game-banned.html';
    return true;
  }
  return false;
}

// Check on page load
if (checkUUIDBan()) {
  // Stop script execution if banned
  throw new Error('User is banned');
}

// Initialize Socket.io connection
const socket = io();

// DOM Elements
const createScreen = document.getElementById('createScreen');
const controlScreen = document.getElementById('controlScreen');
const createRoomButton = document.getElementById('createRoomButton');
const subjectSelect = document.getElementById('subjectSelect');
const subjectInfo = document.getElementById('subjectInfo');
const uploadJsonButton = document.getElementById('uploadJsonButton');
const customJsonUpload = document.getElementById('customJsonUpload');
const uploadStatus = document.getElementById('uploadStatus');

const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const gameStatus = document.getElementById('gameStatus');

const startButton = document.getElementById('startButton');
const nextButton = document.getElementById('nextButton');
const endButton = document.getElementById('endButton');
const endRoomButton = document.getElementById('endRoomButton');
const broadcastButton = document.getElementById('broadcastButton');
const broadcastPresenterButton = document.getElementById('broadcastPresenterButton');
const broadcastSelectedButton = document.getElementById('broadcastSelectedButton');
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

// Change Questions Elements
const changeQuestionsSection = document.getElementById('changeQuestionsSection');
const newSubjectSelect = document.getElementById('newSubjectSelect');
const newUploadJsonButton = document.getElementById('newUploadJsonButton');
const newCustomJsonUpload = document.getElementById('newCustomJsonUpload');
const newUploadStatus = document.getElementById('newUploadStatus');

// State
let roomCode = '';
let players = [];
let gameStarted = false;
let questionIndex = 0;
let currentAnswers = [];
let selectedSubject = 'general';
let customQuestions = null;

/**
 * Periodic ban check - check every 5 seconds if host has been banned mid-game
 */
function checkBanStatusPeriodically() {
  // Get UUID from localStorage (host pages may not have UUID generation, but check anyway)
  const userUUID = localStorage.getItem('cbx_user_uuid') || '';
  
  fetch(`/api/check-ban?uuid=${encodeURIComponent(userUUID)}`)
    .then(response => response.json())
    .then(data => {
      if (data.banned) {
        // Store ban info in localStorage
        if (data.type === 'uuid') {
          const bannedUUIDs = JSON.parse(localStorage.getItem('cbx_banned_uuids') || '[]');
          if (!bannedUUIDs.includes(data.uuid)) {
            bannedUUIDs.push(data.uuid);
            localStorage.setItem('cbx_banned_uuids', JSON.stringify(bannedUUIDs));
          }
          localStorage.setItem('cbx_uuid_ban_info', JSON.stringify({
            reason: data.reason,
            timestamp: data.timestamp
          }));
        } else if (data.type === 'ip') {
          localStorage.setItem('cbx_quiz_ban_info', JSON.stringify({
            banned: true,
            reason: data.reason,
            timestamp: data.timestamp,
            unbanDate: data.unbanDate
          }));
        }
        
        // Redirect to appropriate ban page
        if (data.type === 'uuid') {
          window.location.href = '/game-banned.html';
        } else {
          window.location.href = '/ip-banned.html';
        }
      }
    })
    .catch(error => {
      console.error('Ban check failed:', error);
    });
}

// Check every 5 seconds
setInterval(checkBanStatusPeriodically, 5000);

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

/**
 * Load subjects into the new question selector
 */
async function loadNewSubjects() {
  try {
    const response = await fetch('/api/subjects');
    const subjects = await response.json();
    
    newSubjectSelect.innerHTML = '';
    subjects.forEach(subject => {
      const option = document.createElement('option');
      option.value = subject.id;
      option.textContent = `${subject.name} (${subject.questionCount} questions)`;
      if (subject.id === selectedSubject) {
        option.selected = true;
      }
      newSubjectSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading subjects:', error);
    newSubjectSelect.innerHTML = '<option value="general">General Knowledge</option>';
  }
}

/**
 * Handle new subject selection for next game
 */
newSubjectSelect.addEventListener('change', () => {
  selectedSubject = newSubjectSelect.value;
  customQuestions = null; // Clear custom questions
  newUploadStatus.textContent = '';
  socket.emit('host-set-subject', { roomCode, subject: selectedSubject });
  gameStatus.textContent = `Questions changed to ${newSubjectSelect.options[newSubjectSelect.selectedIndex].textContent}. Start when ready!`;
});

/**
 * Handle new custom JSON upload for next game
 */
newUploadJsonButton.addEventListener('click', () => {
  newCustomJsonUpload.click();
});

newCustomJsonUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const questions = JSON.parse(text);

    // Validate with server
    const response = await fetch('/api/validate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions })
    });

    const result = await response.json();
    
    if (result.valid) {
      customQuestions = result.questions;
      selectedSubject = 'custom';
      socket.emit('host-set-custom-questions', { roomCode, questions: customQuestions });
      newUploadStatus.textContent = `✅ Loaded ${customQuestions.length} questions successfully!`;
      newUploadStatus.style.color = 'green';
      gameStatus.textContent = `Custom questions loaded (${customQuestions.length} questions). Start when ready!`;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    newUploadStatus.textContent = `❌ Error: ${error.message}`;
    newUploadStatus.style.color = 'red';
  }
  
  newCustomJsonUpload.value = '';
});

// Update subject info when selection changes
subjectSelect.addEventListener('change', () => {
  selectedSubject = subjectSelect.value;
  updateSubjectInfo();
  // Clear custom questions if switching back to subject selection
  if (customQuestions) {
    customQuestions = null;
    uploadStatus.textContent = '';
    uploadStatus.className = 'upload-status';
  }
});

/**
 * Handle custom JSON file upload
 */
uploadJsonButton.addEventListener('click', () => {
  customJsonUpload.click();
});

customJsonUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  uploadStatus.textContent = '⏳ Validating...';
  uploadStatus.className = 'upload-status info';

  try {
    // Read file
    const text = await file.text();
    let questions;
    
    try {
      questions = JSON.parse(text);
    } catch (parseError) {
      throw new Error('Invalid JSON format. Please check your file.');
    }

    // Send to server for validation
    const response = await fetch('/api/validate-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(questions)
    });

    const result = await response.json();

    if (!result.valid) {
      throw new Error(result.error || 'Validation failed');
    }

    // Store validated questions
    customQuestions = result.questions;
    uploadStatus.textContent = `✅ ${result.questionCount} questions loaded from ${file.name}`;
    uploadStatus.className = 'upload-status success';

    // Show warnings if any
    if (result.warnings && result.warnings.length > 0) {
      console.warn('Validation warnings:', result.warnings);
    }

    // Disable subject selection when custom questions are loaded
    subjectSelect.disabled = true;

  } catch (error) {
    uploadStatus.textContent = `❌ ${error.message}`;
    uploadStatus.className = 'upload-status error';
    customQuestions = null;
    subjectSelect.disabled = false;
  }

  // Clear file input
  e.target.value = '';
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
      <div class="player-card-content">
        <input type="checkbox" class="player-checkbox" data-socket-id="${player.socketId}">
        <div class="player-info">
          <span class="player-name">${player.name}</span>
          <div style="display: flex; gap: 10px; align-items: center;">
            <span class="player-score">${player.score} pts</span>
            <button class="btn-kick" data-socket-id="${player.socketId}" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px;">❌ Kick</button>
            <button class="btn-request-ban" data-socket-id="${player.socketId}" data-player-name="${player.name}" style="background: #ff6b6b; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px;">🚫 Request Ban</button>
          </div>
        </div>
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
  
  // Add event listeners to request ban buttons
  document.querySelectorAll('.btn-request-ban').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const socketId = e.target.dataset.socketId;
      const playerName = e.target.dataset.playerName;
      const reason = prompt(`Why do you want to ban ${playerName}?\n\nProvide a detailed reason:`);
      
      if (reason && reason.trim().length > 0) {
        socket.emit('host-request-ban', { roomCode, socketId, playerName, reason: reason.trim() });
        alert(`Ban request submitted for ${playerName}`);
      }
    });
  });

  // Add event listeners to checkboxes to enable/disable "Send to Selected" button
  document.querySelectorAll('.player-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const checkedBoxes = document.querySelectorAll('.player-checkbox:checked');
      broadcastSelectedButton.disabled = checkedBoxes.length === 0;
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
  
  // If custom questions are loaded, send them to the server
  if (customQuestions) {
    socket.emit('host-set-custom-questions', { roomCode, questions: customQuestions });
  } else {
    // Otherwise, set the subject for this room
    socket.emit('host-set-subject', { roomCode, subject: selectedSubject });
  }
  
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
  changeQuestionsSection.style.display = 'none'; // Hide change questions when game starts
  endRoomButton.style.display = 'none'; // Hide end room button when game starts
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
  if (confirm('End the current game? Players will remain in the room and you can start a new game.')) {
    socket.emit('host-end-game', { roomCode });
    gameStatus.textContent = 'Game ended! You can change questions and start a new game.';
    startButton.disabled = false;
    nextButton.disabled = true;
    endButton.disabled = true;
    revealButton.disabled = true;
    endRoomButton.style.display = 'inline-block'; // Show End Room button
    changeQuestionsSection.style.display = 'block'; // Show change questions section
    loadNewSubjects(); // Load subjects into the new selector
    gameStarted = false;
    questionIndex = 0;
    currentQuestion.textContent = '0';
    currentQuestionSection.style.display = 'none';
  }
});

/**
 * Handle End Room button click
 */
endRoomButton.addEventListener('click', () => {
  if (confirm('Are you sure you want to END THE ROOM? This will disconnect all players and close the room permanently.')) {
    socket.emit('host-end-room', { roomCode });
    // Redirect back to create screen
    createScreen.classList.add('active');
    controlScreen.classList.remove('active');
    gameStatus.textContent = 'Waiting for players...';
    startButton.disabled = true;
    nextButton.disabled = true;
    endButton.disabled = true;
    revealButton.disabled = true;
    endRoomButton.style.display = 'none';
    gameStarted = false;
    questionIndex = 0;
    players = [];
    updatePlayersList();
  }
});

/**
 * Broadcast message to all players
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
  gameStatus.textContent = `Broadcast sent to all players: "${message}"`;
  setTimeout(() => {
    if (gameStarted) {
      gameStatus.textContent = `Question ${questionIndex} active - waiting for answers...`;
    } else {
      gameStatus.textContent = 'Waiting to start game...';
    }
  }, 3000);
});

/**
 * Broadcast message to presenter
 */
broadcastPresenterButton.addEventListener('click', () => {
  const message = broadcastInput.value.trim();
  if (!message) {
    showError('Please enter a message');
    return;
  }

  socket.emit('host-broadcast-presenter', { roomCode, message });
  broadcastInput.value = '';
  
  // Show confirmation
  gameStatus.textContent = `Broadcast sent to presenter: "${message}"`;
  setTimeout(() => {
    if (gameStarted) {
      gameStatus.textContent = `Question ${questionIndex} active - waiting for answers...`;
    } else {
      gameStatus.textContent = 'Waiting to start game...';
    }
  }, 3000);
});

/**
 * Broadcast message to selected players
 */
broadcastSelectedButton.addEventListener('click', () => {
  const message = broadcastInput.value.trim();
  if (!message) {
    showError('Please enter a message');
    return;
  }

  // Get all checked player socket IDs
  const checkedBoxes = document.querySelectorAll('.player-checkbox:checked');
  const playerIds = Array.from(checkedBoxes).map(cb => cb.dataset.socketId);

  if (playerIds.length === 0) {
    showError('Please select at least one player');
    return;
  }

  socket.emit('host-broadcast-targeted', { roomCode, message, playerIds });
  broadcastInput.value = '';
  
  // Uncheck all boxes
  checkedBoxes.forEach(cb => cb.checked = false);
  broadcastSelectedButton.disabled = true;
  
  // Show confirmation
  gameStatus.textContent = `Broadcast sent to ${playerIds.length} selected player(s): "${message}"`;
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
 * Play sound effect
 */
function playSound(soundFile) {
  try {
    const audio = new Audio(`/sounds/${soundFile}`);
    audio.volume = 0.5;
    audio.play().catch(err => console.log('Sound play failed:', err));
  } catch (error) {
    console.log('Sound error:', error);
  }
}

/**
 * Handle answer statistics
 */
socket.on('answer-stats', (data) => {
  const previousAnswered = answeredCount.textContent;
  answeredCount.textContent = data.answered;
  currentAnswers = data.answers;
  updateAnswersDisplay();
  
  if (data.answered === players.length && players.length > 0) {
    gameStatus.textContent = `All players answered! Click "Next Question" to continue.`;
    // Play sound only when transitioning from not-all to all answered
    if (previousAnswered !== data.answered.toString()) {
      playSound('all-answered.mp3');
    }
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
