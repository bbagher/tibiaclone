# Map Editor - Sectors Guide

## What are Sectors?

Sectors are named regions on your map that define different areas with unique properties. Think of them as zones like "Town Square", "Dark Forest", "Goblin Cave", etc. Each sector can have its own configuration for gameplay mechanics.

## Key Features

### Sector Properties
- **Name** - Descriptive name for the area
- **Color & Opacity** - Visual representation on the map
- **Boundaries** - Rectangular area defining the sector
- **PVP Enabled** - Toggle player-vs-player combat
- **Music** - Background music file for the area
- **Custom Properties** - Add any key-value pairs you need

## How to Use Sectors

### Creating a Sector

**Method 1: Draw on Canvas**
1. Click "Sector Mode" button in the toolbar
2. Click and drag on the canvas to draw a rectangular area
3. Release to create the sector
4. The sector appears in the Sectors list with properties panel

**Method 2: Add Sector Button**
1. Click "+ Add Sector" in the right panel
2. You'll be switched to Sector Mode
3. Draw the sector on the canvas

### Editing Sector Properties

1. Click on a sector in the Sectors list (right panel)
2. The Sector Properties panel appears
3. Modify any property:
   - **Name** - Type a new name
   - **Color** - Click color picker to choose
   - **Opacity** - Slide to adjust transparency (0-100%)
   - **PVP Enabled** - Check/uncheck
   - **Music** - Enter filename (e.g., "forest_theme.mp3")

### Custom Properties

Add any custom data you need for your game:

1. Select a sector
2. Click "+ Add Property" in Sector Properties
3. Enter a key (e.g., "spawnRate", "monsterType")
4. Enter a value (e.g., "30", "goblin")
5. Properties are saved automatically

**Example Custom Properties:**
- `spawnRate: 30` - Monsters spawn every 30 seconds
- `monsterType: goblin` - Type of monster in this area
- `difficulty: hard` - Difficulty level
- `questZone: true` - Part of a quest
- `lightLevel: 0.5` - Ambient lighting

### Viewing Sectors

**Toggle Visibility:**
- Check/uncheck "Show Sectors" in the toolbar
- Sectors appear as semi-transparent colored overlays

**Sector Indicators:**
- Colored rectangles on the canvas
- Sector name displayed at top-left
- Selected sector has gold border
- Hover over canvas to see current sector name

### Deleting Sectors

1. Select the sector from the list
2. Click "Delete Sector" button
3. Confirm deletion

## Working with Modes

### Tile Mode (Default)
- Draw tiles with sprites
- Use pencil, fill, eraser tools
- Normal map editing

### Sector Mode
- Draw and select sectors
- Click existing sector to select
- Drag to create new sectors
- View sector boundaries and names

**Switch modes anytime** using the mode toggle buttons!

## Sector Visualization

Sectors are rendered with:
- **Semi-transparent fill** - See tiles underneath
- **Colored border** - Matches sector color
- **Name label** - Top-left corner of sector
- **Gold highlight** - When selected
- **Mouse hover info** - Shows current sector at bottom

## JSON Export Format

Sectors are exported with your map:

```json
{
  "sectors": [
    {
      "id": 1,
      "name": "Town Square",
      "color": "#3498db",
      "opacity": 0.3,
      "boundaries": {
        "type": "rect",
        "x": 5,
        "y": 5,
        "width": 10,
        "height": 8
      },
      "properties": {
        "music": "town_theme.mp3",
        "pvpEnabled": false,
        "customProperties": {
          "safeZone": "true",
          "spawnPoint": "main"
        }
      }
    }
  ]
}
```

## Using Sectors in Your Game

### Load Sectors from JSON

```javascript
async function loadMapWithSectors(mapFile) {
    const response = await fetch(mapFile);
    const mapData = await response.json();

    // Load sectors
    game.sectors = mapData.sectors || [];

    // Example: Find sector at player position
    function getSectorAtPosition(x, y) {
        return game.sectors.find(sector => {
            const b = sector.boundaries;
            return x >= b.x && x < b.x + b.width &&
                   y >= b.y && y < b.y + b.height;
        });
    }

    // Example: Check if player is in PVP zone
    function isInPvpZone(playerX, playerY) {
        const sector = getSectorAtPosition(playerX, playerY);
        return sector && sector.properties.pvpEnabled;
    }

    // Example: Change music based on sector
    function updateMusic(playerX, playerY) {
        const sector = getSectorAtPosition(playerX, playerY);
        if (sector && sector.properties.music) {
            playMusic(sector.properties.music);
        }
    }

    // Example: Get custom property
    function getSectorProperty(x, y, propertyKey) {
        const sector = getSectorAtPosition(x, y);
        if (sector) {
            return sector.properties.customProperties[propertyKey];
        }
        return null;
    }
}
```

### Render Sectors in Game (Debug Mode)

```javascript
function renderSectorsDebug() {
    game.sectors.forEach(sector => {
        const b = sector.boundaries;
        const x = b.x * tileSize;
        const y = b.y * tileSize;
        const width = b.width * tileSize;
        const height = b.height * tileSize;

        // Draw border
        ctx.strokeStyle = sector.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        // Draw label
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(sector.name, x + 5, y + 15);
    });
}
```

## Common Use Cases

### 1. Safe Zones vs Combat Zones
```json
{
  "name": "Town",
  "properties": {
    "pvpEnabled": false,
    "customProperties": {
      "safeZone": "true",
      "healing": "enabled"
    }
  }
}

{
  "name": "Wilderness",
  "properties": {
    "pvpEnabled": true,
    "customProperties": {
      "dangerLevel": "high",
      "lootBonus": "1.5x"
    }
  }
}
```

### 2. Dungeon Levels
```json
{
  "name": "Dungeon Level 1",
  "properties": {
    "music": "dungeon_ambient.mp3",
    "customProperties": {
      "requiredLevel": "5",
      "monsterType": "skeleton",
      "lightLevel": "0.3"
    }
  }
}
```

### 3. Quest Zones
```json
{
  "name": "Quest Area - Dragon's Lair",
  "properties": {
    "customProperties": {
      "questId": "dragon_slayer",
      "bossSpawn": "true",
      "rewardMultiplier": "2"
    }
  }
}
```

### 4. Spawn Points
```json
{
  "name": "Player Spawn",
  "properties": {
    "customProperties": {
      "spawnType": "player",
      "respawnTime": "0",
      "team": "blue"
    }
  }
}
```

## Tips & Best Practices

### Organization
- Use descriptive names ("Town Square" not "Sector 1")
- Color-code by type (blue for towns, red for danger zones)
- Keep sectors non-overlapping when possible
- Document custom properties in your game design doc

### Performance
- Sectors don't affect rendering performance
- Checking sector position is O(n) - cache if needed
- Consider spatial indexing for large maps with many sectors

### Workflow
1. Design your map layout first with tiles
2. Add sectors to define gameplay areas
3. Test sector boundaries in-game
4. Adjust properties based on playtesting
5. Export final JSON configuration

### Naming Conventions
- Use snake_case or camelCase for custom properties
- Prefix properties by category: `spawn_`, `quest_`, `pvp_`
- Keep property names consistent across sectors

## Keyboard Shortcuts

- **Tile Mode** - Switch to tile editing
- **Sector Mode** - Switch to sector editing
- Click sectors to select them
- Drag on canvas to create new sectors

## Troubleshooting

**Sector not visible?**
- Check "Show Sectors" is enabled
- Verify opacity is > 0%
- Sector might be behind another sector

**Can't select sector?**
- Make sure you're in Sector Mode
- Click within the sector boundaries
- Try clicking near the center

**Properties not saving?**
- Changes save automatically
- Check browser console for errors
- Try exporting JSON to verify

## Future Enhancements

Potential additions:
- Polygon-shaped sectors (not just rectangles)
- Sector templates library
- Sector copying and pasting
- Overlapping sector warnings
- Sector grouping and organization
- Per-sector tile restrictions
- Minimap with sector overlay

---

**Sectors make your map come alive with distinct areas and gameplay variety!**
