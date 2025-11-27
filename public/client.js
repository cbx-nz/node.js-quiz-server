// Initialize Socket.io connection
const socket = io();

// DOM Elements
const joinScreen = document.getElementById('joinScreen');
const waitingScreen = document.getElementById('waitingScreen');
const questionScreen = document.getElementById('questionScreen');
const endScreen = document.getElementById('endScreen');

const roomCodeInput = document.getElementById('roomCode');
const playerNameInput = document.getElementById('playerName');
const joinButton = document.getElementById('joinButton');
const joinError = document.getElementById('joinError');

const currentRoom = document.getElementById('currentRoom');
const currentPlayer = document.getElementById('currentPlayer');
const roomDisplay = document.getElementById('roomDisplay');
const playerDisplay = document.getElementById('playerDisplay');
const scoreDisplay = document.getElementById('scoreDisplay');

const questionNumber = document.getElementById('questionNumber');
const questionType = document.getElementById('questionType');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const textInputContainer = document.getElementById('textInputContainer');
const textAnswer = document.getElementById('textAnswer');
const flashcardAnswer = document.getElementById('flashcardAnswer');

const submitButton = document.getElementById('submitButton');
const nextButton = document.getElementById('nextButton');
const resultDisplay = document.getElementById('resultDisplay');
const statsDisplay = document.getElementById('statsDisplay');
const broadcastBanner = document.getElementById('broadcastBanner');

const endMessage = document.getElementById('endMessage');
const finalScore = document.getElementById('finalScore');

// State
let playerName = '';
let roomCode = '';
let currentScore = 0;
let selectedAnswer = null;
let currentQuestionData = null;

/**
 * Show a specific screen and hide others
 */
function showScreen(screen) {
  [joinScreen, waitingScreen, questionScreen, endScreen].forEach(s => {
    s.classList.remove('active');
  });
  screen.classList.add('active');
}

/**
 * Display error message
 */
function showError(message) {
  joinError.textContent = message;
  joinError.style.display = 'block';
  setTimeout(() => {
    joinError.style.display = 'none';
  }, 5000);
}

/**
 * Join a game room
 */
joinButton.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  const name = playerNameInput.value.trim();

  if (!code || code.length !== 6) {
    showError('Please enter a valid 6-character room code');
    return;
  }

  if (!name) {
    showError('Please enter your name');
    return;
  }
  
  if (name.length < 2 || name.length > 20) {
    showError('Name must be between 2 and 20 characters');
    return;
  }

  playerName = name;
  roomCode = code;

  // Emit join room event
  socket.emit('player-join-room', { roomCode: code, playerName: name });
});

/**
 * Handle successful room join
 */
socket.on('room-joined', (data) => {
  currentRoom.textContent = data.roomCode;
  currentPlayer.textContent = data.playerName;
  roomDisplay.textContent = data.roomCode;
  playerDisplay.textContent = data.playerName;
  
  showScreen(waitingScreen);
});

/**
 * Handle game started
 */
socket.on('game-started', () => {
  showScreen(questionScreen);
  // Clear any previous question state
  resultDisplay.style.display = 'none';
  statsDisplay.style.display = 'none';
  nextButton.style.display = 'none';
});

/**
 * Handle new question
 */
socket.on('new-question', (data) => {
  currentQuestionData = data.question;
  selectedAnswer = null;

  // Reset UI
  resultDisplay.style.display = 'none';
  statsDisplay.style.display = 'none';
  submitButton.style.display = 'block';
  submitButton.disabled = false;
  nextButton.style.display = 'none';
  optionsContainer.style.display = 'none';
  textInputContainer.style.display = 'none';
  flashcardAnswer.style.display = 'none';
  textAnswer.value = '';

  // Update question header
  questionNumber.textContent = `Question ${data.questionNumber} of ${data.totalQuestions}`;
  questionType.textContent = data.question.type.toUpperCase();
  questionText.textContent = data.question.question;

  // Render question based on type
  switch (data.question.type) {
    case 'multiple-choice':
    case 'decision':
    case 'truefalse':
      renderOptions(data.question.options);
      break;
    case 'flashcard':
      renderFlashcard();
      break;
    case 'open':
      renderOpenQuestion();
      break;
  }

  showScreen(questionScreen);
});

/**
 * Render multiple choice / decision / true-false options
 */
function renderOptions(options) {
  optionsContainer.style.display = 'block';
  optionsContainer.innerHTML = '';

  options.forEach((option, index) => {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'option';
    optionDiv.textContent = option;
    optionDiv.dataset.index = index;

    optionDiv.addEventListener('click', () => {
      // Remove selected class from all options
      document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
      });
      // Add selected class to clicked option
      optionDiv.classList.add('selected');
      selectedAnswer = index;
    });

    optionsContainer.appendChild(optionDiv);
  });
}

/**
 * Render flashcard question
 */
function renderFlashcard() {
  flashcardAnswer.style.display = 'block';
  flashcardAnswer.innerHTML = `
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
      <p style="color: #666; margin-bottom: 10px;">Think about the answer, then click submit to reveal it!</p>
    </div>
  `;
  selectedAnswer = 'viewed'; // Flashcards just need to be "viewed"
}

/**
 * Render open-ended question
 */
function renderOpenQuestion() {
  textInputContainer.style.display = 'block';
}

/**
 * Submit answer
 */
submitButton.addEventListener('click', () => {
  let answer = null;

  // Get answer based on question type
  switch (currentQuestionData.type) {
    case 'multiple-choice':
    case 'decision':
    case 'truefalse':
      if (selectedAnswer === null) {
        alert('Please select an option');
        return;
      }
      answer = selectedAnswer;
      break;
    case 'flashcard':
      answer = 'viewed';
      break;
    case 'open':
      answer = textAnswer.value.trim();
      if (!answer) {
        alert('Please enter an answer');
        return;
      }
      break;
  }

  // Emit answer to server
  socket.emit('player-submit-answer', { roomCode, answer });

  // Disable submit button and show waiting state
  submitButton.disabled = true;
  submitButton.style.display = 'none';
  
  // Disable option selection
  document.querySelectorAll('.option').forEach(opt => {
    opt.style.pointerEvents = 'none';
  });
  
  // Show waiting message (Kahoot-style)
  resultDisplay.style.display = 'block';
  resultDisplay.className = 'waiting-results';
  resultDisplay.innerHTML = '<div class="spinner"></div><div>Waiting for results...</div>';
});

/**
 * Handle answer result from server
 */
socket.on('answer-result', (data) => {
  // Results are shown immediately when revealed (no delay)
  submitButton.style.display = 'none';
  resultDisplay.style.display = 'block';

  if (data.correct === true) {
    resultDisplay.className = 'result correct';
    resultDisplay.innerHTML = `✅ Correct! +${data.score} points`;
    currentScore += data.score;
    scoreDisplay.textContent = currentScore;

    // Highlight correct answer
    if (currentQuestionData.type === 'multiple-choice' || currentQuestionData.type === 'truefalse') {
      const options = document.querySelectorAll('.option');
      options[data.correctAnswer].classList.add('correct');
    }
  } else if (data.correct === false) {
    resultDisplay.className = 'result incorrect';
    resultDisplay.innerHTML = '❌ Incorrect';

    // Highlight correct and incorrect answers
    if (currentQuestionData.type === 'multiple-choice' || currentQuestionData.type === 'truefalse') {
      const options = document.querySelectorAll('.option');
      options[selectedAnswer].classList.add('incorrect');
      options[data.correctAnswer].classList.add('correct');
    }
  } else {
    // For decision, flashcard, and open questions
    resultDisplay.className = 'result neutral';
    if (currentQuestionData.type === 'flashcard') {
      resultDisplay.innerHTML = `💡 Answer: ${data.correctAnswer}`;
    } else {
      resultDisplay.innerHTML = '✓ Answer Submitted';
    }
  }  // Show explanation if available
  if (data.explanation) {
    resultDisplay.innerHTML += `<div class="explanation" style="margin-top: 15px; text-align: left;">${data.explanation}</div>`;
  }

  // Show ready button
  nextButton.style.display = 'block';
});

/**
 * Handle answer submitted acknowledgment
 */
socket.on('answer-submitted', (data) => {
  // Just show that answer was received, don't reveal correctness yet
  resultDisplay.style.display = 'block';
  resultDisplay.className = 'waiting-results';
  resultDisplay.innerHTML = '<div class="spinner"></div><div>' + data.message + '</div>';
});

/**
 * Handle answer reveal for all players
 */
socket.on('reveal-answer-players', (data) => {
  // This event is sent when host reveals or all players answer
  // The individual answer-result will be sent separately
});

/**
 * Handle answer statistics
 */
socket.on('answer-stats', (data) => {
  statsDisplay.style.display = 'block';
  statsDisplay.innerHTML = `
    <div class="stats-item">
      <span>Players Answered:</span>
      <strong>${data.answered} / ${data.total}</strong>
    </div>
  `;
});

/**
 * Ready for next question
 */
nextButton.addEventListener('click', () => {
  nextButton.textContent = 'Waiting for host...';
  nextButton.disabled = true;
});

/**
 * Handle host broadcast messages
 */
socket.on('host-message', (data) => {
  showBroadcastBanner(data.message);
});

/**
 * Show broadcast banner popup
 */
function showBroadcastBanner(message) {
  broadcastBanner.textContent = message;
  broadcastBanner.classList.add('show');
  
  // Hide after 5 seconds
  setTimeout(() => {
    broadcastBanner.classList.remove('show');
  }, 5000);
}

/**
 * Handle game ended
 */
socket.on('game-ended', (data) => {
  endMessage.textContent = data.message;
  finalScore.textContent = currentScore;
  showScreen(endScreen);
});

/**
 * Handle host disconnection
 */
socket.on('host-disconnected', () => {
  alert('Host has disconnected. The game has ended.');
  location.reload();
});

/**
 * Handle errors
 */
socket.on('error', (data) => {
  showError(data.message);
});

/**
 * Handle being kicked by host
 */
socket.on('kicked', (data) => {
  alert(data.message);
  location.reload();
});

/**
 * Handle player list updates (optional - for showing connected players)
 */
socket.on('player-list-updated', (data) => {
  console.log('Players updated:', data.players);
});

// Enable Enter key to join
roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    playerNameInput.focus();
  }
});

playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinButton.click();
  }
});
