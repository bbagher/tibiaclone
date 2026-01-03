// Game Configuration
const CONFIG = {
    TILE_SIZE: 32,
    MAP_WIDTH: 20,
    MAP_HEIGHT: 15,
    CANVAS_WIDTH: 20 * 32,
    CANVAS_HEIGHT: 15 * 32,
    FPS: 60,
    MONSTER_MOVE_INTERVAL: 500, // milliseconds
    MONSTER_ATTACK_INTERVAL: 1500,
    PLAYER_ATTACK_COOLDOWN: 500,
    FIREBALL_SPEED: 8, // pixels per frame
    FIREBALL_DAMAGE: 15,
    FIREBALL_COOLDOWN: 1000, // milliseconds
};

// Game State
const game = {
    canvas: null,
    ctx: null,
    lastFrameTime: 0,
    running: true,
    map: [],
    player: null,
    monster: null,
    fireballs: [],
    keys: {},
    mouseX: 0,
    mouseY: 0,
    lastMonsterMove: 0,
    lastMonsterAttack: 0,
    lastPlayerAttack: 0,
    lastFireball: 0,
};

// Tile types
const TILES = {
    GRASS: { emoji: '🟩', walkable: true },
    WATER: { emoji: '🟦', walkable: false },
    TREE: { emoji: '🌲', walkable: false },
    STONE: { emoji: '⬛', walkable: false },
    DIRT: { emoji: '🟫', walkable: true },
};

// Entity class
class Entity {
    constructor(x, y, emoji, health, maxHealth) {
        this.x = x;
        this.y = y;
        this.emoji = emoji;
        this.health = health;
        this.maxHealth = maxHealth;
    }

    draw(ctx) {
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            this.emoji,
            this.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
            this.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2
        );
    }

    canMoveTo(x, y) {
        if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) {
            return false;
        }
        return game.map[y][x].walkable;
    }

    moveTo(x, y) {
        if (this.canMoveTo(x, y)) {
            this.x = x;
            this.y = y;
            return true;
        }
        return false;
    }

    takeDamage(damage) {
        this.health = Math.max(0, this.health - damage);
        return this.health <= 0;
    }

    getDistance(other) {
        return Math.sqrt(
            Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2)
        );
    }
}

// Player class
class Player extends Entity {
    constructor(x, y) {
        super(x, y, '🧙', 100, 100);
        this.minDamage = 8;
        this.maxDamage = 12;
    }

    attack(target) {
        const now = Date.now();
        if (now - game.lastPlayerAttack < CONFIG.PLAYER_ATTACK_COOLDOWN) {
            return;
        }

        const distance = this.getDistance(target);
        if (distance <= 1.5) { // Adjacent or diagonal
            const damage = Math.floor(Math.random() * (this.maxDamage - this.minDamage + 1)) + this.minDamage;
            const killed = target.takeDamage(damage);
            game.lastPlayerAttack = now;

            addLog(`You hit the monster for ${damage} damage!`, 'damage');

            if (killed) {
                addLog('You defeated the monster!', 'info');
                game.monster = null;
                updateMonsterUI();
            }
        } else {
            addLog('Monster is too far away!', 'info');
        }
    }
}

// Fireball class
class Fireball {
    constructor(startX, startY, targetX, targetY) {
        // Convert grid position to pixel position (center of tile)
        this.x = startX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        this.y = startY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

        // Calculate direction vector
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Normalize direction
        this.vx = (dx / distance) * CONFIG.FIREBALL_SPEED;
        this.vy = (dy / distance) * CONFIG.FIREBALL_SPEED;

        this.active = true;
        this.emoji = '🔥';
    }

    update() {
        // Move fireball
        this.x += this.vx;
        this.y += this.vy;

        // Check if out of bounds
        if (this.x < 0 || this.x > CONFIG.CANVAS_WIDTH ||
            this.y < 0 || this.y > CONFIG.CANVAS_HEIGHT) {
            this.active = false;
            return;
        }

        // Check collision with monster
        if (game.monster) {
            const monsterCenterX = game.monster.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
            const monsterCenterY = game.monster.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

            const distance = Math.sqrt(
                Math.pow(this.x - monsterCenterX, 2) +
                Math.pow(this.y - monsterCenterY, 2)
            );

            // Hit detection (within 16 pixels - half a tile)
            if (distance < 16) {
                const killed = game.monster.takeDamage(CONFIG.FIREBALL_DAMAGE);
                addLog(`Fireball hits monster for ${CONFIG.FIREBALL_DAMAGE} damage!`, 'damage');

                if (killed) {
                    addLog('You defeated the monster with a fireball!', 'info');
                    game.monster = null;
                    updateMonsterUI();
                }

                this.active = false;
            }
        }

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

// Monster class
class Monster extends Entity {
    constructor(x, y) {
        super(x, y, '👹', 50, 50);
        this.minDamage = 5;
        this.maxDamage = 10;
        this.state = 'hunting'; // hunting, attacking
    }

    update() {
        if (!game.player) return;

        const now = Date.now();
        const distance = this.getDistance(game.player);

        // Attack if adjacent
        if (distance <= 1.5) {
            if (now - game.lastMonsterAttack >= CONFIG.MONSTER_ATTACK_INTERVAL) {
                this.attackPlayer();
                game.lastMonsterAttack = now;
            }
            this.state = 'attacking';
        } else {
            this.state = 'hunting';

            // Move towards player
            if (now - game.lastMonsterMove >= CONFIG.MONSTER_MOVE_INTERVAL) {
                this.moveTowardsPlayer();
                game.lastMonsterMove = now;
            }
        }
    }

    moveTowardsPlayer() {
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;

        let moveX = 0;
        let moveY = 0;

        // Determine primary direction
        if (Math.abs(dx) > Math.abs(dy)) {
            moveX = dx > 0 ? 1 : -1;
        } else if (Math.abs(dy) > Math.abs(dx)) {
            moveY = dy > 0 ? 1 : -1;
        } else if (dx !== 0) {
            // Diagonal movement - try both
            moveX = dx > 0 ? 1 : -1;
            moveY = dy > 0 ? 1 : -1;
        }

        // Try to move
        if (!this.moveTo(this.x + moveX, this.y + moveY)) {
            // If diagonal failed, try just X
            if (moveX !== 0 && !this.moveTo(this.x + moveX, this.y)) {
                // If X failed, try just Y
                this.moveTo(this.x, this.y + moveY);
            }
        }
    }

    attackPlayer() {
        const damage = Math.floor(Math.random() * (this.maxDamage - this.minDamage + 1)) + this.minDamage;
        const killed = game.player.takeDamage(damage);

        addLog(`Monster hits you for ${damage} damage!`, 'damage');
        updatePlayerUI();

        if (killed) {
            gameOver();
        }
    }
}

// Initialize game
function init() {
    game.canvas = document.getElementById('gameCanvas');
    game.ctx = game.canvas.getContext('2d');

    game.canvas.width = CONFIG.CANVAS_WIDTH;
    game.canvas.height = CONFIG.CANVAS_HEIGHT;

    // Generate map
    generateMap();

    // Create player at center
    game.player = new Player(
        Math.floor(CONFIG.MAP_WIDTH / 2),
        Math.floor(CONFIG.MAP_HEIGHT / 2)
    );

    // Create monster at random position
    let monsterX, monsterY;
    do {
        monsterX = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
        monsterY = Math.floor(Math.random() * CONFIG.MAP_HEIGHT);
    } while (
        !game.map[monsterY][monsterX].walkable ||
        (monsterX === game.player.x && monsterY === game.player.y) ||
        Math.abs(monsterX - game.player.x) < 3 ||
        Math.abs(monsterY - game.player.y) < 3
    );

    game.monster = new Monster(monsterX, monsterY);

    // Setup input
    setupInput();

    // Initial UI update
    updatePlayerUI();
    updateMonsterUI();

    // Start game loop
    requestAnimationFrame(gameLoop);
}

// Generate random map
function generateMap() {
    game.map = [];

    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
            const rand = Math.random();
            let tile;

            // Map edges are water
            if (x === 0 || x === CONFIG.MAP_WIDTH - 1 || y === 0 || y === CONFIG.MAP_HEIGHT - 1) {
                tile = TILES.WATER;
            }
            // Random terrain
            else if (rand < 0.7) {
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
        game.map.push(row);
    }
}

// Setup keyboard and mouse input
function setupInput() {
    // Keyboard events
    document.addEventListener('keydown', (e) => {
        game.keys[e.key.toLowerCase()] = true;

        // Handle player movement
        if (game.running && game.player) {
            let moved = false;

            if (e.key.toLowerCase() === 'w') {
                moved = game.player.moveTo(game.player.x, game.player.y - 1);
            } else if (e.key.toLowerCase() === 's') {
                moved = game.player.moveTo(game.player.x, game.player.y + 1);
            } else if (e.key.toLowerCase() === 'a') {
                moved = game.player.moveTo(game.player.x - 1, game.player.y);
            } else if (e.key.toLowerCase() === 'd') {
                moved = game.player.moveTo(game.player.x + 1, game.player.y);
            } else if (e.key === ' ') {
                e.preventDefault();
                if (game.monster) {
                    game.player.attack(game.monster);
                    updateMonsterUI();
                }
            }

            if (moved) {
                updatePlayerUI();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        game.keys[e.key.toLowerCase()] = false;
    });

    // Mouse events
    game.canvas.addEventListener('mousemove', (e) => {
        const rect = game.canvas.getBoundingClientRect();
        game.mouseX = e.clientX - rect.left;
        game.mouseY = e.clientY - rect.top;
    });

    game.canvas.addEventListener('click', (e) => {
        if (!game.running || !game.player) return;

        const now = Date.now();
        if (now - game.lastFireball < CONFIG.FIREBALL_COOLDOWN) {
            addLog('Fireball on cooldown!', 'info');
            return;
        }

        const rect = game.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Create fireball from player position towards mouse
        const fireball = new Fireball(
            game.player.x,
            game.player.y,
            mouseX,
            mouseY
        );

        game.fireballs.push(fireball);
        game.lastFireball = now;
        addLog('Cast fireball!', 'info');
    });
}

// Game loop
function gameLoop(timestamp) {
    if (!game.running) return;

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

    // Update and draw monster
    if (game.monster) {
        game.monster.update();
        game.monster.draw(game.ctx);
        updateMonsterUI();
    }

    // Draw player
    if (game.player) {
        game.player.draw(game.ctx);
    }

    game.lastFrameTime = timestamp;
    requestAnimationFrame(gameLoop);
}

// Draw the map
function drawMap() {
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
    if (!game.player) return;

    const healthPercent = (game.player.health / game.player.maxHealth) * 100;
    document.getElementById('playerHealthFill').style.width = healthPercent + '%';
    document.getElementById('playerHealthText').textContent =
        `${game.player.health} / ${game.player.maxHealth}`;
    document.getElementById('playerPos').textContent =
        `${game.player.x}, ${game.player.y}`;
    document.getElementById('playerDamage').textContent =
        `${game.player.minDamage}-${game.player.maxDamage}`;
}

function updateMonsterUI() {
    if (!game.monster) {
        document.getElementById('monsterHealthFill').style.width = '0%';
        document.getElementById('monsterHealthText').textContent = 'DEAD';
        document.getElementById('monsterPos').textContent = '-';
        document.getElementById('monsterStatus').textContent = 'Defeated';
        return;
    }

    const healthPercent = (game.monster.health / game.monster.maxHealth) * 100;
    document.getElementById('monsterHealthFill').style.width = healthPercent + '%';
    document.getElementById('monsterHealthText').textContent =
        `${game.monster.health} / ${game.monster.maxHealth}`;
    document.getElementById('monsterPos').textContent =
        `${game.monster.x}, ${game.monster.y}`;
    document.getElementById('monsterStatus').textContent =
        game.monster.state.charAt(0).toUpperCase() + game.monster.state.slice(1);
}

// Add log entry
function addLog(message, type = 'info') {
    const log = document.getElementById('gameLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    // Keep only last 20 entries
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
