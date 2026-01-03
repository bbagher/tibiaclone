const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(__dirname));

// Game state
const gameState = {
    players: new Map(), // playerId -> player data
    monsters: [],
    fireballs: [],
    map: [],
    nextPlayerId: 1,
};

// Configuration
const CONFIG = {
    TILE_SIZE: 32,
    MAP_WIDTH: 20,
    MAP_HEIGHT: 15,
    MONSTER_COUNT: 3,
    TICK_RATE: 60, // Server updates per second
};

// Generate map (same logic as client)
function generateMap() {
    const TILES = {
        GRASS: { emoji: '🟩', walkable: true },
        WATER: { emoji: '🟦', walkable: false },
        TREE: { emoji: '🌲', walkable: false },
        STONE: { emoji: '⬛', walkable: false },
        DIRT: { emoji: '🟫', walkable: true },
    };

    const map = [];
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
            const rand = Math.random();
            let tile;

            if (x === 0 || x === CONFIG.MAP_WIDTH - 1 || y === 0 || y === CONFIG.MAP_HEIGHT - 1) {
                tile = TILES.WATER;
            } else if (rand < 0.7) {
                tile = TILES.GRASS;
            } else if (rand < 0.8) {
                tile = TILES.DIRT;
            } else if (rand < 0.9) {
                tile = TILES.TREE;
            } else if (rand < 0.95) {
                tile = TILES.STONE;
            } else {
                tile = TILES.WATER;
            }

            row.push(tile);
        }
        map.push(row);
    }
    return map;
}

// Initialize game
function initGame() {
    gameState.map = generateMap();

    // Spawn initial monsters
    for (let i = 0; i < CONFIG.MONSTER_COUNT; i++) {
        spawnMonster();
    }
}

// Spawn a monster at random walkable position
function spawnMonster() {
    let x, y;
    do {
        x = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
        y = Math.floor(Math.random() * CONFIG.MAP_HEIGHT);
    } while (!gameState.map[y][x].walkable);

    const monster = {
        id: Date.now() + Math.random(),
        x,
        y,
        health: 50,
        maxHealth: 50,
        emoji: '👹',
        lastMove: Date.now(),
    };

    gameState.monsters.push(monster);
    return monster;
}

// Find spawn position for new player
function findSpawnPosition() {
    let x, y;
    let attempts = 0;
    do {
        x = Math.floor(Math.random() * (CONFIG.MAP_WIDTH - 4)) + 2;
        y = Math.floor(Math.random() * (CONFIG.MAP_HEIGHT - 4)) + 2;
        attempts++;
    } while (!gameState.map[y][x].walkable && attempts < 100);

    return { x, y };
}

// Broadcast to all connected clients
function broadcast(message, excludeClient = null) {
    wss.clients.forEach(client => {
        if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Send to specific client
function sendToClient(client, message) {
    if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
    }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New client connected');

    const playerId = gameState.nextPlayerId++;
    const spawnPos = findSpawnPosition();

    // Create new player
    const player = {
        id: playerId,
        x: spawnPos.x,
        y: spawnPos.y,
        health: 100,
        maxHealth: 100,
        emoji: '🧙',
        name: `Player${playerId}`,
    };

    gameState.players.set(playerId, player);
    ws.playerId = playerId;

    // Send initial game state to new player
    sendToClient(ws, {
        type: 'init',
        playerId: playerId,
        map: gameState.map,
        players: Array.from(gameState.players.values()),
        monsters: gameState.monsters,
    });

    // Notify other players
    broadcast({
        type: 'playerJoined',
        player: player,
    }, ws);

    console.log(`Player ${playerId} joined at (${spawnPos.x}, ${spawnPos.y})`);

    // Handle messages from client
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleClientMessage(ws, message);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    // Handle disconnect
    ws.on('close', () => {
        console.log(`Player ${playerId} disconnected`);
        gameState.players.delete(playerId);

        broadcast({
            type: 'playerLeft',
            playerId: playerId,
        });
    });
});

// Handle client messages
function handleClientMessage(ws, message) {
    const playerId = ws.playerId;
    const player = gameState.players.get(playerId);

    if (!player) return;

    switch (message.type) {
        case 'move':
            const { x, y } = message;
            if (isValidMove(x, y)) {
                player.x = x;
                player.y = y;

                broadcast({
                    type: 'playerMoved',
                    playerId: playerId,
                    x: x,
                    y: y,
                });
            }
            break;

        case 'fireball':
            const fireball = {
                id: Date.now() + Math.random(),
                playerId: playerId,
                startX: player.x,
                startY: player.y,
                targetX: message.targetX,
                targetY: message.targetY,
                timestamp: Date.now(),
            };

            gameState.fireballs.push(fireball);

            broadcast({
                type: 'fireballCast',
                fireball: fireball,
            });
            break;

        case 'attack':
            // Handle melee attack on monster
            const targetMonsterId = message.monsterId;
            const monster = gameState.monsters.find(m => m.id === targetMonsterId);

            if (monster) {
                const damage = Math.floor(Math.random() * 5) + 8; // 8-12 damage
                monster.health -= damage;

                if (monster.health <= 0) {
                    // Remove dead monster
                    gameState.monsters = gameState.monsters.filter(m => m.id !== targetMonsterId);

                    broadcast({
                        type: 'monsterDied',
                        monsterId: targetMonsterId,
                    });

                    // Spawn new monster after delay
                    setTimeout(() => {
                        const newMonster = spawnMonster();
                        broadcast({
                            type: 'monsterSpawned',
                            monster: newMonster,
                        });
                    }, 5000);
                } else {
                    broadcast({
                        type: 'monsterDamaged',
                        monsterId: targetMonsterId,
                        health: monster.health,
                        damage: damage,
                    });
                }
            }
            break;

        case 'fireballHit':
            // Client detected fireball hit
            const hitMonsterId = message.monsterId;
            const hitMonster = gameState.monsters.find(m => m.id === hitMonsterId);

            if (hitMonster) {
                const damage = 15;
                hitMonster.health -= damage;

                if (hitMonster.health <= 0) {
                    gameState.monsters = gameState.monsters.filter(m => m.id !== hitMonsterId);

                    broadcast({
                        type: 'monsterDied',
                        monsterId: hitMonsterId,
                    });

                    setTimeout(() => {
                        const newMonster = spawnMonster();
                        broadcast({
                            type: 'monsterSpawned',
                            monster: newMonster,
                        });
                    }, 5000);
                } else {
                    broadcast({
                        type: 'monsterDamaged',
                        monsterId: hitMonsterId,
                        health: hitMonster.health,
                        damage: damage,
                    });
                }
            }
            break;
    }
}

// Validate move
function isValidMove(x, y) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) {
        return false;
    }
    return gameState.map[y][x].walkable;
}

// Server game loop for monster AI
function gameLoop() {
    const now = Date.now();

    // Update monsters
    gameState.monsters.forEach(monster => {
        // Simple AI: move towards nearest player every 500ms
        if (now - monster.lastMove > 500) {
            monster.lastMove = now;

            // Find nearest player
            let nearestPlayer = null;
            let minDistance = Infinity;

            gameState.players.forEach(player => {
                const distance = Math.sqrt(
                    Math.pow(player.x - monster.x, 2) +
                    Math.pow(player.y - monster.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPlayer = player;
                }
            });

            if (nearestPlayer) {
                // Move towards player
                const dx = nearestPlayer.x - monster.x;
                const dy = nearestPlayer.y - monster.y;

                let moveX = 0;
                let moveY = 0;

                if (Math.abs(dx) > Math.abs(dy)) {
                    moveX = dx > 0 ? 1 : -1;
                } else if (Math.abs(dy) > Math.abs(dx)) {
                    moveY = dy > 0 ? 1 : -1;
                } else if (dx !== 0) {
                    moveX = dx > 0 ? 1 : -1;
                    moveY = dy > 0 ? 1 : -1;
                }

                const newX = monster.x + moveX;
                const newY = monster.y + moveY;

                if (isValidMove(newX, newY)) {
                    monster.x = newX;
                    monster.y = newY;

                    broadcast({
                        type: 'monsterMoved',
                        monsterId: monster.id,
                        x: newX,
                        y: newY,
                    });
                }

                // Attack if adjacent
                if (minDistance <= 1.5 && Math.random() < 0.3) {
                    const damage = Math.floor(Math.random() * 6) + 5; // 5-10 damage
                    nearestPlayer.health -= damage;

                    broadcast({
                        type: 'playerDamaged',
                        playerId: nearestPlayer.id,
                        health: nearestPlayer.health,
                        damage: damage,
                    });

                    if (nearestPlayer.health <= 0) {
                        broadcast({
                            type: 'playerDied',
                            playerId: nearestPlayer.id,
                        });
                    }
                }
            }
        }
    });
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    initGame();
    setInterval(gameLoop, 1000 / CONFIG.TICK_RATE);
});
