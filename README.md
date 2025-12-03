# 🎯 Multi-Player Quiz Game

A real-time, Kahoot-style quiz game built with Node.js, Express, and Socket.io. Perfect for educational settings with subject-specific question sets, time-based scoring, and full presenter mode.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🎮 Features

### Core Gameplay
- **Multiple Question Types:**
  - Multiple choice questions (select one answer)
  - Multi-choice questions (select multiple correct answers)
  - True/False questions
  - Decision-based questions (no correct answer)
  - Flashcard-style questions (reveal answer after submission)
  - Open-ended text responses

- **Time-based Scoring**: First to answer correctly gets 1000 points, decreasing by 100 points per position (minimum 100 points)
- **Live Answer Tracking**: See how many players have answered in real-time
- **Answer Reveal Control**: Answers hidden until all players submit or host manually reveals
- **Sound Effects**: 
  - Notification sound when players receive broadcast messages
  - Completion sound when all players have answered

### Subject-Specific Content
- **8 Built-in Subjects**:
  - General Knowledge (15 questions)
  - English NZ Year 9-10 (31 questions)
  - Mathematics (15 questions)
  - Science (15 questions)
  - History (15 questions)
  - Earth Science Year 9-10 (46 questions)
  - Formal Essay Writing - NCEA Level 1 (20 questions)
  - Developer Test Questions (15 questions)
- **Custom Question Creator**: Built-in interface at `/creator.html` to create your own question sets

### Host Controls
- **Player Management**: View all connected players with live scores
- **Kick Players**: Remove players with inappropriate usernames or behavior (❌ button)
- **Ban Requests**: Request permanent UUID bans for problematic players (🚫 button, requires admin approval)
- **Manual Answer Reveal**: Control when answers are shown to players (👁️ button)
- **Targeted Broadcast Messages**: Send announcements to different audiences:
  - Send to all players at once
  - Send to presenter view only (for notes/instructions)
  - Send to specific selected players (select via checkboxes)
- **Presenter View**: Full-screen display for projecting to audience (🖥️ button, supports 16+ players with scrollable list)
- **Game End Control**: Truly stop the game (prevents loading more questions)
- **Auto-disconnect**: Players are automatically removed when they close their tab
- **Sound Notifications**: Hear audio alert when all players have answered

### Player Experience
- **Kahoot-style Interface**: Familiar, engaging UI
- **Answer Confirmation**: Visual feedback when answer is submitted
- **Results Reveal**: Answers hidden until all players submit or host reveals
- **Score Tracking**: Real-time score updates with position-based bonuses
- **Mid-game Joining**: Players can join even after the game has started
- **Multiple Answer Types**: Click options, type text, or select multiple correct answers
- **Broadcast Notifications**: Receive messages from host with sound alerts
- **UUID Tracking**: Persistent user identification across sessions

### Safety Features
- **Username Filtering**: Automatic blocking of 50+ inappropriate words
- **Host Kick Controls**: Remove problematic players instantly
- **Host Ban Requests**: Request UUID or IP bans for problematic players (requires admin approval)
- **Clean Content**: Pre-moderated question sets
- **IP Ban System**: Server admin can ban IP addresses (permanent or temporary) with dedicated ban page
- **UUID Ban System**: Account-specific bans that persist across sessions with separate ban page
- **Separate Ban Pages**: UUID bans redirect to game-banned.html, IP bans to ip-banned.html
- **Auto-Expiring Bans**: Temporary UUID and IP bans automatically removed after expiration
- **Ban Access Control**: Banned accounts blocked from all game pages (host, presenter, creator, docs)
- **Ban Isolation**: Banned users can only access ToS and Privacy Policy pages
- **Real-Time Ban Enforcement**: Instant broadcast when admin approves bans - immediate disconnection
- **Ban Request Options**: Admins can choose to ban by UUID, IP, or both when approving requests
- **Ban Request Archive**: All ban decisions stored in requests-backup.json for audit trail

### Security Features
- **XSS Protection**: All user inputs are sanitized with HTML entity encoding
- **File Upload Validation**: Custom JSON uploads validated and size-limited (5MB max, 500 questions)
- **DoS Prevention**: Request size limits and question count restrictions
- **Content Filtering**: 50+ inappropriate words blocked from usernames
- **Admin Access Control**: Separate admin panel on protected port (3001)

### Navigation & Convenience
- **Quick Navigation Modal**: Type `./` on any page to see all available sections
- **Easy Subject Management**: Add new subjects by editing `question-files.json` (no server code changes needed!)
- **Comprehensive Documentation**: Built-in docs at `/docs.html`
- **Custom Question Upload**: Upload your own JSON question files directly from host dashboard
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
  - Targeted broadcast messages (all players, presenter only, or selected players)
  - Player auto-removal on disconnect
  - View live player answers and scores

## 📁 Project Structure

```
eoy-activity/
├── public/
│   ├── index.html       # Player interface
│   ├── host.html        # Host dashboard
│   ├── presenter.html   # Presenter view
│   ├── creator.html     # Question creator
│   ├── docs.html        # Documentation
│   ├── admin.html       # Admin panel (port 3001)
│   ├── ip-banned.html   # Ban page (restricted access)
│   ├── privacy.html     # Privacy policy
│   ├── tos.html         # Terms of service
│   ├── client.js        # Player Socket.io client
│   ├── host.js          # Host Socket.io client
│   ├── presenter.js     # Presenter Socket.io client
│   ├── ban-check.js     # Ban detection & redirect system
│   └── navigation-modal.js  # Quick navigation
├── questions/
│   ├── general-knowledge.json
│   ├── [other subject files...]
│   └── question-files.json  # Subject mappings
├── server.js            # Main Express + Socket.io server
├── admin-server.js      # Admin panel server (port 3001)
├── banned-ips.json      # Banned IP list (auto-created)
├── inappropriate-words.json  # Content filter
├── package.json         # Dependencies
├── .env                 # Environment variables
├── .gitignore          # Git exclusions
├── README.md           # This file
└── BEGINNER_GUIDE.md   # Beginner setup guide
```

## 🚀 Installation

### For Beginners
If you're new to Node.js or VS Code, check out our **[Beginner's Guide](BEGINNER_GUIDE.md)** for step-by-step instructions with screenshots!

### For Experienced Users

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
   - **Admin Panel:** Open `http://localhost:3001` (⚠️ Protect with firewall!)

3. **Host Setup:**
   - Select a subject OR upload your own JSON question file
   - Click "Create New Game Room"
   - Share the 6-character room code with players
   - Wait for players to join
   - Click "Start Game" (first question loads immediately!)
   - Use "Next Question" to progress through questions
   - Broadcast messages to players, presenter, or selected individuals as needed
   - Use checkboxes to select specific players for targeted messages

4. **Player Setup:**
   - Enter the room code provided by the host
   - Enter your name
   - Click "Join Game"
   - Wait for the host to start
   - Answer questions as they appear

5. **Admin Setup (Optional):**
   - Access admin panel at `http://localhost:3001`
   - Add IP bans for prohibited conduct
   - View active rooms and connected users
   - Export/import ban lists
   - **Security Note:** This port should be protected by firewall rules!

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
- `host-set-subject`: Set subject for the room
- `host-set-custom-questions`: Upload custom question set
- `host-start-game`: Start the game for all players
- `host-next-question`: Load and broadcast next question
- `host-end-game`: End the game session
- `host-broadcast-message`: Send message to all players
- `host-broadcast-targeted`: Send message to specific players (array of socket IDs)
- `host-broadcast-presenter`: Send message to presenter view only
- `host-kick-player`: Remove a player from the game
- `host-reveal-answer`: Manually reveal answer to all players

**Player Events:**
- `player-join-room`: Join a room with code and name
- `player-disconnect`: Notify server when player closes tab
- `player-submit-answer`: Submit an answer to current question

**Server Broadcasts:**
- `room-created`: Confirm room creation with code
- `subject-changed`: Confirm subject or custom questions loaded
- `game-started`: Notify all players game has started
- `new-question`: Send question data to all players
- `answer-result`: Send individual answer feedback
- `answer-stats`: Send aggregated statistics
- `player-list-updated`: Update connected players list
- `game-ended`: End game and show final scores
- `presenter-message`: Send broadcast message to presenter view
- `host-disconnected`: Notify when host leaves the room
- `banned`: Notify user they are banned (triggers localStorage persistence)

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
  "your-new-subject": "your-questions.json"
}
```
4. Restart the server
5. Your subject will appear in the host's dropdown!

### Uploading Custom Questions (No Server Restart!)
1. Open host dashboard
2. Click "📁 Upload JSON File" button
3. Select your question JSON file
4. Questions are validated for security (XSS protection, size limits)
5. Create room with your custom questions!

### Adding Questions to Existing Subjects
Edit the corresponding JSON file in `questions/` folder. Follow the format of existing questions.

### Changing Ports
Use environment variables in `.env` file:
```
PORT=8080          # Main server port (default: 3000)
ADMIN_PORT=8081    # Admin panel port (default: 3001)
```

### Managing Banned IPs
1. Access admin panel at `http://localhost:3001`
2. Add IP addresses with reasons for bans
3. Export ban list for backup
4. Import ban list to restore
5. Bans persist in `banned-ips.json` file
6. Banned users see error page (stored in localStorage)

### Styling
- Edit CSS in `public/index.html` for player interface
- Edit CSS in `public/host.html` for host dashboard
- Edit CSS in `public/presenter.html` for presenter view
- Edit CSS in `public/admin.html` for admin panel

### Content Filtering
Edit `inappropriate-words.json` to customize blocked words in usernames.

## ⌨️ Navigation Tips

### Quick Navigation Modal
On any page in the application, type **`./`** (period followed by forward slash) to open a navigation modal that shows all available pages:
- Home / Player Join
- Host Dashboard
- Presenter View
- Question Creator
- Documentation
- Privacy Policy
- Terms of Service

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
- Verify JSON format is valid (use `/creator.html` or validate with JSON validator)
- Check server console for errors
- If using custom upload, ensure file meets validation requirements

**Host controls not working:**
- Ensure you created a room first
- Check browser console for errors
- Verify Socket.io connection is established

**Admin panel not accessible:**
- Ensure admin server is running (should start automatically with main server)
- Check port 3001 is not blocked by firewall
- Verify you're accessing `http://localhost:3001` not `http://localhost:3000/admin.html`

**Banned user can still connect:**
- Ban applies to IP address, not browser/device
- User may be on different network/IP
- Check localStorage is enabled in their browser
- Banned users can bypass by clearing site data (this is expected for browser-based storage)

## 🎓 Development Notes

This is a demonstration project showing:
- Socket.io room management
- Real-time multiplayer synchronization
- Event-driven architecture
- Clean separation of host and player interfaces
- Multiple question type handling
- IP-based ban system with localStorage persistence
- Secure file upload validation with XSS protection
- Multi-port server architecture (main + admin)

## 📝 Recent Updates

**December 2025:**
- ✅ Added admin panel on separate port (3001) for IP ban management
- ✅ Implemented IP ban system with localStorage persistence
- ✅ Added ban detection across all client pages
- ✅ Added custom JSON question upload feature
- ✅ Enhanced security: XSS protection, input validation, size limits
- ✅ Added Privacy Policy and Terms of Service pages
- ✅ Updated navigation modal to include all new pages
- ✅ Improved .gitignore with banned-ips.json exclusion

**November 2025:**
- ✅ Fixed scoring synchronization issue - all views (host, client, presenter) now show consistent scores
- ✅ Fixed host-reveal-answer to properly send score updates to all players
- ✅ Removed all VS Code linting warnings (inline styles, accessibility, Safari compatibility)
- ✅ Added proper CSS classes for all styling (no inline styles)
- ✅ Added `-webkit-backdrop-filter` for Safari support
- ✅ Improved accessibility with ARIA labels on form elements

## 📄 License

MIT License - Feel free to use and modify for your needs!
