# 🎮 Quiz Game - Complete Beginner's Guide

Welcome! This guide will help you set up and run the quiz game even if you've never used Node.js or Visual Studio Code before.

## 📋 What You'll Need

Before starting, you need to install these programs on your computer:

1. **Node.js** - The engine that runs the game
2. **Visual Studio Code (VS Code)** - A code editor (like Microsoft Word, but for code)
3. **A Web Browser** - Chrome, Edge, or Firefox

---

## 🔧 Step 1: Install Node.js

### What is Node.js?
Node.js lets you run JavaScript programs on your computer (not just in a web browser).

### How to Install:

1. Go to: https://nodejs.org/
2. Download the **LTS version** (the green button that says "Recommended for Most Users")
3. Run the installer
4. Click "Next" through all the steps (keep all default settings)
5. Click "Install" and wait for it to finish

### Check if it worked:

1. Open **Command Prompt** (Windows) or **Terminal** (Mac/Linux)
   - Windows: Press `Win + R`, type `cmd`, press Enter
   - Mac: Press `Cmd + Space`, type `terminal`, press Enter
2. Type: `node --version`
3. Press Enter
4. You should see something like `v20.x.x` (the version number)

✅ If you see a version number, Node.js is installed!  
❌ If you see "command not found", restart your computer and try again.

---

## 💻 Step 2: Install Visual Studio Code

### What is VS Code?
VS Code is a free program that helps you view and edit code files. It's like a super-powered Notepad.

### How to Install:

1. Go to: https://code.visualstudio.com/
2. Click the big **Download** button
3. Run the installer
4. Accept the license agreement
5. **Important**: Check the box that says "Add to PATH" during installation
6. Click "Next" and "Install"

✅ After installation, you should be able to open VS Code from your Start Menu or Applications folder.

---

## 📦 Step 3: Download the Quiz Game

### Option A: Download as ZIP (Easier)

1. Go to the quiz game repository on GitHub [(link)](https://github.com/cbx-nz/node.js-quiz-server)
2. Click the green **Code** button
3. Click **Download ZIP**
4. Extract the ZIP file to a folder (e.g., `Documents/quiz-game`)
5. Remember where you saved it!

### Option B: Using Git (If you have it)

```bash
git clone <repository-url>
cd eoy-activity
```

---

## 🚀 Step 4: Open the Project in VS Code

1. Open **Visual Studio Code**
2. Click **File** → **Open Folder**
3. Navigate to where you extracted the quiz game
4. Select the folder (should be called `node.js quiz server` or similar)
5. Click **Select Folder**

You should now see a list of files on the left side of VS Code!

---

## 📥 Step 5: Install Dependencies

### What are Dependencies?
Dependencies are extra pieces of code that the quiz game needs to work. Think of them like ingredients for a recipe.

### How to Install:

1. In VS Code, click **Terminal** → **New Terminal** at the top menu
   - A panel will open at the bottom of the screen
2. Type this command:
   ```bash
   npm install
   ```
3. Press **Enter**
4. Wait for it to finish (you'll see lots of text scroll by - that's normal!)
5. When you see something like "added X packages", it's done!

✅ You should now have a folder called `node_modules` in your project.

---

## ▶️ Step 6: Start the Quiz Game Server

### How to Run:

1. In the VS Code terminal (bottom panel), type:
   ```bash
   npm start
   ```
2. Press **Enter**
3. You should see messages like:
   ```
   Server running on http://localhost:2730
   Host dashboard: http://localhost:2730/host.html
   Player interface: http://localhost:2730
   ```

✅ **The server is now running!** Don't close this window.

---

## 🎮 Step 7: Use the Quiz Game

### For the Host (Teacher/Organizer):

1. Open your web browser (Chrome, Edge, Firefox)
2. Go to: `http://localhost:2730/host.html`
3. Click **Create Room**
4. Choose a subject
5. Share the room code with players!

### For Players (Students):

1. Open a web browser
2. Go to: `http://localhost:2730`
3. Enter the room code
4. Enter your name
5. Click **Join Game**
6. Wait for the host to start!

### For the Presenter View (Big Screen):

1. In the host dashboard, click **🖥️ Open Presenter View**
2. This opens a full-screen view perfect for projectors or TVs

---

## 🛑 Step 8: Stop the Server

When you're done:

1. Go back to VS Code
2. Click in the Terminal panel (bottom)
3. Press `Ctrl + C` (Windows/Linux) or `Cmd + C` (Mac)
4. Type `Y` if asked to confirm
5. The server will stop

---

## 🆘 Troubleshooting

### Problem: "Port already in use"

**What it means:** Another program is using the same port (2730).

**Solution:**
1. Open the `.env` file in VS Code
2. Change `PORT=2730` to `PORT=3000` (or any number between 3000-9000)
3. Save the file
4. Run `npm start` again

### Problem: "Cannot find module"

**What it means:** Dependencies weren't installed properly.

**Solution:**
1. Stop the server (`Ctrl + C`)
2. Delete the `node_modules` folder
3. Run `npm install` again
4. Run `npm start`

### Problem: Players can't connect

**What it means:** They might be using the wrong URL.

**Solution:**
- Make sure players use: `http://localhost:2730`
- If on the same network, you can use your computer's IP address instead of "localhost"
- Check that the room code is exactly 6 characters

### Problem: "npm: command not found"

**What it means:** Node.js wasn't installed correctly.

**Solution:**
1. Restart your computer
2. Open Command Prompt/Terminal
3. Type: `node --version`
4. If still doesn't work, reinstall Node.js from Step 1

---

## 📚 Understanding the Files

Here's what each file does:

- **`server.js`** - The main program that runs the game
- **`public/host.html`** - The host control panel
- **`public/index.html`** - The player join page
- **`public/presenter.html`** - The big screen display
- **`questions/`** - Folder with all quiz questions
- **`question-files.json`** - List of available subjects
- **`package.json`** - List of dependencies and project info
- **`.env`** - Configuration settings (like port number)

---

## 🎓 Next Steps

Once you're comfortable:

1. **Add Custom Questions**: Edit files in the `questions/` folder
2. **Create New Subjects**: Add a new JSON file and update `question-files.json`
3. **Customize Appearance**: Edit the HTML files in the `public/` folder
4. **Change Settings**: Modify the `.env` file

---

## 💡 Tips for Success

1. **Always run `npm start` in the terminal** - The server must be running for the game to work
2. **Use localhost for testing** - When you're on the same computer
3. **Use your IP address for other devices** - When players are on different computers
4. **Keep the terminal open** - Closing it stops the server
5. **Check the terminal for errors** - It shows helpful messages if something goes wrong

---

## 🤝 Getting Help

If you're still stuck:

1. Check the terminal output for error messages
2. Read the main `README.md` for more technical details
3. Check the `docs.html` page at `http://localhost:2730/docs.html`
4. Search the error message online
5. Ask someone with programming experience

---

## ✅ Quick Start Checklist

- [ ] Install Node.js
- [ ] Install VS Code
- [ ] Download the quiz game
- [ ] Open folder in VS Code
- [ ] Run `npm install` in terminal
- [ ] Run `npm start` in terminal
- [ ] Open `http://localhost:2730/host.html` in browser
- [ ] Create a room
- [ ] Players join at `http://localhost:2730`
- [ ] Start the game!

---

## 🎉 You're Ready!

Congratulations! You now know how to:
- Install Node.js and VS Code
- Open projects in VS Code
- Install dependencies with npm
- Start and stop the server
- Access the game in your browser

Have fun running your quiz game! 🚀
