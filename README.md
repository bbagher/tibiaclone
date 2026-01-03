# Tibia Clone - Browser-based Multiplayer Game

A proof-of-concept browser-based online game with real-time multiplayer support.

## Features

### Single Player Mode
- Procedurally generated map with obstacles
- Player character with WASD movement
- Monster AI that hunts and attacks the player
- Fireball spell system (click to cast)
- Combat system with health tracking

### Multiplayer Mode
- Real-time multiplayer using WebSockets
- Multiple players can join the same game
- Shared game world and monsters
- Collaborative monster hunting
- Server-authoritative game state

## Getting Started

### Single Player
Simply open `index.html` in your browser.

### Multiplayer

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Start the Server

**Option A: Play with friends over the internet (via ngrok)**
```bash
./START_WITH_NGROK.sh
```
This will:
- Start the game server
- Create a public ngrok tunnel
- Display a shareable URL for your friend

**Option B: Play on local network only**
```bash
./START_MULTIPLAYER.sh
```
Or:
```bash
npm start
```

The server will start on `http://localhost:3000`

#### 3. Play with Friends

**If using ngrok:**
- The script will display a public URL like `https://xxxx-xx-xx-xx.ngrok.io/multiplayer.html`
- Copy that URL and send it to your friend
- Both of you open the URL in your browsers
- Play together from anywhere in the world!

**If using local network:**
- Open `http://localhost:3000/multiplayer.html` in your browser
- Share the URL with friends on the same network
- Multiple players can connect and play together!

## Controls

- **W/A/S/D** - Move character
- **Click Mouse** - Cast fireball towards cursor
- **Space** - Melee attack (single player only)

## Game Mechanics

### Player
- Health: 100 HP
- Melee Damage: 8-12 (single player)
- Fireball Damage: 15
- Fireball Cooldown: 1 second

### Monsters
- Health: 50 HP
- Damage: 5-10
- AI: Hunts nearest player
- Movement: Every 500ms
- Attack Rate: Every 1.5s when adjacent

### Multiplayer Features
- Server runs at 60 ticks/second
- Client-side prediction for smooth movement
- Server-authoritative combat
- Automatic monster respawning
- Player name tags and health bars
- 3 monsters spawn initially

## Technical Stack

### Frontend
- HTML5 Canvas for rendering
- Vanilla JavaScript
- WebSocket client for multiplayer
- Emoji-based placeholder graphics

### Backend (Multiplayer)
- Node.js
- Express for static file serving
- WebSocket (ws) for real-time communication
- Server-side game loop for AI and physics

## Project Structure

```
TibiaClone/
├── index.html              # Single player game
├── game.js                 # Single player game logic
├── multiplayer.html        # Multiplayer game page
├── game-multiplayer.js     # Multiplayer client logic
├── server.js               # Multiplayer server
├── package.json            # Node dependencies
├── spr_to_png.py          # Tibia sprite extractor
└── README.md              # This file
```

## Future Enhancements

- Replace emoji with actual Tibia sprites
- Add more spells and abilities
- Implement inventory system
- Add chat functionality
- Create different monster types
- Add respawn system for players
- Implement levels and experience
- Add item drops and looting

## Playing Over the Internet

### Using ngrok (Recommended for testing with friends)

ngrok creates a secure tunnel to your local server, giving you a public URL.

**Requirements:**
- ngrok must be installed (already installed on your system)
- Free ngrok account (optional, but gives you persistent URLs)

**Advantages:**
- No deployment needed
- Works immediately
- Free tier available
- Easy to share with friends

**Limitations:**
- Free tier has random URLs that change each time
- Free tier has bandwidth limits
- Connection depends on your computer being on

**To use:**
```bash
./START_WITH_NGROK.sh
```

### Alternative: Deploy to Cloud

For a permanent solution, deploy `server.js` to:
- Heroku
- Railway
- Render
- DigitalOcean
- AWS/GCP/Azure

## Notes

- The single player version (`index.html`) works completely offline
- The multiplayer version requires running the Node.js server
- ngrok is the easiest way to play with friends over the internet
- Monster AI runs on the server in multiplayer mode for fairness
