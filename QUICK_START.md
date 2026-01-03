# Quick Start Guide - Play with Friends

## Step 1: Start the Server with ngrok

Open your terminal in this folder and run:

```bash
./START_WITH_NGROK.sh
```

## Step 2: Get Your Public URL

The script will display something like:

```
┌──────────────────────────────────────┐
│  Public URL (share with friend):     │
│                                      │
│  https://1234-56-78-90.ngrok.io/multiplayer.html
│                                      │
└──────────────────────────────────────┘
```

## Step 3: Share with Your Friend

1. Copy the entire URL (including `/multiplayer.html`)
2. Send it to your friend via:
   - Discord
   - Text message
   - Email
   - Any messaging app

## Step 4: Both Players Open the URL

- You: Open the URL in your browser
- Your Friend: Opens the same URL in their browser
- You'll both spawn in the same game world!

## Step 5: Play Together!

- Use **W/A/S/D** to move
- Click anywhere to shoot fireballs at monsters
- Work together to defeat the monsters
- See each other's positions in real-time

## Troubleshooting

### "Connection Error" message
- Make sure the server is still running
- Check that ngrok tunnel is active
- Try refreshing the page

### Friend can't connect
- Double-check the URL (must include `https://`)
- Make sure you copied the full URL with `/multiplayer.html`
- Verify ngrok is still running (you'll see it in the terminal)

### "Disconnected from server"
- Don't close the terminal window
- Keep your computer awake while playing
- Check your internet connection

## Viewing Connection Info

While the server is running, you can view:
- Ngrok dashboard: http://localhost:4040
- Number of connected players in the terminal output

## Stopping the Server

Press `Ctrl+C` in the terminal where the script is running.

---

## Alternative: Single Player

If you just want to test alone:

```bash
open index.html
```

This works completely offline, no server needed!
