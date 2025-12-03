# Sound Effects

This folder contains sound effects for the quiz game.

## Required Sound Files

### 1. notification.mp3
- **Purpose**: Plays when a player receives a broadcast message from the host
- **Recommended**: Short notification sound (1-2 seconds)
- **Suggested sources**:
  - https://pixabay.com/sound-effects/search/notification/
  - https://freesound.org/search/?q=notification
  - Use system notification sounds

### 2. all-answered.mp3
- **Purpose**: Plays on host's screen when all players have answered the question
- **Recommended**: Completion/success sound (1-2 seconds)
- **Suggested sources**:
  - https://pixabay.com/sound-effects/search/success/
  - https://freesound.org/search/?q=completion
  - Use achievement/completion sounds

## How to Add Sounds

1. Download or create your sound files (MP3 format recommended)
2. Name them exactly as shown above:
   - `notification.mp3`
   - `all-answered.mp3`
3. Place them in this `public/sounds/` directory
4. Sounds will automatically play when the events occur

## Sound Guidelines

- Keep files under 500KB each
- Use MP3 format for best browser compatibility
- Volume is set to 50% by default in the code
- Sounds should be short (1-3 seconds) and not annoying
- Test in multiple browsers

## Creating Your Own Sounds

You can use tools like:
- Audacity (free audio editor)
- Online MP3 converters
- Text-to-speech generators
- Your own recordings

## Note

The game will work without sound files - they simply won't play if the files are missing. There are no errors if sounds are not found.
