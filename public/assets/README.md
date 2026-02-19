# Game Assets Structure

This folder contains game assets organized by game name.

## Folder Structure

```
public/assets/
├── games/
│   └── slots/
│       ├── neon-nights/
│       │   ├── atlases/         # Texture atlases (JSON + PNG)
│       │   ├── images/          # Static images (backgrounds, UI, symbols)
│       │   ├── spine/           # Spine animations
│       │   │   └── wild/
│       │   │       ├── wild.json
│       │   │       ├── wild.atlas
│       │   │       └── wild.png
│       │   ├── audios/          # Sound effects and music
│       │   ├── fonts/           # Web fonts
│       │   └── videos/          # Video files
│       │
│       └── egyptian-adventure/
│           └── [same structure]
│
└── shared/                      # Shared assets across all games
    ├── images/
    ├── fonts/
    └── audios/
```

## Asset Types

### Atlases
Texture atlas files for sprite sheets:
- `symbols.json` - Main symbol atlas
- `ui.json` - UI elements atlas

### Images
Static image files:
- `background.png` - Game background
- `logo.png` - Game logo
- `symbols/` - Individual symbol images (fallback if no atlas)

### Spine
Spine animation files (each animation in its own folder):
- `{name}.json` - Spine skeleton data
- `{name}.atlas` - Spine texture atlas
- `{name}.png` - Spine texture

### Audios
Sound files in MP3/OGG format:
- `spin.mp3` - Reel spin sound
- `win.mp3` - Win sound
- `bigwin.mp3` - Big win celebration
- `music.mp3` - Background music

### Fonts
Web font files:
- `main.woff2` - Primary game font
- `numbers.woff2` - Numbers/counters font

## Adding New Games

1. Create a new folder under `public/assets/games/slots/{game-name}/`
2. Add the required asset folders (atlases, images, spine, audios, fonts)
3. Create a manifest.json in `src/content/games/{game-name}/`
4. Reference assets using the `basePath` in manifest
