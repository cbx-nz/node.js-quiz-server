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
const presenterClapCount = document.getElementById('presenterClapCount');
const previousWinners = document.getElementById('previousWinners');
const winnersDisplay = document.getElementById('winnersDisplay');

// State
let players = [];
let currentQuestionData = null;
let answerCounts = {};
let currentSubject = 'general';
let subjectName = 'General Knowledge';
let roundWinners = []; // Store winners from each round
let leaderboardTimer = null;

/**
 * Periodic ban check - check every 5 seconds if presenter has been banned mid-game
 */
function checkBanStatusPeriodically() {
  // Get UUID from localStorage
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
    playerCard.innerHTML = `
      <span>${player.name}</span>
      <span style="color: #667eea; font-weight: 600; margin-left: 10px;">${player.score || 0} pts</span>
    `;
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
    case 'multi-choice':
      renderPresenterOptions(data.question);
      // Multi-choice: wait for reveal to show multiple correct answers
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
       currentQuestionData.type === 'decision' ||
       currentQuestionData.type === 'multi-choice')) {
    
    // Reset counts
    Object.keys(answerCounts).forEach(key => {
      answerCounts[key] = 0;
    });
    
    // Count answers
    data.answers.forEach(answerData => {
      if (currentQuestionData.type === 'multi-choice' && Array.isArray(answerData.answer)) {
        // For multi-choice, increment count for each selected option
        answerData.answer.forEach(index => {
          answerCounts[index] = (answerCounts[index] || 0) + 1;
        });
      } else if (typeof answerData.answer === 'number') {
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
  } else if (currentQuestionData.type === 'multi-choice') {
    // For multi-choice, correctAnswer is an array of indices
    if (Array.isArray(correctAnswer)) {
      correctAnswer.forEach(index => {
        highlightCorrectAnswer(index);
      });
    }
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
  const finalPlayers = data.finalScores || players;
  displayLeaderboard(finalPlayers);
  showScreen(resultsScreen);
  
  // Reset clap count
  presenterClapCount.textContent = '0';
  
  // Store top 3 winners
  const sortedPlayers = [...finalPlayers].sort((a, b) => b.score - a.score);
  const topThree = sortedPlayers.slice(0, 3);
  roundWinners.push(topThree);
  
  // Clear any existing timer
  if (leaderboardTimer) {
    clearTimeout(leaderboardTimer);
  }
  
  // After 10 seconds, go back to waiting screen
  leaderboardTimer = setTimeout(() => {
    showScreen(waitingScreen);
    displayPreviousWinners();
  }, 10000);
});

/**
 * Handle clap count update
 */
socket.on('clap-update', (data) => {
  presenterClapCount.textContent = data.totalClaps;
});

/**
 * Display previous round winners on waiting screen
 */
function displayPreviousWinners() {
  if (roundWinners.length === 0) {
    previousWinners.style.display = 'none';
    return;
  }
  
  previousWinners.style.display = 'block';
  winnersDisplay.innerHTML = '';
  
  roundWinners.forEach((winners, roundIndex) => {
    const roundDiv = document.createElement('div');
    roundDiv.style.cssText = 'background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; backdrop-filter: blur(10px);';
    
    let html = `<div style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Round ${roundIndex + 1}</div>`;
    
    winners.forEach((player, index) => {
      const medals = ['🥇', '🥈', '🥉'];
      html += `<div style="margin: 5px 0;">${medals[index]} ${player.name}: ${player.score} pts</div>`;
    });
    
    roundDiv.innerHTML = html;
    winnersDisplay.appendChild(roundDiv);
  });
}

/**
 * Handle room closed by host
 */
socket.on('room-closed', (data) => {
  alert(data.message);
  window.close(); // Try to close presenter window, or reload
  setTimeout(() => location.reload(), 1000);
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
 * Handle broadcast message from host
 */
socket.on('presenter-message', (data) => {
  showBroadcastBanner(data.message);
});

/**
 * Show broadcast banner with animation
 */
function showBroadcastBanner(message) {
  // Remove any existing banner
  const existingBanner = document.querySelector('.broadcast-banner');
  if (existingBanner) {
    existingBanner.remove();
  }

  // Create new banner
  const banner = document.createElement('div');
  banner.className = 'broadcast-banner';
  banner.textContent = message;
  document.body.appendChild(banner);

  // Trigger animation
  setTimeout(() => {
    banner.classList.add('show');
  }, 10);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    banner.classList.remove('show');
    setTimeout(() => {
      banner.remove();
    }, 300);
  }, 5000);
}

/**
 * Handle host disconnection
 */
socket.on('host-disconnected', () => {
  alert('Host has disconnected. Closing presenter view.');
  window.close();
});
