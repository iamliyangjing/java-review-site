const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const SVG_PATH = path.join(ROOT, "assets", "app-icon.svg");
const PNG_PATH = path.join(ROOT, "assets", "app-icon.png");
const ICO_PATH = path.join(ROOT, "assets", "app-icon.ico");
const SIZES = [16, 32, 48, 256];

function makeIco(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let imageOffset = header.length;
  images.forEach((image, index) => {
    const entryOffset = 6 + index * 16;
    header.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset);
    header.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(image.png.length, entryOffset + 8);
    header.writeUInt32LE(imageOffset, entryOffset + 12);
    imageOffset += image.png.length;
  });
  return Buffer.concat([header, ...images.map(image => image.png)]);
}

async function main() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome" });
  try {
    const svg = fs.readFileSync(SVG_PATH, "utf8");
    const images = [];
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}</style>${svg}`);
      const png = await page.locator("svg").screenshot({ omitBackground: true });
      if (size === 256) fs.writeFileSync(PNG_PATH, png);
      images.push({ size, png });
      await page.close();
    }
    fs.writeFileSync(ICO_PATH, makeIco(images));
  } finally {
    await browser.close();
  }
  process.stdout.write(`Generated ${PNG_PATH} and ${ICO_PATH}\n`);
}

main().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
