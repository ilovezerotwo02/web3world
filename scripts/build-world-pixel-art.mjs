import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const art = path.join(root, "public", "art");
await mkdir(path.join(art, "buildings"), { recursive: true });
await mkdir(path.join(art, "sky"), { recursive: true });

function raster(width, height) {
  const data = Buffer.alloc(width * height * 4);
  function pixel(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 4;
    const rgb = typeof color === "number"
      ? [color >> 16 & 255, color >> 8 & 255, color & 255, 255]
      : color;
    data.set(rgb, offset);
  }
  function rect(x, y, w, h, color) {
    for (let row = y; row < y + h; row += 1) {
      for (let column = x; column < x + w; column += 1) pixel(column, row, color);
    }
  }
  function polygon(points, color, texture = null) {
    const minimumX = Math.floor(Math.min(...points.map(([x]) => x)));
    const maximumX = Math.ceil(Math.max(...points.map(([x]) => x)));
    const minimumY = Math.floor(Math.min(...points.map(([, y]) => y)));
    const maximumY = Math.ceil(Math.max(...points.map(([, y]) => y)));
    for (let y = minimumY; y <= maximumY; y += 1) {
      for (let x = minimumX; x <= maximumX; x += 1) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
          const [ax, ay] = points[i];
          const [bx, by] = points[j];
          if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
        }
        if (inside) pixel(x, y, texture ? texture(x, y) : color);
      }
    }
  }
  function line(a, b, color, thickness = 1) {
    const steps = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])));
    for (let i = 0; i <= steps; i += 1) {
      const progress = steps === 0 ? 0 : i / steps;
      rect(Math.round(a[0] + (b[0] - a[0]) * progress), Math.round(a[1] + (b[1] - a[1]) * progress), thickness, thickness, color);
    }
  }
  function border(points, color, thickness = 1) {
    points.forEach((point, index) => line(point, points[(index + 1) % points.length], color, thickness));
  }
  async function save(filename, scale = 2) {
    await sharp(data, { raw: { width, height, channels: 4 } })
      .resize(width * scale, height * scale, { kernel: "nearest" })
      .png()
      .toFile(path.join(art, filename));
  }
  return { pixel, rect, polygon, line, border, save };
}

function texture(palette) {
  return (x, y) => palette[Math.abs((x * 13 + y * 29 + (x * y % 19)) % palette.length)];
}

function planePoint(corners, u, v) {
  const [a, b, c, d] = corners;
  return [
    a[0] * (1 - u) * (1 - v) + b[0] * u * (1 - v) + c[0] * u * v + d[0] * (1 - u) * v,
    a[1] * (1 - u) * (1 - v) + b[1] * u * (1 - v) + c[1] * u * v + d[1] * (1 - u) * v,
  ];
}

function planeTile(image, corners, u, v, width, height, color) {
  image.polygon([
    planePoint(corners, u, v),
    planePoint(corners, u + width, v),
    planePoint(corners, u + width, v + height),
    planePoint(corners, u, v + height),
  ], color);
}

const smithy = raster(128, 112);
const dark = 0x241c29;
smithy.polygon([[10, 79], [67, 104], [122, 91], [80, 70]], [26, 20, 31, 105]);
smithy.polygon([[9, 75], [65, 99], [122, 84], [122, 94], [65, 109], [9, 84]], 0x35313d);
smithy.polygon([[9, 75], [66, 99], [122, 84], [69, 64]], 0x67616a, texture([0x69636b, 0x5e5963, 0x726973, 0x635e69]));
smithy.line([10, 76], [65, 101], 0x96868a);
smithy.line([65, 101], [122, 86], 0x777381);

const side = [[16, 43], [65, 66], [65, 99], [16, 76]];
const front = [[65, 66], [121, 51], [121, 84], [65, 99]];
smithy.polygon(side, 0x7f736d, texture([0x7c706a, 0x81746a, 0x766b68, 0x8a7b70]));
smithy.polygon(front, 0x5d5660, texture([0x59525b, 0x625961, 0x635a60, 0x5b5660]));
for (let row = 0; row < 7; row += 1) {
  for (let column = 0; column < 7; column += 1) {
    const u = column / 7;
    const v = row / 7;
    const color = (row + column) % 3 === 0 ? 0x958278 : 0x766966;
    planeTile(smithy, side, u + 0.01, v + 0.014, 0.125, 0.112, color);
    planeTile(smithy, front, u + 0.012, v + 0.015, 0.126, 0.108, (row + column) % 3 === 0 ? 0x72656b : 0x59525e);
  }
}
for (const u of [0, 0.48, 0.96]) {
  planeTile(smithy, side, u, 0, 0.045, 1, 0x493434);
  planeTile(smithy, side, u + 0.006, 0, 0.014, 1, 0x9a6d4d);
}
planeTile(smithy, front, 0, 0.04, 1, 0.08, 0x362a33);
planeTile(smithy, front, 0.01, 0.89, 0.98, 0.1, 0x3b313c);
planeTile(smithy, front, 0, 0, 0.045, 1, 0x815637);
planeTile(smithy, front, 0.95, 0, 0.045, 1, 0x50363a);

// The furnace, doorway and windows are painted in their facade's perspective.
planeTile(smithy, side, 0.28, 0.28, 0.38, 0.62, 0x322a35);
planeTile(smithy, side, 0.33, 0.37, 0.28, 0.45, 0x49313a);
planeTile(smithy, side, 0.37, 0.48, 0.22, 0.28, 0x624039);
planeTile(smithy, side, 0.42, 0.57, 0.1, 0.21, 0x78513b);
planeTile(smithy, side, 0.46, 0.53, 0.04, 0.14, 0x896145);
planeTile(smithy, side, 0.29, 0.8, 0.39, 0.07, 0xbba08a);
planeTile(smithy, front, 0.31, 0.28, 0.33, 0.7, 0x312631);
planeTile(smithy, front, 0.35, 0.32, 0.26, 0.66, 0x695044);
planeTile(smithy, front, 0.39, 0.32, 0.02, 0.64, 0x8e6549);
planeTile(smithy, front, 0.49, 0.32, 0.02, 0.64, 0x352a32);
planeTile(smithy, front, 0.55, 0.62, 0.04, 0.05, 0xe4b264);
planeTile(smithy, front, 0.72, 0.29, 0.21, 0.35, 0x292532);
planeTile(smithy, front, 0.75, 0.33, 0.15, 0.25, 0x918e84);
planeTile(smithy, front, 0.81, 0.32, 0.026, 0.29, 0x483b3c);
planeTile(smithy, front, 0.74, 0.44, 0.18, 0.034, 0x483b3c);

const gable = [[65, 66], [95, 33], [121, 51]];
smithy.polygon(gable, 0x624e50, texture([0x604b4c, 0x68534e, 0x6c5750]));
smithy.line([95, 34], [92, 58], 0x342630, 3);
smithy.line([72, 57], [115, 48], 0xa07c59, 2);
const nearRoof = [[12, 43], [43, 9], [96, 32], [65, 66]];
const farRoof = [[43, 9], [74, 27], [124, 49], [96, 32]];
smithy.polygon(farRoof, dark);
smithy.polygon(nearRoof, dark);
for (let row = 0; row < 7; row += 1) {
  for (let column = 0; column < 8; column += 1) {
    const shade = [0x766475, 0x847384, 0x6e6071, 0x887786][(row * 5 + column * 3) % 4];
    planeTile(smithy, nearRoof, column / 8 + 0.006, row / 7 + 0.008, 0.115, 0.123, shade);
    const highlightA = planePoint(nearRoof, column / 8 + 0.012, row / 7 + 0.014);
    const highlightB = planePoint(nearRoof, column / 8 + 0.108, row / 7 + 0.014);
    smithy.line(highlightA, highlightB, 0x9b8694);
  }
}
for (let row = 0; row < 4; row += 1) {
  for (let column = 0; column < 8; column += 1) {
    planeTile(smithy, farRoof, column / 8 + 0.012, row / 4 + 0.012, 0.108, 0.22, (column + row) % 3 === 0 ? 0x66576b : 0x554b5b);
  }
}
smithy.border(nearRoof, 0x362a36, 2);
smithy.border(farRoof, 0x362a36, 2);
smithy.line([43, 9], [96, 32], 0xb49a8e, 2);
smithy.line([12, 44], [65, 67], 0x947262, 2);
smithy.line([65, 67], [125, 50], 0x967a6b, 2);

// Stone chimney, capped with iron, replaces the old flat red chimney.
smithy.polygon([[36, 17], [45, 21], [45, 51], [36, 47]], 0x635b62);
smithy.polygon([[45, 21], [55, 17], [55, 47], [45, 51]], 0x463f4c);
for (let y = 25; y < 46; y += 5) {
  smithy.line([36, y], [44, y + 3], 0x9b8780);
  smithy.line([46, y + 3], [54, y], 0x796b72);
}
smithy.polygon([[33, 14], [44, 9], [58, 14], [46, 20]], 0x837783);
smithy.polygon([[38, 14], [44, 12], [53, 14], [46, 17]], 0x201d28);
smithy.line([33, 15], [45, 20], 0xa99386);
smithy.line([45, 20], [58, 15], 0x3d3545, 2);

// A small hanging anvil emblem is readable without tiny map text.
smithy.polygon([[73, 57], [90, 53], [90, 65], [73, 69]], dark);
smithy.border([[73, 57], [90, 53], [90, 65], [73, 69]], 0xbaa16f);
smithy.polygon([[76, 59], [87, 57], [85, 61], [80, 62], [80, 65], [86, 63], [87, 65], [77, 67], [77, 65], [79, 63], [78, 62]], 0xf0ce87);
smithy.line([72, 53], [75, 57], 0x312633);
smithy.line([89, 49], [88, 54], 0x312633);

// Outdoor workbench, anvil, stacked logs and a cooling bucket add workshop scale.
smithy.polygon([[25, 84], [42, 91], [55, 85], [39, 78]], 0xa1744f);
smithy.polygon([[25, 85], [42, 92], [55, 86], [55, 89], [42, 95], [25, 88]], 0x543937);
smithy.line([28, 88], [28, 96], 0x372931, 2);
smithy.line([49, 89], [49, 99], 0x372931, 2);
smithy.polygon([[33, 81], [41, 78], [49, 82], [44, 85], [39, 85]], 0x9eabb2);
smithy.polygon([[38, 83], [44, 83], [44, 88], [46, 90], [37, 87], [39, 86]], 0x596673);
smithy.line([32, 81], [39, 83], 0xc8c1b9);
smithy.line([44, 77], [51, 79], 0x5a423c, 2);
smithy.rect(48, 76, 4, 3, 0x8895a0);
for (let row = 0; row < 2; row += 1) {
  for (let column = 0; column < 3; column += 1) {
    const x = 13 + column * 5 + row * 2;
    const y = 85 + row * 4 + column * 2;
    smithy.line([x, y], [x + 9, y - 3], 0x4b3832, 4);
    smithy.rect(x, y, 3, 3, 0xbd9360);
    smithy.pixel(x + 1, y + 1, 0x78573f);
  }
}
smithy.polygon([[103, 89], [110, 87], [116, 89], [114, 97], [108, 99], [104, 96]], 0x54606a);
smithy.polygon([[103, 89], [109, 86], [116, 89], [110, 92]], 0x9aa1a4);
smithy.polygon([[106, 89], [110, 88], [114, 89], [110, 91]], 0x51748a);
smithy.line([65, 100], [92, 94], 0xa19996, 2);
smithy.line([69, 104], [96, 98], 0x827a80, 2);
await smithy.save("buildings/smithy-pixel-v2.png");

const flameSheet = raster(48, 24);
const flameFrames = [
  [[7, 8], [6, 9], [6, 10], [5, 10], [4, 11], [4, 12], [3, 12], [4, 12], [3, 13], [4, 13], [3, 13], [3, 12], [2, 13], [3, 13], [2, 14], [2, 14]],
  [[8, 9], [7, 10], [6, 10], [5, 11], [5, 12], [4, 12], [4, 13], [3, 13], [4, 13], [3, 14], [3, 13], [2, 13], [3, 14], [2, 14], [3, 14], [2, 14]],
  [[6, 7], [5, 8], [5, 9], [4, 10], [4, 11], [3, 11], [4, 12], [4, 13], [3, 13], [3, 14], [2, 13], [3, 14], [2, 14], [2, 14], [3, 14], [2, 14]],
];
flameFrames.forEach((rows, frameIndex) => {
  const baseX = frameIndex * 16;
  rows.forEach(([start, end], y) => {
    for (let x = start; x <= end; x += 1) {
      const center = (start + end) / 2 + (frameIndex - 1) * 0.35;
      const distance = Math.abs(x - center);
      const color = y < 3 || distance > 4.5
        ? distance > 5.5 ? 0x9f342c : 0xde5130
        : y < 7
          ? distance < 1 ? 0xffc45e : 0xf17a36
          : distance < 1.5 ? 0xffe5a0 : distance < 3.5 ? 0xffa644 : 0xe96732;
      flameSheet.pixel(baseX + x, y, color);
    }
  });
  for (let x = 2; x <= 14; x += 1) {
    flameSheet.pixel(baseX + x, 16, x % 3 === frameIndex ? 0xffc15b : 0xb83c2b);
    if ((x + frameIndex) % 4 === 0) flameSheet.pixel(baseX + x, 17, 0xf77a35);
  }
});
await flameSheet.save("buildings/forge-flames-pixel-v2.png");

for (const body of ["sun", "moon"]) {
  const image = raster(24, 24);
  for (let y = 2; y < 22; y += 1) {
    for (let x = 2; x < 22; x += 1) {
      const distance = (x - 11.5) ** 2 + (y - 11.5) ** 2;
      if (distance > 98) continue;
      if (body === "moon" && (x - 16) ** 2 + (y - 8) ** 2 < 78) continue;
      const edge = distance > 70;
      image.pixel(x, y, body === "sun" ? edge ? 0xf2c67c : 0xffefb3 : edge ? 0xaab8d6 : 0xe3e5ed);
    }
  }
  if (body === "moon") {
    image.rect(6, 12, 2, 3, 0xc0c9de);
    image.rect(10, 17, 3, 2, 0xb7c2d8);
  }
  await image.save(`sky/${body}-pixel-v2.png`);
}

// Inpaint the disc and its reflection with adjacent sky colors on each scanline.
const { data, info } = await sharp(path.join(art, "farm-map.png"))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const source = Buffer.from(data);
for (let y = 83; y <= 133; y += 1) {
  const highlights = [];
  for (let x = 805; x <= 851; x += 1) {
    const offset = (y * info.width + x) * 4;
    if (source[offset] > 223 && source[offset + 1] > 202 && source[offset + 2] > 143) highlights.push(x);
  }
  if (highlights.length === 0) continue;
  const start = highlights[0] - 2;
  const end = highlights.at(-1) + 2;
  const left = (y * info.width + start - 4) * 4;
  const right = (y * info.width + end + 4) * 4;
  for (let x = start; x <= end; x += 1) {
    const offset = (y * info.width + x) * 4;
    const mix = Math.round((x - start + 4) / (end - start + 8) * 5) / 5;
    for (let channel = 0; channel < 3; channel += 1) {
      data[offset + channel] = Math.round(source[left + channel] * (1 - mix) + source[right + channel] * mix);
    }
  }
}
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toFile(path.join(art, "farm-map-sky-v2.png"));
console.log("Generated smithy, celestial sprites and the sun-free map variant.");
