#!/usr/bin/env python3
"""
Tibia 7.7 .spr (Sprite) File Parser and PNG Extractor

Extracts sprites from Tibia .spr files to PNG images.

Tibia 7.7 .spr format:
- Header (6 bytes):
  - 4 bytes: version signature
  - 2 bytes: sprite count (little-endian)
- Sprite data (variable):
  - 3 bytes: compressed data size (little-endian, 24-bit)
  - N bytes: RLE-compressed pixel data

Sprites are 32x32 pixels, using indexed color (palette-based).
"""

import struct
import sys
import os
from pathlib import Path
from typing import List, Optional, Tuple
from PIL import Image


class TibiaSprParser:
    """
    Parser for Tibia 7.7 .spr sprite files.

    Features:
    - Extract individual sprites to PNG
    - Batch export all sprites
    - RLE decompression
    - Tibia 7.7 color palette
    """

    SPRITE_SIZE = 32  # 32x32 pixels
    HEADER_SIZE = 6   # 4 bytes version + 2 bytes count
    SPRITE_DATA_SIZE = 1024  # 32x32 = 1024 bytes per sprite

    # Tibia 7.7 default color palette (216-color palette + grayscale)
    # This is a reconstructed palette based on Tibia 7.7
    TIBIA_PALETTE = None  # Will be generated in __init__

    def __init__(self, spr_file_path: str):
        self.spr_file_path = spr_file_path
        self.version = 0
        self.sprite_count = 0
        self.data = None
        self.sprite_addresses = []  # Sprite addresses from address table

        # Generate Tibia palette
        if TibiaSprParser.TIBIA_PALETTE is None:
            TibiaSprParser.TIBIA_PALETTE = self._generate_tibia_palette()

    def _generate_tibia_palette(self) -> List[Tuple[int, int, int]]:
        """
        Generate Tibia 7.7 color palette.

        Tibia uses a 216-color web-safe palette + grayscale.
        Index 0 is transparent (magenta in editing).
        """
        palette = [(255, 0, 255)]  # Index 0 = transparent (magenta for visibility)

        # 216-color web-safe palette (6x6x6 RGB cube)
        for r in range(0, 256, 51):  # 0, 51, 102, 153, 204, 255
            for g in range(0, 256, 51):
                for b in range(0, 256, 51):
                    palette.append((r, g, b))

        # Grayscale ramp
        for i in range(24):
            gray = int(i * 255 / 23)
            palette.append((gray, gray, gray))

        # Pad to 256 colors
        while len(palette) < 256:
            palette.append((0, 0, 0))

        return palette[:256]

    def load(self) -> dict:
        """
        Load and parse .spr file header and address table.

        Tibia .spr format:
        - 4 bytes: version/signature
        - 2 bytes: sprite count (N)
        - N * 4 bytes: address table (file offsets for each sprite)
        - Sprite data (1024 bytes each, 32x32 pixels)

        Returns:
            dict with version and sprite_count
        """
        with open(self.spr_file_path, 'rb') as f:
            self.data = f.read()

        # Parse header
        self.version = struct.unpack('<I', self.data[0:4])[0]
        self.sprite_count = struct.unpack('<H', self.data[4:6])[0]

        print(f"SPR Version: 0x{self.version:08X}")
        print(f"Sprite Count: {self.sprite_count}")

        # Read address table
        self._load_address_table()

        return {
            'version': self.version,
            'sprite_count': self.sprite_count
        }

    def _load_address_table(self):
        """Load sprite address table from file."""
        # Address table starts at offset 6 (after header)
        # Each entry is 4 bytes (uint32)
        offset = self.HEADER_SIZE

        self.sprite_addresses = [0]  # Index 0 unused (sprites are 1-based)

        for i in range(self.sprite_count):
            addr = struct.unpack('<I', self.data[offset:offset+4])[0]
            self.sprite_addresses.append(addr)
            offset += 4

        print(f"Loaded {self.sprite_count} sprite addresses")
        print(f"Address table: 6 + {self.sprite_count * 4} = {offset} bytes")
        if len(self.sprite_addresses) > 1:
            print(f"First sprite at: 0x{self.sprite_addresses[1]:08X}")

    def get_sprite_data(self, sprite_id: int) -> Optional[bytes]:
        """
        Get raw RLE-compressed sprite data.

        Args:
            sprite_id: Sprite ID (1-based)

        Returns:
            RLE-compressed pixel data or None if invalid
        """
        if sprite_id < 1 or sprite_id > self.sprite_count:
            return None

        addr_start = self.sprite_addresses[sprite_id]
        if addr_start == 0:
            return None

        # Calculate size using next sprite's address
        if sprite_id < self.sprite_count:
            addr_end = self.sprite_addresses[sprite_id + 1]
        else:
            addr_end = len(self.data)

        # Handle address 0 (empty sprite)
        if addr_end == 0:
            addr_end = len(self.data)

        size = addr_end - addr_start

        if size <= 0 or addr_start + size > len(self.data):
            return None

        compressed_data = self.data[addr_start:addr_start+size]

        return compressed_data

    def decode_sprite(self, sprite_data: bytes) -> List[Tuple[int, int, int, int]]:
        """
        Decompress Tibia 7.7 sprite data to RGBA pixels.

        Format (from OTLand forum):
        - First 3 bytes: skip (color key)
        - Next 2 bytes: sprite size (should be 512 for 32x32, but we ignore it)
        - Then repeating pattern:
          - 2 bytes: transparent pixel count (little-endian)
          - 2 bytes: colored pixel count (little-endian)
          - 3 bytes per colored pixel: RGB values

        Pixels are read left-to-right, top-to-bottom (row-major order).

        Args:
            sprite_data: Raw sprite data from .spr file

        Returns:
            List of RGBA tuples (1024 pixels for 32x32)
        """
        pixels = []
        offset = 3  # Skip first 3 bytes (color key)

        # Skip sprite size (2 bytes) - we know it's 32x32
        if len(sprite_data) > 5:
            offset = 5

        # Read transparent/colored pixel runs
        while offset < len(sprite_data) and len(pixels) < self.SPRITE_DATA_SIZE:
            # Read transparent pixel count (2 bytes, little-endian)
            if offset + 2 > len(sprite_data):
                break
            transparent_count = struct.unpack('<H', sprite_data[offset:offset+2])[0]
            offset += 2

            # Add transparent pixels
            for _ in range(transparent_count):
                if len(pixels) < self.SPRITE_DATA_SIZE:
                    pixels.append((0, 0, 0, 0))  # Transparent

            # Read colored pixel count (2 bytes, little-endian)
            if offset + 2 > len(sprite_data):
                break
            colored_count = struct.unpack('<H', sprite_data[offset:offset+2])[0]
            offset += 2

            # Read RGB values for colored pixels
            for _ in range(colored_count):
                if offset + 3 > len(sprite_data):
                    break
                if len(pixels) < self.SPRITE_DATA_SIZE:
                    r = sprite_data[offset]
                    g = sprite_data[offset + 1]
                    b = sprite_data[offset + 2]
                    pixels.append((r, g, b, 255))  # Opaque
                    offset += 3

        # Pad to 1024 pixels if needed
        while len(pixels) < self.SPRITE_DATA_SIZE:
            pixels.append((0, 0, 0, 0))

        return pixels[:self.SPRITE_DATA_SIZE]

    def _replace_outfit_colors(self, pixels: List[Tuple[int, int, int, int]],
                               head_color: Tuple[int, int, int] = (117, 94, 71),
                               body_color: Tuple[int, int, int] = (145, 100, 72),
                               legs_color: Tuple[int, int, int] = (72, 72, 72),
                               feet_color: Tuple[int, int, int] = (76, 76, 76)) -> List[Tuple[int, int, int, int]]:
        """
        Replace Tibia outfit template colors with actual colors.

        Tibia outfit sprites use template colors that get replaced:
        - Yellow (255,255,0) = Head/hair
        - Red (255,0,0) = Body/torso
        - Green (0,255,0) = Legs
        - Blue (0,0,255) = Feet

        Args:
            pixels: List of RGBA tuples
            head_color: RGB for head (default: brown)
            body_color: RGB for body (default: tan)
            legs_color: RGB for legs (default: dark gray)
            feet_color: RGB for feet (default: gray)

        Returns:
            Modified pixel list with replaced colors
        """
        result = []
        for r, g, b, a in pixels:
            if a == 0:  # Transparent
                result.append((r, g, b, a))
            elif (r, g, b) == (255, 255, 0):  # Yellow = Head
                result.append((*head_color, a))
            elif (r, g, b) == (255, 0, 0):  # Red = Body
                result.append((*body_color, a))
            elif (r, g, b) == (0, 255, 0):  # Green = Legs
                result.append((*legs_color, a))
            elif (r, g, b) == (0, 0, 255):  # Blue = Feet
                result.append((*feet_color, a))
            else:  # Keep original color
                result.append((r, g, b, a))
        return result

    def render_sprite(self, sprite_id: int, transparent: bool = True,
                     replace_outfit_colors: bool = False) -> Optional[Image.Image]:
        """
        Render sprite to PIL Image.

        Args:
            sprite_id: Sprite ID (1-based)
            transparent: Use transparency for special indices (default: True)
            replace_outfit_colors: Replace outfit template colors with defaults (default: False)

        Returns:
            PIL Image (RGBA) or None if invalid
        """
        sprite_data = self.get_sprite_data(sprite_id)
        if sprite_data is None:
            return None

        # Decode sprite to RGBA pixels (already in row-major order)
        pixels = self.decode_sprite(sprite_data)

        # Optionally replace outfit template colors
        if replace_outfit_colors:
            pixels = self._replace_outfit_colors(pixels)

        # Create RGBA image
        img = Image.new('RGBA', (self.SPRITE_SIZE, self.SPRITE_SIZE))
        img.putdata(pixels)
        return img

    def export_sprite(self, sprite_id: int, output_path: str, transparent: bool = True) -> bool:
        """
        Export single sprite to PNG.

        Args:
            sprite_id: Sprite ID (1-based)
            output_path: Output PNG path
            transparent: Use transparency (default: True)

        Returns:
            True if successful
        """
        img = self.render_sprite(sprite_id, transparent)
        if img is None:
            return False

        img.save(output_path, 'PNG')
        return True

    def export_all(self, output_dir: str, sprite_ids: Optional[List[int]] = None,
                   transparent: bool = True):
        """
        Export multiple sprites to PNG files.

        Args:
            output_dir: Output directory
            sprite_ids: List of sprite IDs to export (None = all)
            transparent: Use transparency (default: True)
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        if sprite_ids is None:
            sprite_ids = range(1, self.sprite_count + 1)

        print(f"Exporting {len(sprite_ids)} sprites to {output_dir}/")

        success_count = 0
        fail_count = 0

        for i, sprite_id in enumerate(sprite_ids, 1):
            if i % 100 == 0:
                print(f"  [{i}/{len(sprite_ids)}] Exported {success_count} sprites...")

            output_path = output_dir / f"sprite_{sprite_id:05d}.png"

            if self.export_sprite(sprite_id, str(output_path), transparent):
                success_count += 1
            else:
                fail_count += 1

        print(f"\n✓ Exported {success_count}/{len(sprite_ids)} sprites")
        if fail_count > 0:
            print(f"✗ Failed: {fail_count}")

        return success_count

    def create_sprite_sheet(self, output_path: str, sprites_per_row: int = 32,
                           max_sprites: Optional[int] = None) -> str:
        """
        Create sprite sheet image (all sprites in a grid).

        Args:
            output_path: Output PNG path
            sprites_per_row: Sprites per row (default: 32)
            max_sprites: Maximum sprites to include (None = all)

        Returns:
            Output path
        """
        sprite_count = min(max_sprites or self.sprite_count, self.sprite_count)
        rows = (sprite_count + sprites_per_row - 1) // sprites_per_row

        sheet_width = sprites_per_row * self.SPRITE_SIZE
        sheet_height = rows * self.SPRITE_SIZE

        print(f"Creating sprite sheet: {sheet_width}x{sheet_height} ({sprite_count} sprites)")

        sheet = Image.new('RGBA', (sheet_width, sheet_height), (0, 0, 0, 0))

        for sprite_id in range(1, sprite_count + 1):
            if sprite_id % 100 == 0:
                print(f"  [{sprite_id}/{sprite_count}] Processing...")

            img = self.render_sprite(sprite_id, transparent=True)
            if img:
                row = (sprite_id - 1) // sprites_per_row
                col = (sprite_id - 1) % sprites_per_row
                x = col * self.SPRITE_SIZE
                y = row * self.SPRITE_SIZE
                sheet.paste(img, (x, y))

        sheet.save(output_path, 'PNG')
        print(f"✓ Sprite sheet saved: {output_path}")

        return output_path


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Extract Tibia .spr sprites to PNG')
    parser.add_argument('spr_file', help='Input .spr file')
    parser.add_argument('-o', '--output', required=True, help='Output directory or file')
    parser.add_argument('-s', '--sprite', type=int, help='Extract single sprite ID')
    parser.add_argument('--sheet', action='store_true', help='Create sprite sheet')
    parser.add_argument('--max', type=int, help='Maximum sprites to export')
    parser.add_argument('--no-transparent', action='store_true',
                       help='Disable transparency')

    args = parser.parse_args()

    # Load sprite file
    spr_parser = TibiaSprParser(args.spr_file)
    spr_parser.load()

    transparent = not args.no_transparent

    if args.sprite:
        # Export single sprite
        output_path = args.output
        if os.path.isdir(output_path):
            output_path = os.path.join(output_path, f'sprite_{args.sprite:05d}.png')

        print(f"Exporting sprite {args.sprite} to {output_path}")
        if spr_parser.export_sprite(args.sprite, output_path, transparent):
            print("✓ Success")
            return 0
        else:
            print("✗ Failed")
            return 1

    elif args.sheet:
        # Create sprite sheet
        spr_parser.create_sprite_sheet(args.output, max_sprites=args.max)
        return 0

    else:
        # Export all sprites
        sprite_ids = None
        if args.max:
            sprite_ids = range(1, min(args.max + 1, spr_parser.sprite_count + 1))

        spr_parser.export_all(args.output, sprite_ids, transparent)
        return 0


if __name__ == '__main__':
    sys.exit(main())
