import { crc32, deflateSync } from "node:zlib";

// Synthetic pictures for the vision tasks: block-letter text and simple shapes, drawn in code so the answer is known

const GLYPHS: Record<string, string> = {
  A: ".###.#...##...#######...##...##...#",
  B: "####.#...##...#####.#...##...#####.",
  C: ".###.#...##....#....#....#...#.###.",
  D: "####.#...##...##...##...##...#####.",
  E: "######....#....####.#....#....#####",
  F: "######....#....####.#....#....#....",
  G: ".###.#...##....#.####...##...#.####",
  H: "#...##...##...#######...##...##...#",
  I: ".###...#....#....#....#....#...###.",
  J: "..###...#....#....#....##..#..##...",
  K: "#...##..#.#.#..##...#.#..#..#.#...#",
  L: "#....#....#....#....#....#....#####",
  M: "#...###.###.#.##.#.##...##...##...#",
  N: "#...###..##.#.##..###...##...##...#",
  O: ".###.#...##...##...##...##...#.###.",
  P: "####.#...##...#####.#....#....#....",
  Q: ".###.#...##...##...##.#.##..#..##.#",
  R: "####.#...##...#####.#.#..#..#.#...#",
  S: ".#####....#.....###.....#....#####.",
  T: "#####..#....#....#....#....#....#..",
  U: "#...##...##...##...##...##...#.###.",
  V: "#...##...##...##...##...#.#.#...#..",
  W: "#...##...##...##.#.##.#.##.#.#.#.#.",
  X: "#...##...#.#.#...#...#.#.#...##...#",
  Y: "#...##...#.#.#...#....#....#....#..",
  Z: "#####....#...#...#...#...#....#####",
  "0": ".###.#...##..###.#.###..##...#.###.",
  "1": "..#...##....#....#....#....#...###.",
  "2": ".###.#...#....#...#...#...#...#####",
  "3": "####.....#....#.###.....#....#####.",
  "4": "...#...##..#.#.#..#.#####...#....#.",
  "5": "######....####.....#....##...#.###.",
  "6": ".###.#....#....####.#...##...#.###.",
  "7": "#####....#...#...#...#....#....#...",
  "8": ".###.#...##...#.###.#...##...#.###.",
  "9": ".###.#...##...#.####....#....#.###.",
  " ": ".".repeat(35),
  ".": "..........................##...##..",
  ",": "....................##....#...#....",
  ":": ".....##...##.........##...##.......",
  "-": "...............#####...............",
  $: "..#...#####.#...###...#.#####...#..",
  "&": ".##..#..#.#.#...#...#.#.##..#..##.#",
  "/": "....#...#....#...#...#....#...#....",
  _: "..............................#####",
  "#": ".#.#..#.#.#####.#.#.#####.#.#..#.#.",
  "'": "..#....#..........................",
  "(": "...#...#...#....#....#.....#.....#.",
  ")": ".#.....#.....#....#....#...#...#...",
};

export type Rgb = [number, number, number];

export function hex(color: string): Rgb {
  const value = Number.parseInt(color.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export class Canvas {
  readonly pixels: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    background: Rgb,
  ) {
    this.pixels = new Uint8Array(width * height * 3);
    this.fillRect(0, 0, width, height, background);
  }

  fillRect(x: number, y: number, w: number, h: number, color: Rgb): void {
    const left = Math.max(0, Math.round(x));
    const top = Math.max(0, Math.round(y));
    const right = Math.min(this.width, Math.round(x + w));
    const bottom = Math.min(this.height, Math.round(y + h));
    for (let row = top; row < bottom; row++) {
      for (let col = left; col < right; col++) this.pixels.set(color, (row * this.width + col) * 3);
    }
  }

  // Block letters, 5×7 cells scaled up; unknown characters are left blank
  text(text: string, x: number, y: number, scale: number, color: Rgb): void {
    [...text.toUpperCase()].forEach((char, index) => {
      const glyph = GLYPHS[char] ?? GLYPHS[" "];
      for (let cell = 0; cell < 35; cell++) {
        if (glyph[cell] === "#") this.fillRect(x + (index * 6 + (cell % 5)) * scale, y + Math.floor(cell / 5) * scale, scale, scale, color);
      }
    });
  }

  centeredText(text: string, centerY: number, maxWidth: number, color: Rgb, maxScale = 14): void {
    const scale = Math.max(1, Math.min(maxScale, Math.floor(maxWidth / (text.length * 6))));
    const width = text.length * 6 * scale - scale;
    this.text(text, (this.width - width) / 2, centerY - (7 * scale) / 2, scale, color);
  }

  png(): Uint8Array {
    const rowBytes = this.width * 3;
    const raw = Buffer.alloc((rowBytes + 1) * this.height);
    for (let row = 0; row < this.height; row++) {
      raw[row * (rowBytes + 1)] = 0;
      raw.set(this.pixels.subarray(row * rowBytes, (row + 1) * rowBytes), row * (rowBytes + 1) + 1);
    }
    const chunk = (type: string, data: Buffer) => {
      const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(body));
      return Buffer.concat([length, body, crc]);
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width, 0);
    header.writeUInt32BE(this.height, 4);
    header.set([8, 2, 0, 0, 0], 8);
    return new Uint8Array(
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", header),
        chunk("IDAT", deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0)),
      ]),
    );
  }
}

export interface Picture {
  mimeType: "image/png";
  data: Uint8Array;
  width: number;
  height: number;
}

const picture = (canvas: Canvas): Picture => ({ mimeType: "image/png", data: canvas.png(), width: canvas.width, height: canvas.height });

// A wordmark: the given words in one color on white, with an optional square symbol above
export function logoImage(words: string, color: string, symbol = true): Picture {
  const canvas = new Canvas(1024, 640, [255, 255, 255]);
  if (symbol) canvas.fillRect(452, 90, 120, 120, hex(color));
  canvas.centeredText(words, symbol ? 400 : 320, 900, hex(color));
  return picture(canvas);
}

// A jar on a table with a printed label, for the photo tasks
export function productPhoto(label: string, jarColor: string, background = "#E9E2D6"): Picture {
  const canvas = new Canvas(1024, 1024, hex(background));
  canvas.fillRect(0, 760, 1024, 264, hex("#B08D57"));
  canvas.fillRect(352, 250, 320, 520, hex(jarColor));
  canvas.fillRect(372, 200, 280, 60, hex("#3A3A3A"));
  canvas.fillRect(372, 420, 280, 200, [250, 250, 245]);
  canvas.centeredText(label, 520, 250, [30, 30, 30], 8);
  return picture(canvas);
}

// A plain typed page, one line per entry
export function documentImage(lines: readonly string[]): Picture {
  const canvas = new Canvas(1024, Math.max(400, 80 + lines.length * 34), [255, 255, 255]);
  lines.forEach((line, index) => canvas.text(line, 40, 40 + index * 34, 3, [20, 20, 20]));
  return picture(canvas);
}
