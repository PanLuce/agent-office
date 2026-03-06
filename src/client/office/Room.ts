import { Container, Graphics } from "pixi.js";

const WALL = 8;
const WAINSCOT = 12;
const DOOR_W = 32;

const CARPET_BASE = 0x5a5a72;
const CARPET_LIGHT = 0x626280;
const CARPET_DARK = 0x525268;
const WALL_OUTER = 0x3a3a5a;
const WALL_MAIN = 0xe8e0cc;
const WALL_INNER = 0xf0ead8;
const WAINSCOT_COLOR = 0xd4c8a0;
const DOOR_MAT = 0x6a5a4a;

const BOOK_COLORS = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class Room extends Container {
  private readonly rw: number;
  private readonly rh: number;

  constructor(roomWidth: number, roomHeight: number) {
    super();
    this.rw = roomWidth;
    this.rh = roomHeight;
    this.drawFloor();
    this.drawWalls();
    this.drawDoorMat();
    this.drawBackWallDecorations();
    this.drawCoffeeMachine();
  }

  private drawFloor(): void {
    const g = new Graphics();
    const ix = WALL;
    const iy = WALL;
    const iw = this.rw - WALL * 2;
    const ih = this.rh - WALL * 2;

    // Solid carpet base
    g.rect(ix, iy, iw, ih);
    g.fill(CARPET_BASE);

    // Subtle woven texture: fine 4px grid with alternating shades
    const rand = seededRandom(17);
    for (let y = 0; y < ih; y += 4) {
      for (let x = 0; x < iw; x += 4) {
        const shade = rand() < 0.5 ? CARPET_LIGHT : CARPET_DARK;
        g.rect(ix + x, iy + y, 4, 4);
        g.fill({ color: shade, alpha: 0.25 });
      }
    }

    // Border stripe along the edges (1px darker inset)
    const stripe = darken(CARPET_BASE, 0.12);
    g.rect(ix, iy, iw, 2);
    g.fill(stripe);
    g.rect(ix, iy + ih - 2, iw, 2);
    g.fill(stripe);
    g.rect(ix, iy, 2, ih);
    g.fill(stripe);
    g.rect(ix + iw - 2, iy, 2, ih);
    g.fill(stripe);

    this.addChild(g);
  }

  private drawWalls(): void {
    const g = new Graphics();
    const doorStart = (this.rw - DOOR_W) / 2;

    // Outer dark edge (full perimeter)
    g.rect(0, 0, this.rw, WALL);
    g.fill(WALL_OUTER);
    g.rect(0, this.rh - WALL, doorStart, WALL);
    g.fill(WALL_OUTER);
    g.rect(doorStart + DOOR_W, this.rh - WALL, this.rw - doorStart - DOOR_W, WALL);
    g.fill(WALL_OUTER);
    g.rect(0, 0, WALL, this.rh);
    g.fill(WALL_OUTER);
    g.rect(this.rw - WALL, 0, WALL, this.rh);
    g.fill(WALL_OUTER);

    // Main wall surface (inset 1px)
    g.rect(1, 1, this.rw - 2, WALL - 2);
    g.fill(WALL_MAIN);
    g.rect(1, this.rh - WALL + 1, doorStart - 1, WALL - 2);
    g.fill(WALL_MAIN);
    g.rect(doorStart + DOOR_W, this.rh - WALL + 1, this.rw - doorStart - DOOR_W - 1, WALL - 2);
    g.fill(WALL_MAIN);
    g.rect(1, 1, WALL - 2, this.rh - 2);
    g.fill(WALL_MAIN);
    g.rect(this.rw - WALL + 1, 1, WALL - 2, this.rh - 2);
    g.fill(WALL_MAIN);

    // Inner light edge (1px strip along interior side)
    g.rect(WALL, WALL, this.rw - WALL * 2, 1);
    g.fill(WALL_INNER);
    g.rect(WALL, WALL, 1, this.rh - WALL * 2);
    g.fill(WALL_INNER);
    g.rect(this.rw - WALL - 1, WALL, 1, this.rh - WALL * 2);
    g.fill(WALL_INNER);
    g.rect(WALL, this.rh - WALL - 1, doorStart - WALL, 1);
    g.fill(WALL_INNER);
    g.rect(doorStart + DOOR_W, this.rh - WALL - 1, this.rw - doorStart - DOOR_W - WALL, 1);
    g.fill(WALL_INNER);

    // Wainscoting along top wall interior
    g.rect(WALL, WALL + 1, this.rw - WALL * 2, WAINSCOT);
    g.fill(WAINSCOT_COLOR);

    // Wainscoting along left wall
    g.rect(WALL + 1, WALL + WAINSCOT, WAINSCOT, this.rh - WALL * 2 - WAINSCOT);
    g.fill(WAINSCOT_COLOR);

    // Wainscoting along right wall
    g.rect(this.rw - WALL - WAINSCOT - 1, WALL + WAINSCOT, WAINSCOT, this.rh - WALL * 2 - WAINSCOT);
    g.fill(WAINSCOT_COLOR);

    this.addChild(g);
  }

  private drawDoorMat(): void {
    const g = new Graphics();
    const mx = (this.rw - DOOR_W) / 2 + 4;
    const my = this.rh - WALL - 6;
    g.rect(mx, my, DOOR_W - 8, 5);
    g.fill(DOOR_MAT);
    this.addChild(g);
  }

  private drawBackWallDecorations(): void {
    const wallY = WALL + 1;
    this.drawBookshelf(WALL + 6, wallY + 2);
    this.drawPortrait(WALL + 50, wallY + 1);
    this.drawSmallPicture(WALL + 82, wallY + 4);
    this.drawWhiteboard((this.rw - 48) / 2, wallY + 1);
    this.drawWindow(this.rw - WALL - 70, wallY + 2);
  }

  private drawBookshelf(x: number, y: number): void {
    const g = new Graphics();
    const rand = seededRandom(42);

    // Frame
    g.rect(x, y, 24, 32);
    g.fill(0x5a3a1a);

    // Shelves (3 rows)
    for (let row = 0; row < 3; row++) {
      const sy = y + 2 + row * 10;
      // Shelf background
      g.rect(x + 2, sy, 20, 9);
      g.fill(0x4a2a10);

      // Books
      for (let bx = 0; bx < 18; bx += 3 + Math.floor(rand() * 2)) {
        const color = BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)];
        const bh = 6 + Math.floor(rand() * 2);
        g.rect(x + 3 + bx, sy + (9 - bh), 2, bh);
        g.fill(color);
      }
    }

    this.addChild(g);
  }

  private drawPortrait(x: number, y: number): void {
    const g = new Graphics();
    // Wooden frame
    g.rect(x, y, 20, 24);
    g.fill(0x7a5a2a);
    // Inner
    g.rect(x + 2, y + 2, 16, 20);
    g.fill(0xd4c8a0);
    // Face
    g.rect(x + 6, y + 6, 8, 10);
    g.fill(0xf0c8a0);
    // Eyes
    g.rect(x + 8, y + 9, 1, 1);
    g.fill(0x2a2a2a);
    g.rect(x + 11, y + 9, 1, 1);
    g.fill(0x2a2a2a);
    // Hair
    g.rect(x + 6, y + 4, 8, 3);
    g.fill(0x4a2a1a);

    this.addChild(g);
  }

  private drawSmallPicture(x: number, y: number): void {
    const g = new Graphics();
    g.rect(x, y, 12, 12);
    g.fill(0x7a5a2a);
    g.rect(x + 1, y + 1, 10, 10);
    g.fill(0xa8d8ea);
    g.rect(x + 2, y + 6, 4, 4);
    g.fill(0x27ae60);
    g.rect(x + 6, y + 3, 4, 3);
    g.fill(0xf39c12);
    this.addChild(g);
  }

  private drawWhiteboard(x: number, y: number): void {
    const g = new Graphics();
    // Frame
    g.rect(x, y, 48, 32);
    g.fill(0x8a8a8a);
    // Surface
    g.rect(x + 1, y + 1, 46, 28);
    g.fill(0xf0f0f0);
    // Writing scribbles
    g.rect(x + 4, y + 4, 12, 1);
    g.fill(0xe74c3c);
    g.rect(x + 4, y + 8, 18, 1);
    g.fill(0x2980b9);
    g.rect(x + 4, y + 12, 10, 1);
    g.fill(0x27ae60);
    g.rect(x + 20, y + 4, 8, 1);
    g.fill(0x2a2a2a);
    g.rect(x + 20, y + 8, 14, 1);
    g.fill(0x2a2a2a);
    g.rect(x + 4, y + 16, 16, 1);
    g.fill(0x2980b9);
    // Marker tray
    g.rect(x + 2, y + 29, 44, 2);
    g.fill(0x9a9a9a);
    // Markers
    g.rect(x + 6, y + 29, 3, 1);
    g.fill(0xe74c3c);
    g.rect(x + 12, y + 29, 3, 1);
    g.fill(0x2980b9);
    g.rect(x + 18, y + 29, 3, 1);
    g.fill(0x27ae60);
    g.rect(x + 24, y + 29, 3, 1);
    g.fill(0x2a2a2a);

    this.addChild(g);
  }

  private drawWindow(x: number, y: number): void {
    const g = new Graphics();
    // Frame
    g.rect(x, y, 28, 24);
    g.fill(0x7a5a2a);
    // Sky
    g.rect(x + 4, y + 2, 20, 20);
    g.fill(0xa8d8ea);
    // Left curtain
    g.rect(x + 1, y + 1, 4, 22);
    g.fill(0xc0392b);
    // Right curtain
    g.rect(x + 23, y + 1, 4, 22);
    g.fill(0xc0392b);
    // Curtain rod
    g.rect(x, y, 28, 1);
    g.fill(0x5a3a1a);

    this.addChild(g);
  }

  private drawCoffeeMachine(): void {
    const g = new Graphics();
    const cx = this.rw - WALL - 36;
    const cy = WALL + WAINSCOT + 4;

    // Counter
    g.rect(cx, cy, 24, 8);
    g.fill(0x8a6a30);
    g.rect(cx, cy + 6, 24, 2);
    g.fill(0x6a4a20);

    // Machine body
    g.rect(cx + 4, cy - 24, 16, 24);
    g.fill(0x4a4a4a);
    // Lighter top
    g.rect(cx + 4, cy - 24, 16, 6);
    g.fill(0x5a5a5a);
    // Power light
    g.rect(cx + 10, cy - 6, 2, 2);
    g.fill(0xe74c3c);
    // Cup
    g.rect(cx + 8, cy - 10, 6, 4);
    g.fill(0x7a5a2a);
    g.rect(cx + 7, cy - 10, 8, 1);
    g.fill(0x8a6a3a);

    this.addChild(g);
  }
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (color & 0xff) * (1 - amount)) | 0;
  return (r << 16) | (g << 8) | b;
}
