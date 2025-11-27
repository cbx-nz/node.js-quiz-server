# 🚀 Quick Start Guide

## Running the Game

1. **Install dependencies (first time only):**
   ```
   npm install
   ```

2. **Start the server:**
   ```
   npm start
   ```

3. **Open in browsers:**
   - Host Dashboard: http://localhost:2730/host.html
   - Players: http://localhost:2730
   - Question Creator: http://localhost:2730/creator.html
   - Documentation: http://localhost:2730/docs.html

## Playing the Game

### As Host

1. Select a subject from the dropdown (General, English, Math, Science, History, or Earth Science)
2. Click "Create New Game Room"
3. Share the 6-character room code with players
4. Click "🖥️ Open Presenter View" to display on a projector/big screen
5. Wait for players to join (you'll see them appear)
6. Click "▶️ Start Game" (requires at least 1 player)
7. Click "➡️ Next Question" to send each question
8. Click "👁️ Reveal Answer" to show correct answer (or wait for all players)
9. Use "❌ Kick" button to remove players with inappropriate names
10. Use broadcast to send messages like "Final Round!"
11. Click "⏹️ End Game" when finished

### As Player

1. Enter the 6-character room code from the host
2. Enter your name (keep it appropriate!)
3. Click "Join Game"
4. Wait for host to start (you can join mid-game too!)
5. Answer questions as fast as possible for maximum points
6. Wait for all players to answer or host to reveal
7. See your score update with position-based points

## Scoring System

- **1st place correct answer: 1000 points** 🥇
- **2nd place correct answer: 900 points** 🥈
- **3rd place correct answer: 800 points** 🥉
- Decreases by 100 points per position (minimum 100 points)
- **Wrong answer: 0 points**
- Speed matters! Answer quickly for more points

## Available Subjects 

- **General Knowledge** - 15 trivia questions
- **Mathematics** - 15 math questions
- **Science** - 15 science questions
- **History** - 15 history questions

## Question Types

- **Multiple Choice**: Pick the correct answer from options
- **True/False**: Select true or false
- **Decision**: Choose what you would do (no right/wrong)
- **Flashcard**: Think of the answer, then see it revealed
- **Open**: Type your response in text

## Creating Custom Questions

1. Go to http://localhost:2730/creator.html
2. Select question type and fill in details
3. Click "➕ Add Question" for each question
4. Click "💾 Download JSON" when done
5. Save file to `questions/` folder
6. Edit `server.js` to add your subject to `questionFiles` object
7. Restart server - your subject appears in the dropdown!

## Tips

- Players can join even after the game starts
- Presenter view hides answers until revealed
- Host can kick players with inappropriate usernames
- Answers are hidden until all players submit or host reveals
- Use broadcast to make announcements
- Game works on mobile devices too!
- Mid-game joining means latecomers can participate

## Troubleshooting

**Can't connect?**

- Make sure server is running (`npm start`)
- Check you're using the correct port (shown in terminal)
- Verify room code is exactly 6 characters

**Username rejected?**

- Your username contains filtered words
- Try a different, appropriate name
- Check `inappropriate-words.json` if you're the host

**Questions not showing?**

- Host must click "Next Question" to send each one
- Check that JSON files exist in `questions/` folder
- Verify subject is added to `questionFiles` in server.js

**Game won't end?**

- Click "⏹️ End Game" button
- Once ended, create a new room for another game

**Presenter view not opening?**

- Allow pop-ups in your browser
- Try manually opening `/presenter.html?room=YOURCODE`

---

**Need more help? Check the full documentation at `/docs.html` 📚**

**Enjoy the game! 🎮**
