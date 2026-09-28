// Export de l'animation en MP4 : Chromium (Playwright) dessine chaque image,
// ffmpeg les encode en H.264.
//
//   node render.js                    -> export/casse-noisette-ouverture.mp4
//   node render.js --stills 2,6,12    -> export/still-2.png, ... (aperçus)
//
// Variables : FFMPEG (chemin de ffmpeg), CHROMIUM (chemin de Chromium).
const path = require("path");
const fs = require("fs");
const { spawn, execSync } = require("child_process");

let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(execSync("npm root -g").toString().trim(), "playwright")); }

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const outDir = path.join(__dirname, "export");
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", e => { console.error("Erreur page :", e.message); process.exit(1); });
  await page.goto("file://" + path.join(__dirname, "index.html") + "?capture");
  await page.evaluate(() => window.ready);
  const { FPS, DUR } = await page.evaluate(() => ({ FPS: window.FPS, DUR: window.DUR }));

  const i = process.argv.indexOf("--stills");
  if (i > 0) {
    for (const s of process.argv[i + 1].split(",").map(Number)) {
      const b64 = await page.evaluate(f => window.frameJPEG(f), Math.round(s * FPS));
      fs.writeFileSync(path.join(outDir, `still-${s}.jpg`), Buffer.from(b64, "base64"));
    }
    await browser.close();
    return;
  }

  const out = path.join(outDir, "casse-noisette-ouverture.mp4");
  const ff = spawn(FFMPEG, [
    "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  const N = Math.round(FPS * DUR), t0 = Date.now();
  for (let f = 0; f < N; f++) {
    const b64 = await page.evaluate(n => window.frameJPEG(n), f);
    if (!ff.stdin.write(Buffer.from(b64, "base64"))) await new Promise(r => ff.stdin.once("drain", r));
    if (f % 30 === 0) process.stdout.write(`\rimage ${f}/${N}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on("close", r));
  await browser.close();
  console.log(`\nTerminé : ${out}`);
})();
