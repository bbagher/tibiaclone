# Tibia Clone - Map Editor

A comprehensive map editor for creating custom maps for your Tibia clone game.

## Features

### Sprite Management
- **30 sprites per page** with pagination (10,000+ sprites available)
- **Sprite naming system** - Name sprites for easy identification
- **Search functionality** - Find named sprites quickly
- **Sprite registry** - Automatically saves sprite names and properties
- **Walkable property** - Mark sprites as walkable or blocking

### Drawing Tools
- **Pencil (P)** - Draw single tiles
- **Fill Bucket (F)** - Flood fill areas
- **Eraser (E)** - Remove tiles
- **Eyedropper (I)** - Pick sprites from the canvas

### Canvas Features
- **Grid toggle** - Show/hide grid overlay
- **Zoom controls** - Zoom from 50% to 300%
- **Real-time mouse position** - See coordinates as you work
- **Visual feedback** - Checkerboard background shows empty tiles

### Map Management
- **Customizable dimensions** - 5x5 to 100x100 tiles
- **Adjustable tile size** - 16px to 64px
- **Layer support** - Multiple layers (ground layer by default)
- **Undo/Redo** - Full history support (Ctrl+Z / Ctrl+Y)
- **Auto-save** - Saves to localStorage automatically

### Export/Import
- **Export to JSON** - Save complete map configuration
- **Import from JSON** - Load previously saved maps
- **Export to PNG** - Save map as an image
- **Sprite registry included** - All sprite names saved in JSON

## How to Use

### 1. Opening the Editor
Simply open `map-editor.html` in your web browser.

### 2. Selecting and Naming Sprites

1. Browse sprites in the left palette (30 per page)
2. Click on a sprite to select it
3. If it's unnamed, a modal will appear asking you to name it
4. Enter a descriptive name (e.g., "grass", "water", "stone wall")
5. Set whether the sprite is walkable
6. Click "Save"

**Named sprites will have a green checkmark** and show their name on hover.

### 3. Drawing on the Canvas

1. Select a sprite from the palette
2. Choose a tool:
   - **Pencil (P)**: Click and drag to paint individual tiles
   - **Fill (F)**: Click to fill connected areas
   - **Eraser (E)**: Click and drag to remove tiles
   - **Eyedropper (I)**: Click a tile to select that sprite

3. Click or drag on the canvas to draw

### 4. Keyboard Shortcuts

- `P` - Pencil tool
- `F` - Fill bucket tool
- `E` - Eraser tool
- `I` - Eyedropper tool
- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo

### 5. Map Settings

**Adjust in the right panel:**
- Map Width (default: 20)
- Map Height (default: 15)
- Tile Size (default: 32px)

Click "Apply Settings" to resize the map.

### 6. Exporting Your Map

Click **"Export JSON"** to save your map. This creates a JSON file containing:
- Map dimensions
- All tile placements
- Sprite registry (names and properties)
- Layer information

**JSON Structure:**
```json
{
  "version": "1.0",
  "mapWidth": 20,
  "mapHeight": 15,
  "tileSize": 32,
  "layers": [
    {
      "name": "Ground Layer",
      "visible": true,
      "tiles": [
        [
          { "spriteId": 1, "spriteName": "grass" },
          { "spriteId": 2, "spriteName": "water" }
        ]
      ]
    }
  ],
  "spriteRegistry": {
    "1": {
      "id": 1,
      "file": "sprite_00001.png",
      "name": "grass",
      "walkable": true
    },
    "2": {
      "id": 2,
      "file": "sprite_00002.png",
      "name": "water",
      "walkable": false
    }
  }
}
```

### 7. Importing a Map

1. Click **"Import JSON"**
2. Select a previously exported JSON file
3. The map will load with all sprites and settings

### 8. Using Your Map in the Game

To use your exported map in the game, you'll need to:

1. Export your map to JSON
2. Load the JSON in your game code
3. Parse the tiles and sprite registry
4. Render the map using the sprite IDs

**Example integration code:**
```javascript
// Load map JSON
async function loadMap(mapFile) {
    const response = await fetch(mapFile);
    const mapData = await response.json();

    game.mapWidth = mapData.mapWidth;
    game.mapHeight = mapData.mapHeight;
    game.tileSize = mapData.tileSize;

    // Load sprite registry
    game.spriteRegistry = mapData.spriteRegistry;

    // Load tiles
    const layer = mapData.layers[0]; // Ground layer
    game.map = [];

    for (let y = 0; y < mapData.mapHeight; y++) {
        const row = [];
        for (let x = 0; x < mapData.mapWidth; x++) {
            const tile = layer.tiles[y][x];
            if (tile) {
                const spriteData = mapData.spriteRegistry[tile.spriteId];
                row.push({
                    sprite: new Image(),
                    walkable: spriteData.walkable,
                    name: spriteData.name
                });
                row[x].sprite.src = `sprites_output/${spriteData.file}`;
            } else {
                row.push(null);
            }
        }
        game.map.push(row);
    }
}

// Draw map
function drawMap() {
    for (let y = 0; y < game.mapHeight; y++) {
        for (let x = 0; x < game.mapWidth; x++) {
            const tile = game.map[y][x];
            if (tile && tile.sprite) {
                ctx.drawImage(
                    tile.sprite,
                    x * game.tileSize,
                    y * game.tileSize,
                    game.tileSize,
                    game.tileSize
                );
            }
        }
    }
}
```

## Tips and Tricks

### Organizing Sprites
- Name sprites with consistent conventions (e.g., "grass_1", "grass_2")
- Use the search feature to filter by category
- Mark blocking tiles as non-walkable (walls, water, etc.)

### Efficient Workflow
1. Fill the entire map with a base terrain (grass, dirt)
2. Use the pencil to add details
3. Use fill bucket for large uniform areas
4. Use eyedropper to quickly switch between sprites
5. Save frequently by exporting JSON

### Performance
- The editor handles 10,000+ sprites efficiently
- Only 30 sprites load per page for performance
- Auto-save uses localStorage (limited to ~5-10MB)
- For large maps, export JSON regularly

### Search Feature
- Only works with **named sprites**
- Type part of the sprite name to filter
- Resets to page 1 when searching
- Clear search to see all sprites again

## Statistics Panel

The right sidebar shows:
- **Total Sprites**: All available sprites (10,926)
- **Named Sprites**: How many sprites you've named
- **Unique Sprites Used**: Different sprites in your map

## Auto-Save

The editor automatically saves to localStorage:
- Sprite registry (names and properties)
- Current map state
- Map dimensions and settings

**On reload**, it will ask if you want to restore your work.

## Troubleshooting

### Sprites not loading
- Check that `sprites_output/` folder exists
- Ensure sprite files are named correctly (`sprite_00001.png`, etc.)
- Check browser console for errors

### Can't select a sprite
- Make sure you click directly on the sprite
- If modal appears, you must name it first or cancel

### Undo not working
- History starts after first change
- Maximum 50 undo steps
- Clears on map resize

### Export failed
- Check browser's download settings
- Try a different browser
- Check console for errors

## Browser Compatibility

Works best in modern browsers:
- Chrome/Edge (Recommended)
- Firefox
- Safari

Requires:
- Canvas API support
- localStorage support
- ES6 JavaScript

## Future Enhancements

Potential additions:
- Multiple layer support with layer management
- Copy/paste functionality
- Selection tool for moving groups of tiles
- Tile rotation and flipping
- Animation preview for animated sprites
- Minimap preview
- Collaborative editing

---

**Enjoy creating amazing maps for your Tibia clone!**
