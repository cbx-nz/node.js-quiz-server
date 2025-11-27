# 🎯 Multi-Player Quiz Game

A real-time, Kahoot-style quiz game built with Node.js, Express, and Socket.io. Perfect for educational settings with subject-specific question sets, time-based scoring, and full presenter mode.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🎮 Features

### Core Gameplay
- **Multiple Question Types:**
  - Multiple choice questions
  - True/False questions
  - Decision-based questions (no correct answer)
  - Flashcard-style questions (reveal answer after submission)
  - Open-ended text responses

- **Time-based Scoring**: First to answer correctly gets 1000 points, decreasing by 100 points per position (minimum 100 points)
- **Live Answer Tracking**: See how many players have answered in real-time
- **Answer Reveal Control**: Answers hidden until all players submit or host manually reveals

### Subject-Specific Content
- **4 Built-in Subjects**:
  - General Knowledge (15 questions)
  - Mathematics (15 questions)
  - Science (15 questions)
  - History (15 questions)
- **Custom Question Creator**: Built-in interface at `/creator.html` to create your own question sets

### Host Controls
- **Player Management**: View all connected players with live scores
- **Kick Players**: Remove players with inappropriate usernames or behavior (❌ button)
- **Manual Answer Reveal**: Control when answers are shown to players (👁️ button)
- **Broadcast Messages**: Send announcements to all players
- **Presenter View**: Full-screen display for projecting to audience (🖥️ button)
- **Game End Control**: Truly stop the game (prevents loading more questions)

### Player Experience
- **Kahoot-style Interface**: Familiar, engaging UI
- **Answer Confirmation**: Visual feedback when answer is submitted
- **Results Reveal**: Answers hidden until all players submit or host reveals
- **Score Tracking**: Real-time score updates with position-based bonuses
- **Mid-game Joining**: Players can join even after the game has started

### Safety Features
- **Username Filtering**: Automatic blocking of 50+ inappropriate words
- **Host Kick Controls**: Remove problematic players instantly
- **Clean Content**: Pre-moderated question sets

### Navigation & Convenience
- **Quick Navigation Modal**: Type `.?` on any page to see all available sections
- **Easy Subject Management**: Add new subjects by editing `question-files.json` (no server code changes needed!)
- **Comprehensive Documentation**: Built-in docs at `/docs.html`
  - Open-ended text responses

- **Real-Time Multiplayer:**
  - Multiple simultaneous game rooms with unique room codes
  - All players see questions at the same time
  - Individual answer tracking and scoring
  - Live player statistics and results

- **Host Controls:**
  - Create game rooms with shareable codes
  - Start/stop games
  - Navigate through questions
  - Broadcast messages to all players
  - View live player answers and scores

## 📁 Project Structure

```
eoy-activity/
├── public/
│   ├── index.html      # Player interface
│   ├── host.html       # Host dashboard
│   ├── client.js       # Player Socket.io client
│   └── host.js         # Host Socket.io client
├── questions/
│   └── questions.json  # Question database
├── server.js           # Express + Socket.io server
├── package.json        # Dependencies
└── README.md          # This file
```

## 🚀 Installation

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/
   - Verify installation: `node --version`

2. **Install Dependencies**
   ```bash
   npm install
   ```

## ▶️ Running the Game

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Access the interfaces:**
   - **Host Dashboard:** Open `http://localhost:3000/host.html`
   - **Player Interface:** Open `http://localhost:3000`

3. **Host Setup:**
   - Click "Create New Game Room"
   - Share the 6-character room code with players
   - Wait for players to join
   - Click "Start Game"
   - Use "Next Question" to progress through questions
   - Broadcast messages to players as needed

4. **Player Setup:**
   - Enter the room code provided by the host
   - Enter your name
   - Click "Join Game"
   - Wait for the host to start
   - Answer questions as they appear

## 🎯 How Multiplayer/Rooms Work

### Room System
- Each game session is a separate "room" identified by a 6-character code
- The host creates a room, and players join using the code
- Socket.io handles real-time communication within each room

### Player Tracking
- When a player joins, they're added to the room's player list
- Each player has their own socket connection
- Answers are tracked individually per player
- Scores are calculated and stored server-side

### Question Flow
1. Host clicks "Next Question"
2. Server loads question from `questions.json`
3. Question is broadcast to all players in the room
4. Players submit answers individually
5. Server validates answers and updates scores
6. Players see their results immediately
7. Host sees aggregated statistics
8. Process repeats for next question

### Socket.io Events

**Host Events:**
- `host-create-room`: Create a new game room
- `host-start-game`: Start the game for all players
- `host-next-question`: Load and broadcast next question
- `host-end-game`: End the game session
- `host-broadcast-message`: Send message to all players

**Player Events:**
- `player-join-room`: Join a room with code and name
- `player-submit-answer`: Submit an answer to current question

**Server Broadcasts:**
- `room-created`: Confirm room creation with code
- `game-started`: Notify all players game has started
- `new-question`: Send question data to all players
- `answer-result`: Send individual answer feedback
- `answer-stats`: Send aggregated statistics
- `player-list-updated`: Update connected players list
- `game-ended`: End game and show final scores

## 📝 Question Format

Questions are stored in `questions/questions.json` as an array. Each question object has:

```json
{
  "type": "multiple-choice",
  "question": "What is 2+2?",
  "options": ["3", "4", "5", "22"],
  "answer": 1,
  "explanation": "2 plus 2 equals 4"
}
```

**Question Types:**

- **`multiple-choice`**: Standard quiz with options array, answer is index (0-based)
- **`truefalse`**: Two options, answer is 0 or 1
- **`decision`**: Options array, no correct answer (tracks choices only)
- **`flashcard`**: Shows answer after submission, no options
- **`open`**: Text input, no validation (stores responses)

## 🛠️ Customization

### Adding New Subjects
1. Create your question JSON file (use `/creator.html` for easy creation)
2. Save it to the `questions/` folder
3. Add the subject to `question-files.json`:
```json
{
  "general": "general-knowledge.json",
  "your-new-subject": "your-questions.json",
  "english": "english-nz-year9-10.json"
}
```
4. Restart the server
5. Your subject will appear in the host's dropdown!

### Adding Questions to Existing Subjects
Edit the corresponding JSON file in `questions/` folder. Follow the format of existing questions.

### Changing Port
Set environment variable: `PORT=8080 npm start`

### Styling
- Edit CSS in `public/index.html` for player interface
- Edit CSS in `public/host.html` for host dashboard

## ⌨️ Navigation Tips

### Quick Navigation Modal
On any page in the application, type **`.?`** (period followed by question mark) to open a navigation modal that shows all available pages:
- Home / Player Join
- Host Dashboard
- Presenter View
- Question Creator
- Documentation

Press **Escape** to close the modal, or click any page to navigate instantly.

**Note:** The shortcut won't interfere when you're typing in input fields or text areas.

## 📦 Dependencies

- **express**: Web server framework
- **socket.io**: Real-time bidirectional communication

## 🐛 Troubleshooting

**Players can't connect:**
- Verify server is running (`npm start`)
- Check room code is correct (6 characters)
- Ensure players are on the same network (or use deployed server)

**Questions not loading:**
- Check `questions/questions.json` exists
- Verify JSON format is valid
- Check server console for errors

**Host controls not working:**
- Ensure you created a room first
- Check browser console for errors
- Verify Socket.io connection is established

## 🎓 Development Notes

This is a demonstration project showing:
- Socket.io room management
- Real-time multiplayer synchronization
- Event-driven architecture
- Clean separation of host and player interfaces
- Multiple question type handling

## 📄 License

MIT License - Feel free to use and modify for your needs!
