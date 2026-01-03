// Map Editor State
const editor = {
    // Sprites
    allSprites: [],
    currentPage: 0,
    spritesPerPage: 30,
    selectedSprite: null,
    spriteRegistry: {}, // { spriteId: { id, file, name, walkable } }

    // Map
    mapWidth: 20,
    mapHeight: 15,
    tileSize: 32,
    layers: [{ name: 'Ground Layer', visible: true, tiles: [] }],
    currentLayer: 0,

    // Canvas
    canvas: null,
    ctx: null,
    zoom: 1,
    showGrid: true,

    // Tools
    currentTool: 'pencil', // pencil, fill, eraser, eyedropper
    isDrawing: false,

    // History
    history: [],
    historyIndex: -1,
    maxHistory: 50,

    // Search
    searchQuery: '',

    // Sectors
    sectors: [],
    selectedSector: null,
    showSectors: true,
    editorMode: 'tile', // 'tile' or 'sector'
    sectorDrawing: false,
    sectorDrawStart: null,
    nextSectorId: 1,
};

// Initialize the editor
function init() {
    editor.canvas = document.getElementById('mapCanvas');
    editor.ctx = editor.canvas.getContext('2d');

    // Load all sprites
    loadSprites();

    // Initialize map
    initializeMap();

    // Setup event listeners
    setupEventListeners();

    // Initial render
    renderCanvas();
    updateStats();

    // Try to load from localStorage
    loadFromLocalStorage();
}

// Load all sprites from sprites_output folder
async function loadSprites() {
    const spriteFolder = 'sprites_output/';
    const totalSprites = 10926; // Based on your file count

    for (let i = 1; i <= totalSprites; i++) {
        const spriteId = i;
        const fileName = `sprite_${String(i).padStart(5, '0')}.png`;

        // Check if file exists by trying to load it
        const img = new Image();
        img.src = `${spriteFolder}${fileName}`;

        // Only add if image loads successfully
        await new Promise((resolve) => {
            img.onload = () => {
                editor.allSprites.push({
                    id: spriteId,
                    file: fileName,
                    path: `${spriteFolder}${fileName}`,
                    img: img,
                    name: null,
                    walkable: true
                });
                resolve();
            };
            img.onerror = () => {
                resolve(); // Skip missing sprites
            };
        });
    }

    console.log(`Loaded ${editor.allSprites.length} sprites`);
    renderPalette();
    updateStats();
}

// Initialize empty map
function initializeMap() {
    editor.layers[0].tiles = [];
    for (let y = 0; y < editor.mapHeight; y++) {
        const row = [];
        for (let x = 0; x < editor.mapWidth; x++) {
            row.push(null);
        }
        editor.layers[0].tiles.push(row);
    }

    editor.canvas.width = editor.mapWidth * editor.tileSize;
    editor.canvas.height = editor.mapHeight * editor.tileSize;

    saveToHistory();
}

// Render sprite palette
function renderPalette() {
    const paletteGrid = document.getElementById('paletteGrid');
    paletteGrid.innerHTML = '';

    // Filter sprites by search query
    let filteredSprites = editor.allSprites;
    if (editor.searchQuery) {
        filteredSprites = editor.allSprites.filter(sprite => {
            const registry = editor.spriteRegistry[sprite.id];
            if (registry && registry.name) {
                return registry.name.toLowerCase().includes(editor.searchQuery.toLowerCase());
            }
            return false;
        });
    }

    const startIdx = editor.currentPage * editor.spritesPerPage;
    const endIdx = Math.min(startIdx + editor.spritesPerPage, filteredSprites.length);
    const pageSprites = filteredSprites.slice(startIdx, endIdx);

    pageSprites.forEach(sprite => {
        const item = document.createElement('div');
        item.className = 'sprite-item';

        if (editor.selectedSprite && editor.selectedSprite.id === sprite.id) {
            item.classList.add('selected');
        }

        const registry = editor.spriteRegistry[sprite.id];
        if (registry && registry.name) {
            item.classList.add('named');

            const label = document.createElement('div');
            label.className = 'sprite-name-label';
            label.textContent = registry.name;
            item.appendChild(label);
        }

        const img = document.createElement('img');
        img.src = sprite.path;
        item.appendChild(img);

        item.addEventListener('click', () => selectSprite(sprite));

        paletteGrid.appendChild(item);
    });

    // Update pagination
    const totalPages = Math.ceil(filteredSprites.length / editor.spritesPerPage);
    document.getElementById('pageInfo').textContent = `Page ${editor.currentPage + 1} of ${totalPages}`;
    document.getElementById('prevPage').disabled = editor.currentPage === 0;
    document.getElementById('nextPage').disabled = editor.currentPage >= totalPages - 1;
}

// Select a sprite
function selectSprite(sprite) {
    editor.selectedSprite = sprite;

    // Check if sprite has a name in registry
    const registry = editor.spriteRegistry[sprite.id];

    if (!registry || !registry.name) {
        // Show naming modal
        showNamingModal(sprite);
    } else {
        updateSelectedSpriteInfo();
    }

    renderPalette();
}

// Show naming modal
function showNamingModal(sprite) {
    const modal = document.getElementById('nameModal');
    const preview = document.getElementById('modalSpritePreview');
    const input = document.getElementById('spriteNameInput');
    const walkableCheckbox = document.getElementById('modalWalkable');

    preview.innerHTML = '';
    const img = document.createElement('img');
    img.src = sprite.path;
    preview.appendChild(img);

    input.value = '';
    walkableCheckbox.checked = true;

    modal.classList.add('active');
    input.focus();

    // Store current sprite being named
    modal.dataset.spriteId = sprite.id;
}

// Update selected sprite info panel
function updateSelectedSpriteInfo() {
    const preview = document.getElementById('selectedSpritePreview');
    const nameSpan = document.getElementById('spriteName');
    const fileSpan = document.getElementById('spriteFile');
    const walkableCheckbox = document.getElementById('spriteWalkable');

    if (!editor.selectedSprite) {
        preview.innerHTML = '<span class="no-selection">No sprite selected</span>';
        nameSpan.textContent = '-';
        fileSpan.textContent = '-';
        walkableCheckbox.checked = false;
        walkableCheckbox.disabled = true;
        return;
    }

    preview.innerHTML = '';
    const img = document.createElement('img');
    img.src = editor.selectedSprite.path;
    preview.appendChild(img);

    const registry = editor.spriteRegistry[editor.selectedSprite.id];
    nameSpan.textContent = registry ? registry.name : 'Unnamed';
    fileSpan.textContent = editor.selectedSprite.file;
    walkableCheckbox.checked = registry ? registry.walkable : true;
    walkableCheckbox.disabled = false;
}

// Save sprite name to registry
function saveSpriteToRegistry(spriteId, name, walkable) {
    editor.spriteRegistry[spriteId] = {
        id: spriteId,
        file: editor.allSprites.find(s => s.id === spriteId).file,
        name: name,
        walkable: walkable
    };

    updateSelectedSpriteInfo();
    updateStats();
    renderPalette();
    saveToLocalStorage();
}

// Render canvas
function renderCanvas() {
    const ctx = editor.ctx;
    const layer = editor.layers[editor.currentLayer];

    // Clear canvas
    ctx.clearRect(0, 0, editor.canvas.width, editor.canvas.height);

    // Draw checkerboard background
    for (let y = 0; y < editor.mapHeight; y++) {
        for (let x = 0; x < editor.mapWidth; x++) {
            const isLight = (x + y) % 2 === 0;
            ctx.fillStyle = isLight ? '#2a2a2a' : '#242424';
            ctx.fillRect(x * editor.tileSize, y * editor.tileSize, editor.tileSize, editor.tileSize);
        }
    }

    // Draw tiles
    for (let y = 0; y < editor.mapHeight; y++) {
        for (let x = 0; x < editor.mapWidth; x++) {
            const tile = layer.tiles[y][x];
            if (tile) {
                const sprite = editor.allSprites.find(s => s.id === tile.spriteId);
                if (sprite && sprite.img) {
                    ctx.drawImage(
                        sprite.img,
                        x * editor.tileSize,
                        y * editor.tileSize,
                        editor.tileSize,
                        editor.tileSize
                    );
                }
            }
        }
    }

    // Draw sectors
    if (editor.showSectors) {
        renderSectors();
    }

    // Draw grid
    if (editor.showGrid) {
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.lineWidth = 1;

        for (let x = 0; x <= editor.mapWidth; x++) {
            ctx.beginPath();
            ctx.moveTo(x * editor.tileSize, 0);
            ctx.lineTo(x * editor.tileSize, editor.canvas.height);
            ctx.stroke();
        }

        for (let y = 0; y <= editor.mapHeight; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * editor.tileSize);
            ctx.lineTo(editor.canvas.width, y * editor.tileSize);
            ctx.stroke();
        }
    }

    // Draw sector being created
    if (editor.sectorDrawing && editor.sectorDrawStart) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const start = editor.sectorDrawStart;
        const width = (editor.sectorDrawEnd.x - start.x) * editor.tileSize;
        const height = (editor.sectorDrawEnd.y - start.y) * editor.tileSize;
        ctx.strokeRect(
            start.x * editor.tileSize,
            start.y * editor.tileSize,
            width,
            height
        );
        ctx.setLineDash([]);
    }

    updateTileCount();
}

// Render sectors overlay
function renderSectors() {
    const ctx = editor.ctx;

    editor.sectors.forEach(sector => {
        const bounds = sector.boundaries;
        const x = bounds.x * editor.tileSize;
        const y = bounds.y * editor.tileSize;
        const width = bounds.width * editor.tileSize;
        const height = bounds.height * editor.tileSize;

        // Fill
        ctx.fillStyle = hexToRGBA(sector.color, sector.opacity);
        ctx.fillRect(x, y, width, height);

        // Border
        ctx.strokeStyle = sector === editor.selectedSector ? '#ffd700' : sector.color;
        ctx.lineWidth = sector === editor.selectedSector ? 3 : 2;
        ctx.strokeRect(x, y, width, height);

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(sector.name, x + 5, y + 5);
    });
}

// Helper function to convert hex to rgba
function hexToRGBA(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Handle canvas mouse down
function handleCanvasMouseDown(e) {
    if (editor.editorMode === 'sector') {
        handleSectorMouseDown(e);
    } else {
        editor.isDrawing = true;
        handleCanvasInteraction(e);
    }
}

// Handle canvas mouse move
function handleCanvasMouseMove(e) {
    // Update mouse position display
    const rect = editor.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / editor.tileSize);
    const y = Math.floor((e.clientY - rect.top) / editor.tileSize);

    document.getElementById('mousePos').textContent = `${x}, ${y}`;

    // Show current sector
    if (editor.editorMode === 'sector' || editor.showSectors) {
        const sector = getSectorAtPosition(x, y);
        const sectorInfo = document.getElementById('currentSectorInfo');
        if (sector) {
            sectorInfo.textContent = `Sector: ${sector.name}`;
            sectorInfo.style.color = sector.color;
        } else {
            sectorInfo.textContent = '';
        }
    }

    if (editor.editorMode === 'sector') {
        handleSectorMouseMove(e);
    } else if (editor.isDrawing) {
        handleCanvasInteraction(e);
    }
}

// Handle canvas mouse up
function handleCanvasMouseUp() {
    if (editor.editorMode === 'sector') {
        handleSectorMouseUp();
    } else if (editor.isDrawing) {
        editor.isDrawing = false;
        saveToHistory();
    }
}

// Sector mouse handlers
function handleSectorMouseDown(e) {
    const rect = editor.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / editor.tileSize);
    const y = Math.floor((e.clientY - rect.top) / editor.tileSize);

    // Check if clicking on existing sector
    const clickedSector = getSectorAtPosition(x, y);
    if (clickedSector) {
        selectSector(clickedSector);
        return;
    }

    // Start drawing new sector
    editor.sectorDrawing = true;
    editor.sectorDrawStart = { x, y };
    editor.sectorDrawEnd = { x, y };
}

function handleSectorMouseMove(e) {
    if (!editor.sectorDrawing) return;

    const rect = editor.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / editor.tileSize);
    const y = Math.floor((e.clientY - rect.top) / editor.tileSize);

    editor.sectorDrawEnd = { x, y };
    renderCanvas();
}

function handleSectorMouseUp() {
    if (!editor.sectorDrawing) return;

    editor.sectorDrawing = false;

    const start = editor.sectorDrawStart;
    const end = editor.sectorDrawEnd;

    // Calculate bounds (handle negative drawing)
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x) + 1;
    const height = Math.abs(end.y - start.y) + 1;

    // Only create if area is larger than 1x1
    if (width > 1 || height > 1) {
        createSector(x, y, width, height);
    }

    editor.sectorDrawStart = null;
    editor.sectorDrawEnd = null;
    renderCanvas();
}

// Get sector at position
function getSectorAtPosition(x, y) {
    // Check in reverse order (top sectors first)
    for (let i = editor.sectors.length - 1; i >= 0; i--) {
        const sector = editor.sectors[i];
        const bounds = sector.boundaries;

        if (x >= bounds.x && x < bounds.x + bounds.width &&
            y >= bounds.y && y < bounds.y + bounds.height) {
            return sector;
        }
    }
    return null;
}

// Handle canvas interaction
function handleCanvasInteraction(e) {
    const rect = editor.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / editor.tileSize);
    const y = Math.floor((e.clientY - rect.top) / editor.tileSize);

    if (x < 0 || x >= editor.mapWidth || y < 0 || y >= editor.mapHeight) {
        return;
    }

    const layer = editor.layers[editor.currentLayer];

    switch (editor.currentTool) {
        case 'pencil':
            if (editor.selectedSprite) {
                layer.tiles[y][x] = {
                    spriteId: editor.selectedSprite.id,
                    spriteName: editor.spriteRegistry[editor.selectedSprite.id]?.name || null
                };
                renderCanvas();
            }
            break;

        case 'eraser':
            layer.tiles[y][x] = null;
            renderCanvas();
            break;

        case 'eyedropper':
            const tile = layer.tiles[y][x];
            if (tile) {
                const sprite = editor.allSprites.find(s => s.id === tile.spriteId);
                if (sprite) {
                    selectSprite(sprite);
                    setTool('pencil');
                }
            }
            break;

        case 'fill':
            if (editor.selectedSprite) {
                floodFill(x, y, layer.tiles[y][x], {
                    spriteId: editor.selectedSprite.id,
                    spriteName: editor.spriteRegistry[editor.selectedSprite.id]?.name || null
                });
                renderCanvas();
                saveToHistory();
            }
            break;
    }
}

// Flood fill algorithm
function floodFill(x, y, targetTile, replacementTile) {
    const layer = editor.layers[editor.currentLayer];

    // Check if target and replacement are the same
    const targetId = targetTile ? targetTile.spriteId : null;
    const replacementId = replacementTile.spriteId;

    if (targetId === replacementId) return;

    const stack = [[x, y]];
    const visited = new Set();

    while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const key = `${cx},${cy}`;

        if (visited.has(key)) continue;
        if (cx < 0 || cx >= editor.mapWidth || cy < 0 || cy >= editor.mapHeight) continue;

        const currentTile = layer.tiles[cy][cx];
        const currentId = currentTile ? currentTile.spriteId : null;

        if (currentId !== targetId) continue;

        visited.add(key);
        layer.tiles[cy][cx] = { ...replacementTile };

        // Add neighbors
        stack.push([cx + 1, cy]);
        stack.push([cx - 1, cy]);
        stack.push([cx, cy + 1]);
        stack.push([cx, cy - 1]);
    }
}

// Set current tool
function setTool(tool) {
    editor.currentTool = tool;

    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(`tool${tool.charAt(0).toUpperCase() + tool.slice(1)}`).classList.add('active');

    // Update cursor
    if (tool === 'eyedropper') {
        editor.canvas.style.cursor = 'pointer';
    } else if (tool === 'eraser') {
        editor.canvas.style.cursor = 'not-allowed';
    } else {
        editor.canvas.style.cursor = 'crosshair';
    }
}

// History management
function saveToHistory() {
    // Remove any history after current index
    editor.history = editor.history.slice(0, editor.historyIndex + 1);

    // Add current state
    const state = JSON.parse(JSON.stringify(editor.layers));
    editor.history.push(state);

    // Limit history size
    if (editor.history.length > editor.maxHistory) {
        editor.history.shift();
    } else {
        editor.historyIndex++;
    }

    updateUndoRedoButtons();
    saveToLocalStorage();
}

function undo() {
    if (editor.historyIndex > 0) {
        editor.historyIndex--;
        editor.layers = JSON.parse(JSON.stringify(editor.history[editor.historyIndex]));
        renderCanvas();
        updateUndoRedoButtons();
        saveToLocalStorage();
    }
}

function redo() {
    if (editor.historyIndex < editor.history.length - 1) {
        editor.historyIndex++;
        editor.layers = JSON.parse(JSON.stringify(editor.history[editor.historyIndex]));
        renderCanvas();
        updateUndoRedoButtons();
        saveToLocalStorage();
    }
}

function updateUndoRedoButtons() {
    document.getElementById('undoBtn').disabled = editor.historyIndex <= 0;
    document.getElementById('redoBtn').disabled = editor.historyIndex >= editor.history.length - 1;
}

// Sector management functions
function createSector(x, y, width, height) {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    const color = colors[editor.sectors.length % colors.length];

    const sector = {
        id: editor.nextSectorId++,
        name: `Sector ${editor.sectors.length + 1}`,
        color: color,
        opacity: 0.3,
        boundaries: {
            type: 'rect',
            x: x,
            y: y,
            width: width,
            height: height
        },
        properties: {
            music: '',
            pvpEnabled: false,
            customProperties: {}
        }
    };

    editor.sectors.push(sector);
    selectSector(sector);
    renderSectorsList();
    renderCanvas();
    saveToLocalStorage();
}

function selectSector(sector) {
    editor.selectedSector = sector;
    renderSectorsList();
    showSectorProperties(sector);
    renderCanvas();
}

function showSectorProperties(sector) {
    const panel = document.getElementById('sectorPropertiesPanel');
    panel.style.display = 'block';

    document.getElementById('sectorName').value = sector.name;
    document.getElementById('sectorColor').value = sector.color;
    document.getElementById('sectorOpacity').value = sector.opacity * 100;
    document.getElementById('opacityValue').textContent = Math.round(sector.opacity * 100) + '%';
    document.getElementById('sectorPvp').checked = sector.properties.pvpEnabled;
    document.getElementById('sectorMusic').value = sector.properties.music || '';

    renderCustomProperties(sector);
}

function renderSectorsList() {
    const list = document.getElementById('sectorsList');
    list.innerHTML = '';

    if (editor.sectors.length === 0) {
        list.innerHTML = '<p style="color: #666; padding: 10px; text-align: center;">No sectors yet</p>';
        return;
    }

    editor.sectors.forEach(sector => {
        const item = document.createElement('div');
        item.className = 'sector-item';
        if (sector === editor.selectedSector) {
            item.classList.add('active');
        }

        const info = document.createElement('div');
        info.className = 'sector-info';

        const colorIndicator = document.createElement('div');
        colorIndicator.className = 'sector-color-indicator';
        colorIndicator.style.background = sector.color;

        const name = document.createElement('div');
        name.className = 'sector-name';
        name.textContent = sector.name;

        const bounds = document.createElement('div');
        bounds.className = 'sector-bounds';
        bounds.textContent = `${sector.boundaries.width}x${sector.boundaries.height}`;

        info.appendChild(colorIndicator);
        info.appendChild(name);
        info.appendChild(bounds);

        item.appendChild(info);

        item.addEventListener('click', () => {
            selectSector(sector);
        });

        list.appendChild(item);
    });
}

function renderCustomProperties(sector) {
    const list = document.getElementById('customPropertiesList');
    list.innerHTML = '';

    const props = sector.properties.customProperties || {};
    Object.keys(props).forEach(key => {
        const item = document.createElement('div');
        item.className = 'custom-property-item';

        const keyInput = document.createElement('input');
        keyInput.value = key;
        keyInput.placeholder = 'Key';
        keyInput.addEventListener('change', (e) => {
            const oldKey = key;
            const newKey = e.target.value;
            if (newKey && newKey !== oldKey) {
                props[newKey] = props[oldKey];
                delete props[oldKey];
                renderCustomProperties(sector);
                saveToLocalStorage();
            }
        });

        const valueInput = document.createElement('input');
        valueInput.value = props[key];
        valueInput.placeholder = 'Value';
        valueInput.addEventListener('change', (e) => {
            props[key] = e.target.value;
            saveToLocalStorage();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', () => {
            delete props[key];
            renderCustomProperties(sector);
            saveToLocalStorage();
        });

        item.appendChild(keyInput);
        item.appendChild(valueInput);
        item.appendChild(deleteBtn);
        list.appendChild(item);
    });
}

function deleteSector(sector) {
    const index = editor.sectors.indexOf(sector);
    if (index > -1) {
        editor.sectors.splice(index, 1);
        editor.selectedSector = null;
        document.getElementById('sectorPropertiesPanel').style.display = 'none';
        renderSectorsList();
        renderCanvas();
        saveToLocalStorage();
    }
}

// Export to JSON
function exportToJSON() {
    const data = {
        version: '1.0',
        mapWidth: editor.mapWidth,
        mapHeight: editor.mapHeight,
        tileSize: editor.tileSize,
        layers: editor.layers,
        spriteRegistry: editor.spriteRegistry,
        sectors: editor.sectors
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `map_${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
}

// Import from JSON
function importFromJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            editor.mapWidth = data.mapWidth;
            editor.mapHeight = data.mapHeight;
            editor.tileSize = data.tileSize;
            editor.layers = data.layers;
            editor.spriteRegistry = data.spriteRegistry || {};
            editor.sectors = data.sectors || [];

            // Update next sector ID
            if (editor.sectors.length > 0) {
                editor.nextSectorId = Math.max(...editor.sectors.map(s => s.id)) + 1;
            }

            // Update UI
            document.getElementById('mapWidth').value = editor.mapWidth;
            document.getElementById('mapHeight').value = editor.mapHeight;
            document.getElementById('tileSize').value = editor.tileSize;

            // Resize canvas
            editor.canvas.width = editor.mapWidth * editor.tileSize;
            editor.canvas.height = editor.mapHeight * editor.tileSize;

            renderCanvas();
            renderSectorsList();
            updateStats();
            saveToHistory();

            alert('Map imported successfully!');
        } catch (err) {
            alert('Error importing map: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// Export to PNG
function exportToPNG() {
    const link = document.createElement('a');
    link.download = `map_${Date.now()}.png`;
    link.href = editor.canvas.toDataURL();
    link.click();
}

// Update statistics
function updateStats() {
    document.getElementById('totalSprites').textContent = editor.allSprites.length;
    document.getElementById('namedSprites').textContent = Object.keys(editor.spriteRegistry).length;

    // Count unique sprites used
    const uniqueSprites = new Set();
    editor.layers.forEach(layer => {
        layer.tiles.forEach(row => {
            row.forEach(tile => {
                if (tile) {
                    uniqueSprites.add(tile.spriteId);
                }
            });
        });
    });
    document.getElementById('uniqueSprites').textContent = uniqueSprites.size;
}

// Update tile count
function updateTileCount() {
    let count = 0;
    editor.layers.forEach(layer => {
        layer.tiles.forEach(row => {
            row.forEach(tile => {
                if (tile) count++;
            });
        });
    });
    document.getElementById('tileCount').textContent = count;
}

// Save to localStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem('mapEditorState', JSON.stringify({
            spriteRegistry: editor.spriteRegistry,
            layers: editor.layers,
            mapWidth: editor.mapWidth,
            mapHeight: editor.mapHeight,
            tileSize: editor.tileSize,
            sectors: editor.sectors
        }));
    } catch (e) {
        console.warn('Could not save to localStorage:', e);
    }
}

// Load from localStorage
function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('mapEditorState');
        if (saved) {
            const data = JSON.parse(saved);
            editor.spriteRegistry = data.spriteRegistry || {};

            if (confirm('Found saved work. Would you like to restore it?')) {
                editor.layers = data.layers;
                editor.mapWidth = data.mapWidth;
                editor.mapHeight = data.mapHeight;
                editor.tileSize = data.tileSize;
                editor.sectors = data.sectors || [];

                // Update next sector ID
                if (editor.sectors.length > 0) {
                    editor.nextSectorId = Math.max(...editor.sectors.map(s => s.id)) + 1;
                }

                document.getElementById('mapWidth').value = editor.mapWidth;
                document.getElementById('mapHeight').value = editor.mapHeight;
                document.getElementById('tileSize').value = editor.tileSize;

                editor.canvas.width = editor.mapWidth * editor.tileSize;
                editor.canvas.height = editor.mapHeight * editor.tileSize;

                renderCanvas();
                renderSectorsList();
                updateStats();
            }
        }
    } catch (e) {
        console.warn('Could not load from localStorage:', e);
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Canvas events
    editor.canvas.addEventListener('mousedown', handleCanvasMouseDown);
    editor.canvas.addEventListener('mousemove', handleCanvasMouseMove);
    editor.canvas.addEventListener('mouseup', handleCanvasMouseUp);
    editor.canvas.addEventListener('mouseleave', handleCanvasMouseUp);

    // Tool buttons
    document.getElementById('toolPencil').addEventListener('click', () => setTool('pencil'));
    document.getElementById('toolFill').addEventListener('click', () => setTool('fill'));
    document.getElementById('toolEraser').addEventListener('click', () => setTool('eraser'));
    document.getElementById('toolEyedropper').addEventListener('click', () => setTool('eyedropper'));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;

        switch (e.key.toLowerCase()) {
            case 'p':
                setTool('pencil');
                break;
            case 'f':
                setTool('fill');
                break;
            case 'e':
                setTool('eraser');
                break;
            case 'i':
                setTool('eyedropper');
                break;
            case 'z':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    undo();
                }
                break;
            case 'y':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    redo();
                }
                break;
        }
    });

    // Pagination
    document.getElementById('prevPage').addEventListener('click', () => {
        if (editor.currentPage > 0) {
            editor.currentPage--;
            renderPalette();
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        const filteredSprites = editor.searchQuery
            ? editor.allSprites.filter(s => {
                const reg = editor.spriteRegistry[s.id];
                return reg && reg.name && reg.name.toLowerCase().includes(editor.searchQuery.toLowerCase());
            })
            : editor.allSprites;

        const maxPage = Math.ceil(filteredSprites.length / editor.spritesPerPage) - 1;
        if (editor.currentPage < maxPage) {
            editor.currentPage++;
            renderPalette();
        }
    });

    // Search
    document.getElementById('spriteSearch').addEventListener('input', (e) => {
        editor.searchQuery = e.target.value;
        editor.currentPage = 0;
        renderPalette();
    });

    // Modal
    document.getElementById('saveNameBtn').addEventListener('click', () => {
        const modal = document.getElementById('nameModal');
        const spriteId = parseInt(modal.dataset.spriteId);
        const name = document.getElementById('spriteNameInput').value.trim();
        const walkable = document.getElementById('modalWalkable').checked;

        if (!name) {
            alert('Please enter a name for the sprite');
            return;
        }

        saveSpriteToRegistry(spriteId, name, walkable);
        modal.classList.remove('active');
    });

    document.getElementById('cancelNameBtn').addEventListener('click', () => {
        document.getElementById('nameModal').classList.remove('active');
        editor.selectedSprite = null;
        renderPalette();
    });

    // Suggestion buttons
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('spriteNameInput').value = btn.dataset.name;
        });
    });

    // Sprite walkable checkbox
    document.getElementById('spriteWalkable').addEventListener('change', (e) => {
        if (editor.selectedSprite) {
            const registry = editor.spriteRegistry[editor.selectedSprite.id];
            if (registry) {
                registry.walkable = e.target.checked;
                saveToLocalStorage();
            }
        }
    });

    // View controls
    document.getElementById('showGrid').addEventListener('change', (e) => {
        editor.showGrid = e.target.checked;
        renderCanvas();
    });

    document.getElementById('zoomIn').addEventListener('click', () => {
        editor.zoom = Math.min(editor.zoom + 0.25, 3);
        editor.canvas.style.transform = `scale(${editor.zoom})`;
        document.getElementById('zoomLevel').textContent = Math.round(editor.zoom * 100) + '%';
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        editor.zoom = Math.max(editor.zoom - 0.25, 0.5);
        editor.canvas.style.transform = `scale(${editor.zoom})`;
        document.getElementById('zoomLevel').textContent = Math.round(editor.zoom * 100) + '%';
    });

    // Undo/Redo
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);

    // Clear map
    document.getElementById('clearBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the entire map?')) {
            editor.layers[editor.currentLayer].tiles = [];
            for (let y = 0; y < editor.mapHeight; y++) {
                const row = [];
                for (let x = 0; x < editor.mapWidth; x++) {
                    row.push(null);
                }
                editor.layers[editor.currentLayer].tiles.push(row);
            }
            renderCanvas();
            saveToHistory();
        }
    });

    // Export/Import
    document.getElementById('exportBtn').addEventListener('click', exportToJSON);
    document.getElementById('exportImageBtn').addEventListener('click', exportToPNG);

    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importFromJSON(file);
        }
        e.target.value = ''; // Reset file input
    });

    // New map
    document.getElementById('newMapBtn').addEventListener('click', () => {
        if (confirm('Create a new map? This will clear the current map.')) {
            initializeMap();
            renderCanvas();
        }
    });

    // Apply map settings
    document.getElementById('applyMapSettings').addEventListener('click', () => {
        const newWidth = parseInt(document.getElementById('mapWidth').value);
        const newHeight = parseInt(document.getElementById('mapHeight').value);
        const newTileSize = parseInt(document.getElementById('tileSize').value);

        if (newWidth < 5 || newWidth > 100 || newHeight < 5 || newHeight > 100) {
            alert('Map dimensions must be between 5 and 100');
            return;
        }

        if (newTileSize < 16 || newTileSize > 64) {
            alert('Tile size must be between 16 and 64');
            return;
        }

        editor.mapWidth = newWidth;
        editor.mapHeight = newHeight;
        editor.tileSize = newTileSize;

        // Resize layers
        editor.layers.forEach(layer => {
            const newTiles = [];
            for (let y = 0; y < newHeight; y++) {
                const row = [];
                for (let x = 0; x < newWidth; x++) {
                    if (layer.tiles[y] && layer.tiles[y][x]) {
                        row.push(layer.tiles[y][x]);
                    } else {
                        row.push(null);
                    }
                }
                newTiles.push(row);
            }
            layer.tiles = newTiles;
        });

        editor.canvas.width = editor.mapWidth * editor.tileSize;
        editor.canvas.height = editor.mapHeight * editor.tileSize;

        document.getElementById('mapSize').textContent = `${editor.mapWidth} x ${editor.mapHeight}`;

        renderCanvas();
        saveToHistory();
    });

    // Fill all
    document.getElementById('fillAllBtn').addEventListener('click', () => {
        if (!editor.selectedSprite) {
            alert('Please select a sprite first');
            return;
        }

        if (confirm('Fill all tiles with the selected sprite?')) {
            const layer = editor.layers[editor.currentLayer];
            for (let y = 0; y < editor.mapHeight; y++) {
                for (let x = 0; x < editor.mapWidth; x++) {
                    layer.tiles[y][x] = {
                        spriteId: editor.selectedSprite.id,
                        spriteName: editor.spriteRegistry[editor.selectedSprite.id]?.name || null
                    };
                }
            }
            renderCanvas();
            saveToHistory();
        }
    });

    // Mode toggle
    document.getElementById('tileMode').addEventListener('click', () => {
        editor.editorMode = 'tile';
        document.getElementById('tileMode').classList.add('active');
        document.getElementById('sectorMode').classList.remove('active');
        editor.canvas.style.cursor = 'crosshair';
    });

    document.getElementById('sectorMode').addEventListener('click', () => {
        editor.editorMode = 'sector';
        document.getElementById('sectorMode').classList.add('active');
        document.getElementById('tileMode').classList.remove('active');
        editor.canvas.style.cursor = 'crosshair';
    });

    // Show sectors toggle
    document.getElementById('showSectors').addEventListener('change', (e) => {
        editor.showSectors = e.target.checked;
        renderCanvas();
    });

    // Add sector button
    document.getElementById('addSectorBtn').addEventListener('click', () => {
        // Switch to sector mode and prompt user to draw
        editor.editorMode = 'sector';
        document.getElementById('sectorMode').classList.add('active');
        document.getElementById('tileMode').classList.remove('active');
        alert('Click and drag on the canvas to create a sector');
    });

    // Sector property changes
    document.getElementById('sectorName').addEventListener('change', (e) => {
        if (editor.selectedSector) {
            editor.selectedSector.name = e.target.value;
            renderSectorsList();
            renderCanvas();
            saveToLocalStorage();
        }
    });

    document.getElementById('sectorColor').addEventListener('change', (e) => {
        if (editor.selectedSector) {
            editor.selectedSector.color = e.target.value;
            renderSectorsList();
            renderCanvas();
            saveToLocalStorage();
        }
    });

    document.getElementById('sectorOpacity').addEventListener('input', (e) => {
        if (editor.selectedSector) {
            editor.selectedSector.opacity = e.target.value / 100;
            document.getElementById('opacityValue').textContent = e.target.value + '%';
            renderCanvas();
            saveToLocalStorage();
        }
    });

    document.getElementById('sectorPvp').addEventListener('change', (e) => {
        if (editor.selectedSector) {
            editor.selectedSector.properties.pvpEnabled = e.target.checked;
            saveToLocalStorage();
        }
    });

    document.getElementById('sectorMusic').addEventListener('change', (e) => {
        if (editor.selectedSector) {
            editor.selectedSector.properties.music = e.target.value;
            saveToLocalStorage();
        }
    });

    // Add custom property
    document.getElementById('addPropertyBtn').addEventListener('click', () => {
        if (editor.selectedSector) {
            const key = prompt('Property key:');
            if (key) {
                const value = prompt('Property value:');
                editor.selectedSector.properties.customProperties[key] = value || '';
                renderCustomProperties(editor.selectedSector);
                saveToLocalStorage();
            }
        }
    });

    // Delete sector
    document.getElementById('deleteSectorBtn').addEventListener('click', () => {
        if (editor.selectedSector) {
            if (confirm(`Delete sector "${editor.selectedSector.name}"?`)) {
                deleteSector(editor.selectedSector);
            }
        }
    });
}

// Start the editor when page loads
window.addEventListener('load', init);
