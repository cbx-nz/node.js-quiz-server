# 🚀 Quick Start Guide

## Running the Game

1. **Start the server:**
   ```
   npm start
   ```

2. **Open in browsers:**
   - Host: http://localhost:2730/host.html
   - Players: http://localhost:2730

## Playing the Game

### As Host:
1. Click "Create New Game Room"
2. Share the 6-character room code with players
3. Wait for players to join (you'll see them appear)
4. Click "▶️ Start Game"
5. Click "➡️ Next Question" to send each question
6. Monitor player answers and scores in real-time
7. Use broadcast to send messages like "Final Round!"
8. Click "⏹️ End Game" when finished

### As Player:
1. Enter the room code from the host
2. Enter your name
3. Click "Join Game"
4. Wait for host to start
5. Answer questions as they appear
6. See your score and results after each question
7. Click "Ready for Next Question" to continue

## Question Types You'll See:

- **Multiple Choice**: Pick the correct answer from 4 options
- **True/False**: Select true or false
- **Decision**: Choose what you would do (no right/wrong)
- **Flashcard**: Think of the answer, then reveal it
- **Open**: Type your response in text

## Tips:

- Multiple players can join the same room
- Each player tracks their own score
- Host can see all answers in real-time
- Game works on mobile devices too!
- Use broadcast to announce things like "Last Question!"

## Troubleshooting:

**Can't connect?**
- Make sure server is running (`npm start`)
- Check you're using the correct port (shown in terminal)
- Verify room code is exactly 6 characters

**Questions not showing?**
- Host must click "Next Question" to send each one
- Check that questions.json has content

**Score not updating?**
- Only multiple-choice and true/false have points
- Decision, flashcard, and open questions don't add points

---

**Enjoy the game! 🎮**
