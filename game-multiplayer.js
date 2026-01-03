// Game Configuration
const CONFIG = {
    TILE_SIZE: 32,
    MAP_WIDTH: 20,
    MAP_HEIGHT: 15,
    CANVAS_WIDTH: 20 * 32,
    CANVAS_HEIGHT: 15 * 32,
    FPS: 60,
    FIREBALL_SPEED: 8,
    FIREBALL_DAMAGE: 15,
    FIREBALL_COOLDOWN: 1000,
};

// Game State
const game = {
    canvas: null,
    ctx: null,
    running: false,
    map: [],
    players: new Map(), // All players including self
    myPlayerId: null,
    monsters: new Map(),
    fireballs: [],
    keys: {},
    mouseX: 0,
    mouseY: 0,
    lastFireball: 0,
    ws: null,
    connected: false,
};

// Tile types
const TILES = {
    GRASS: { emoji: '🟩', walkable: true },
    WATER: { emoji: '🟦', walkable: false },
    TREE: { emoji: '🌲', walkable: false },
    STONE: { emoji: '⬛', walkable: false },
    DIRT: { emoji: '🟫', walkable: true },
};

// Entity base class
class Entity {
    constructor(id, x, y, emoji, health, maxHealth) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.emoji = emoji;
        this.health = health;
        this.maxHealth = maxHealth;
    }

    draw(ctx, isLocalPlayer = false) {
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const centerX = this.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        const centerY = this.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

        ctx.fillText(this.emoji, centerX, centerY);

        // Draw health bar above entity
        if (this.health < this.maxHealth) {
            const barWidth = 30;
            const barHeight = 4;
            const barX = centerX - barWidth / 2;
            const barY = centerY - 20;

            ctx.fillStyle = '#000';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            ctx.fillStyle = '#f00';
            const healthWidth = (this.health / this.maxHealth) * barWidth;
            ctx.fillRect(barX, barY, healthWidth, barHeight);
        }

        // Draw name tag for other players
        if (!isLocalPlayer && this.name) {
            ctx.font = '10px Arial';
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText(this.name, centerX, centerY - 25);
            ctx.fillText(this.name, centerX, centerY - 25);
        }
    }
}

// Player class
class Player extends Entity {
    constructor(id, x, y, name) {
        super(id, x, y, '🧙', 100, 100);
        this.name = name;
    }
}

// Monster class
class Monster extends Entity {
    constructor(id, x, y) {
        super(id, x, y, '👹', 50, 50);
    }
}

// Fireball class
class Fireball {
    constructor(id, startX, startY, targetX, targetY) {
        this.id = id;
        this.x = startX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        this.y = startY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        this.vx = (dx / distance) * CONFIG.FIREBALL_SPEED;
        this.vy = (dy / distance) * CONFIG.FIREBALL_SPEED;

        this.active = true;
        this.emoji = '🔥';
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Check if out of bounds
        if (this.x < 0 || this.x > CONFIG.CANVAS_WIDTH ||
            this.y < 0 || this.y > CONFIG.CANVAS_HEIGHT) {
            this.active = false;
            return;
        }

        // Check collision with monsters (client-side prediction)
        game.monsters.forEach((monster, monsterId) => {
            const monsterCenterX = monster.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
            const monsterCenterY = monster.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

            const distance = Math.sqrt(
                Math.pow(this.x - monsterCenterX, 2) +
                Math.pow(this.y - monsterCenterY, 2)
            );

            if (distance < 16) {
                this.active = false;

                // Notify server of hit
                if (game.ws && game.ws.readyState === WebSocket.OPEN) {
                    game.ws.send(JSON.stringify({
                        type: 'fireballHit',
                        monsterId: monsterId,
                    }));
                }
            }
        });

        // Check collision with obstacles
        const tileX = Math.floor(this.x / CONFIG.TILE_SIZE);
        const tileY = Math.floor(this.y / CONFIG.TILE_SIZE);

        if (tileX >= 0 && tileX < CONFIG.MAP_WIDTH &&
            tileY >= 0 && tileY < CONFIG.MAP_HEIGHT) {
            if (!game.map[tileY][tileX].walkable) {
                this.active = false;
            }
        }
    }

    draw(ctx) {
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.x, this.y);
    }
}

// Connect to server
function connectToServer() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    game.ws = new WebSocket(wsUrl);

    game.ws.onopen = () => {
        console.log('Connected to server');
        game.connected = true;
        addLog('Connected to server!', 'info');
    };

    game.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
    };

    game.ws.onclose = () => {
        console.log('Disconnected from server');
        game.connected = false;
        game.running = false;
        addLog('Disconnected from server', 'damage');
    };

    game.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        addLog('Connection error!', 'damage');
    };
}

// Handle messages from server
function handleServerMessage(message) {
    switch (message.type) {
        case 'init':
            // Initialize game with server data
            game.myPlayerId = message.playerId;
            game.map = message.map;

            // Create players
            message.players.forEach(playerData => {
                const player = new Player(
                    playerData.id,
                    playerData.x,
                    playerData.y,
                    playerData.name
                );
                player.health = playerData.health;
                game.players.set(playerData.id, player);
            });

            // Create monsters
            message.monsters.forEach(monsterData => {
                const monster = new Monster(
                    monsterData.id,
                    monsterData.x,
                    monsterData.y
                );
                monster.health = monsterData.health;
                game.monsters.set(monsterData.id, monster);
            });

            game.running = true;
            updatePlayerUI();
            updateMonsterUI();
            addLog(`You joined as ${game.players.get(game.myPlayerId).name}`, 'info');
            break;

        case 'playerJoined':
            const newPlayer = new Player(
                message.player.id,
                message.player.x,
                message.player.y,
                message.player.name
            );
            newPlayer.health = message.player.health;
            game.players.set(message.player.id, newPlayer);
            addLog(`${message.player.name} joined the game!`, 'info');
            break;

        case 'playerLeft':
            const leftPlayer = game.players.get(message.playerId);
            if (leftPlayer) {
                addLog(`${leftPlayer.name} left the game`, 'info');
                game.players.delete(message.playerId);
            }
            break;

        case 'playerMoved':
            const movedPlayer = game.players.get(message.playerId);
            if (movedPlayer) {
                movedPlayer.x = message.x;
                movedPlayer.y = message.y;
            }
            break;

        case 'fireballCast':
            const fb = message.fireball;
            const fireball = new Fireball(
                fb.id,
                fb.startX,
                fb.startY,
                fb.targetX,
                fb.targetY
            );
            game.fireballs.push(fireball);
            break;

        case 'monsterMoved':
            const monster = game.monsters.get(message.monsterId);
            if (monster) {
                monster.x = message.x;
                monster.y = message.y;
            }
            break;

        case 'monsterDamaged':
            const damagedMonster = game.monsters.get(message.monsterId);
            if (damagedMonster) {
                damagedMonster.health = message.health;
                addLog(`Monster takes ${message.damage} damage!`, 'damage');
            }
            updateMonsterUI();
            break;

        case 'monsterDied':
            game.monsters.delete(message.monsterId);
            addLog('Monster defeated!', 'info');
            updateMonsterUI();
            break;

        case 'monsterSpawned':
            const newMonster = new Monster(
                message.monster.id,
                message.monster.x,
                message.monster.y
            );
            newMonster.health = message.monster.health;
            game.monsters.set(message.monster.id, newMonster);
            addLog('A new monster appeared!', 'info');
            updateMonsterUI();
            break;

        case 'playerDamaged':
            const damagedPlayer = game.players.get(message.playerId);
            if (damagedPlayer) {
                damagedPlayer.health = message.health;
                if (message.playerId === game.myPlayerId) {
                    addLog(`You take ${message.damage} damage!`, 'damage');
                    updatePlayerUI();
                }
            }
            break;

        case 'playerDied':
            if (message.playerId === game.myPlayerId) {
                gameOver();
            }
            break;
    }
}

// Initialize game
function init() {
    game.canvas = document.getElementById('gameCanvas');
    game.ctx = game.canvas.getContext('2d');

    game.canvas.width = CONFIG.CANVAS_WIDTH;
    game.canvas.height = CONFIG.CANVAS_HEIGHT;

    setupInput();
    connectToServer();

    requestAnimationFrame(gameLoop);
}

// Setup keyboard and mouse input
function setupInput() {
    document.addEventListener('keydown', (e) => {
        game.keys[e.key.toLowerCase()] = true;

        if (game.running && game.myPlayerId) {
            const myPlayer = game.players.get(game.myPlayerId);
            if (!myPlayer) return;

            let newX = myPlayer.x;
            let newY = myPlayer.y;
            let moved = false;

            if (e.key.toLowerCase() === 'w') {
                newY -= 1;
                moved = true;
            } else if (e.key.toLowerCase() === 's') {
                newY += 1;
                moved = true;
            } else if (e.key.toLowerCase() === 'a') {
                newX -= 1;
                moved = true;
            } else if (e.key.toLowerCase() === 'd') {
                newX += 1;
                moved = true;
            }

            if (moved && canMoveTo(newX, newY)) {
                // Optimistic update
                myPlayer.x = newX;
                myPlayer.y = newY;

                // Send to server
                game.ws.send(JSON.stringify({
                    type: 'move',
                    x: newX,
                    y: newY,
                }));

                updatePlayerUI();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        game.keys[e.key.toLowerCase()] = false;
    });

    game.canvas.addEventListener('mousemove', (e) => {
        const rect = game.canvas.getBoundingClientRect();
        game.mouseX = e.clientX - rect.left;
        game.mouseY = e.clientY - rect.top;
    });

    game.canvas.addEventListener('click', (e) => {
        if (!game.running || !game.myPlayerId) return;

        const now = Date.now();
        if (now - game.lastFireball < CONFIG.FIREBALL_COOLDOWN) {
            addLog('Fireball on cooldown!', 'info');
            return;
        }

        const rect = game.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const myPlayer = game.players.get(game.myPlayerId);

        // Send fireball to server
        game.ws.send(JSON.stringify({
            type: 'fireball',
            targetX: mouseX,
            targetY: mouseY,
        }));

        // Create local fireball immediately for responsiveness
        const fireball = new Fireball(
            Date.now(),
            myPlayer.x,
            myPlayer.y,
            mouseX,
            mouseY
        );

        game.fireballs.push(fireball);
        game.lastFireball = now;
        addLog('Cast fireball!', 'info');
    });
}

// Check if position is walkable
function canMoveTo(x, y) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) {
        return false;
    }
    return game.map[y][x].walkable;
}

// Game loop
function gameLoop(timestamp) {
    // Clear canvas
    game.ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    // Draw map
    drawMap();

    // Update and draw fireballs
    for (let i = game.fireballs.length - 1; i >= 0; i--) {
        game.fireballs[i].update();
        if (!game.fireballs[i].active) {
            game.fireballs.splice(i, 1);
        } else {
            game.fireballs[i].draw(game.ctx);
        }
    }

    // Draw monsters
    game.monsters.forEach(monster => {
        monster.draw(game.ctx);
    });

    // Draw players
    game.players.forEach((player, playerId) => {
        const isLocalPlayer = playerId === game.myPlayerId;
        player.draw(game.ctx, isLocalPlayer);
    });

    requestAnimationFrame(gameLoop);
}

// Draw the map
function drawMap() {
    if (!game.map || game.map.length === 0) {
        // Draw loading message
        game.ctx.fillStyle = '#fff';
        game.ctx.font = '20px Arial';
        game.ctx.textAlign = 'center';
        game.ctx.fillText('Connecting to server...', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2);
        return;
    }

    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
        for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
            const tile = game.map[y][x];

            game.ctx.font = '28px Arial';
            game.ctx.textAlign = 'center';
            game.ctx.textBaseline = 'middle';
            game.ctx.fillText(
                tile.emoji,
                x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
                y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2
            );
        }
    }
}

// Update UI
function updatePlayerUI() {
    const myPlayer = game.players.get(game.myPlayerId);
    if (!myPlayer) return;

    const healthPercent = (myPlayer.health / myPlayer.maxHealth) * 100;
    document.getElementById('playerHealthFill').style.width = healthPercent + '%';
    document.getElementById('playerHealthText').textContent =
        `${myPlayer.health} / ${myPlayer.maxHealth}`;
    document.getElementById('playerPos').textContent =
        `${myPlayer.x}, ${myPlayer.y}`;
    document.getElementById('playerDamage').textContent = '8-12 (melee) / 15 (fire)';
}

function updateMonsterUI() {
    const monsterCount = game.monsters.size;

    if (monsterCount === 0) {
        document.getElementById('monsterHealthFill').style.width = '0%';
        document.getElementById('monsterHealthText').textContent = 'No monsters';
        document.getElementById('monsterPos').textContent = '-';
        document.getElementById('monsterStatus').textContent = `${monsterCount} alive`;
        return;
    }

    // Show stats for first monster
    const firstMonster = Array.from(game.monsters.values())[0];
    const healthPercent = (firstMonster.health / firstMonster.maxHealth) * 100;
    document.getElementById('monsterHealthFill').style.width = healthPercent + '%';
    document.getElementById('monsterHealthText').textContent =
        `${firstMonster.health} / ${firstMonster.maxHealth}`;
    document.getElementById('monsterPos').textContent =
        `${firstMonster.x}, ${firstMonster.y}`;
    document.getElementById('monsterStatus').textContent = `${monsterCount} alive`;
}

// Add log entry
function addLog(message, type = 'info') {
    const log = document.getElementById('gameLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    while (log.children.length > 20) {
        log.removeChild(log.firstChild);
    }
}

// Game over
function gameOver() {
    game.running = false;
    document.getElementById('gameOver').style.display = 'block';
    addLog('You have been defeated!', 'damage');
}

// Start the game
init();
