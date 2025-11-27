// Initialize Socket.io connection
const socket = io();

// Get room code from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');

// DOM Elements
const waitingScreen = document.getElementById('waitingScreen');
const questionScreen = document.getElementById('questionScreen');
const resultsScreen = document.getElementById('resultsScreen');

const presenterRoomCode = document.getElementById('presenterRoomCode');
const waitingPlayerCount = document.getElementById('waitingPlayerCount');
const waitingPlayersList = document.getElementById('waitingPlayersList');
const presenterSubjectBadge = document.getElementById('presenterSubjectBadge');
const questionSubjectBadge = document.getElementById('questionSubjectBadge');

const presenterQuestionNumber = document.getElementById('presenterQuestionNumber');
const presenterQuestionText = document.getElementById('presenterQuestionText');
const presenterOptionsGrid = document.getElementById('presenterOptionsGrid');
const presenterTextAnswer = document.getElementById('presenterTextAnswer');
const presenterResponseList = document.getElementById('presenterResponseList');

const presenterAnsweredCount = document.getElementById('presenterAnsweredCount');
const presenterTotalCount = document.getElementById('presenterTotalCount');
const presenterCurrentQ = document.getElementById('presenterCurrentQ');

const presenterLeaderboard = document.getElementById('presenterLeaderboard');

// State
let players = [];
let currentQuestionData = null;
let answerCounts = {};
let currentSubject = 'general';
let subjectName = 'General Knowledge';

/**
 * Format subject ID to display name
 */
function formatSubjectName(subjectId) {
  const names = {
    'general': 'General Knowledge',
    'english': 'English NZ Year 9-10',
    'mathematics': 'Mathematics',
    'science': 'Science',
    'history': 'History',
    'earth-science': 'Earth Science Year 9-10'
  };
  return names[subjectId] || subjectId.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

/**
 * Show a specific screen
 */
function showScreen(screen) {
  [waitingScreen, questionScreen, resultsScreen].forEach(s => {
    s.classList.remove('active');
  });
  screen.classList.add('active');
}

/**
 * Initialize presenter view
 */
if (!roomCode) {
  alert('No room code provided! Please open this from the host dashboard.');
} else {
  presenterRoomCode.textContent = roomCode;
  document.getElementById('questionRoomCode').textContent = roomCode;
  // Join as presenter (special role)
  socket.emit('presenter-join-room', { roomCode });
}

/**
 * Handle player list updates
 */
socket.on('player-list-updated', (data) => {
  players = data.players;
  waitingPlayerCount.textContent = players.length;
  presenterTotalCount.textContent = players.length;
  
  // Update waiting screen player list
  updateWaitingPlayersList();
});

/**
 * Handle subject information
 */
socket.on('subject-info', (data) => {
  currentSubject = data.subject;
  subjectName = formatSubjectName(data.subject);
  presenterSubjectBadge.textContent = `Subject: ${subjectName}`;
  questionSubjectBadge.textContent = subjectName;
});

/**
 * Update waiting screen player list display
 */
function updateWaitingPlayersList() {
  if (players.length === 0) {
    waitingPlayersList.innerHTML = '';
    return;
  }
  
  waitingPlayersList.innerHTML = '';
  players.forEach((player, index) => {
    const playerCard = document.createElement('div');
    playerCard.className = 'waiting-player-card';
    playerCard.style.animationDelay = `${index * 0.05}s`;
    playerCard.textContent = player.name;
    waitingPlayersList.appendChild(playerCard);
  });
}

/**
 * Handle game started
 */
socket.on('game-started', () => {
  showScreen(questionScreen);
});

/**
 * Handle new question
 */
socket.on('new-question', (data) => {
  currentQuestionData = data.question;
  answerCounts = {};
  
  // Update question info
  presenterQuestionNumber.textContent = `Question ${data.questionNumber} of ${data.totalQuestions}`;
  presenterQuestionText.textContent = data.question.question;
  presenterCurrentQ.textContent = data.questionNumber;
  presenterAnsweredCount.textContent = '0';
  
  // Hide all display types first
  presenterOptionsGrid.style.display = 'none';
  presenterTextAnswer.style.display = 'none';
  presenterResponseList.style.display = 'none';
  
  // Show appropriate display based on question type
  switch (data.question.type) {
    case 'multiple-choice':
    case 'decision':
    case 'truefalse':
      renderPresenterOptions(data.question);
      // Don't show correct answer yet - wait for reveal event
      break;
    case 'flashcard':
      presenterTextAnswer.style.display = 'block';
      presenterTextAnswer.innerHTML = `
        <div style="margin-bottom: 30px; opacity: 0.7;">Players are thinking...</div>
        <div style="font-size: 48px;">Waiting to reveal answer...</div>
      `;
      break;
    case 'open':
      presenterTextAnswer.style.display = 'block';
      presenterTextAnswer.textContent = 'Waiting for responses...';
      break;
  }
  
  showScreen(questionScreen);
});

/**
 * Render options for multiple choice questions
 */
function renderPresenterOptions(question) {
  presenterOptionsGrid.style.display = 'grid';
  presenterOptionsGrid.innerHTML = '';
  
  const colors = ['color-red', 'color-blue', 'color-yellow', 'color-green'];
  const labels = ['A', 'B', 'C', 'D'];
  
  question.options.forEach((option, index) => {
    const optionBox = document.createElement('div');
    optionBox.className = `option-box ${colors[index % 4]}`;
    optionBox.dataset.label = labels[index];
    optionBox.dataset.index = index;
    optionBox.innerHTML = `
      <span class="option-text">${option}</span>
      <span class="answer-count" id="count-${index}">0</span>
    `;
    presenterOptionsGrid.appendChild(optionBox);
    answerCounts[index] = 0;
  });
}

/**
 * Highlight correct answer immediately
 */
function highlightCorrectAnswer(correctIndex) {
  const optionBoxes = presenterOptionsGrid.querySelectorAll('.option-box');
  optionBoxes.forEach((box, index) => {
    if (index === correctIndex) {
      // Add a slight delay for dramatic effect
      setTimeout(() => {
        box.classList.add('correct');
      }, 300);
    }
  });
}

/**
 * Handle answer statistics (real-time updates)
 */
socket.on('answer-stats', (data) => {
  presenterAnsweredCount.textContent = data.answered;
  
  // Update answer counts for options
  if (currentQuestionData && 
      (currentQuestionData.type === 'multiple-choice' || 
       currentQuestionData.type === 'truefalse' ||
       currentQuestionData.type === 'decision')) {
    
    // Reset counts
    Object.keys(answerCounts).forEach(key => {
      answerCounts[key] = 0;
    });
    
    // Count answers
    data.answers.forEach(answerData => {
      if (typeof answerData.answer === 'number') {
        answerCounts[answerData.answer] = (answerCounts[answerData.answer] || 0) + 1;
      }
    });
    
    // Update display
    Object.keys(answerCounts).forEach(index => {
      const countElement = document.getElementById(`count-${index}`);
      if (countElement) {
        countElement.textContent = answerCounts[index];
      }
    });
    
    // Don't need to highlight again - already highlighted on question load
  }
  
  // For open-ended questions, show responses
  if (currentQuestionData && currentQuestionData.type === 'open') {
    displayOpenResponses(data.answers);
  }
});

/**
 * Handle reveal answer event from server
 */
socket.on('reveal-answer', (data) => {
  if (!currentQuestionData) return;
  
  const { correctAnswer, explanation } = data;
  
  // Reveal based on question type
  if (currentQuestionData.type === 'multiple-choice' || currentQuestionData.type === 'truefalse') {
    highlightCorrectAnswer(correctAnswer);
  } else if (currentQuestionData.type === 'flashcard') {
    presenterTextAnswer.innerHTML = `
      <div style="margin-bottom: 30px; opacity: 0.7;">Answer Revealed!</div>
      <div style="font-size: 64px; color: #ffd700;">Answer: ${correctAnswer}</div>
      ${explanation ? `<div style="margin-top: 30px; font-size: 28px; opacity: 0.9;">${explanation}</div>` : ''}
    `;
  }
});

/**
 * Display open-ended responses
 */
function displayOpenResponses(answers) {
  presenterResponseList.style.display = 'grid';
  presenterResponseList.innerHTML = '';
  
  answers.forEach(answerData => {
    if (answerData.answer && typeof answerData.answer === 'string') {
      const responseItem = document.createElement('div');
      responseItem.className = 'response-item';
      responseItem.innerHTML = `
        <div class="response-author">${answerData.playerName}</div>
        <div>${answerData.answer}</div>
      `;
      presenterResponseList.appendChild(responseItem);
    }
  });
}

/**
 * Handle game ended - show leaderboard
 */
socket.on('game-ended', (data) => {
  displayLeaderboard(data.finalScores || players);
  showScreen(resultsScreen);
});

/**
 * Display final leaderboard
 */
function displayLeaderboard(finalPlayers) {
  // Sort by score descending
  const sortedPlayers = [...finalPlayers].sort((a, b) => b.score - a.score);
  
  presenterLeaderboard.innerHTML = '';
  
  sortedPlayers.forEach((player, index) => {
    const rank = index + 1;
    const item = document.createElement('div');
    item.className = `leaderboard-item rank-${rank <= 3 ? rank : ''}`;
    item.style.animationDelay = `${index * 0.1}s`;
    
    let medal = '';
    if (rank === 1) medal = '🥇';
    else if (rank === 2) medal = '🥈';
    else if (rank === 3) medal = '🥉';
    
    item.innerHTML = `
      <div class="leaderboard-rank">${medal || rank}</div>
      <div class="leaderboard-name">${player.name}</div>
      <div class="leaderboard-score">${player.score} pts</div>
    `;
    
    presenterLeaderboard.appendChild(item);
  });
}

/**
 * Handle errors
 */
socket.on('error', (data) => {
  console.error('Error:', data.message);
  alert(data.message);
});

/**
 * Handle host disconnection
 */
socket.on('host-disconnected', () => {
  alert('Host has disconnected. Closing presenter view.');
  window.close();
});
