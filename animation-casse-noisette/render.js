// Export de l'animation en MP4 : Chromium (Playwright) dessine chaque image,
// ffmpeg les encode en H.264 et ajoute la bande-son (export/bande-son.wav,
// générée par bande-son.py).
//
//   node render.js                    -> export/casse-noisette-teaser.mp4
//   node render.js --stills 2,6,12    -> export/still-2.jpg, ... (aperçus)
//
// Variables : FFMPEG (chemin de ffmpeg), CHROMIUM (chemin de Chromium).
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn, execSync } = require("child_process");

let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(execSync("npm root -g").toString().trim(), "playwright")); }

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const outDir = path.join(__dirname, "export");
fs.mkdirSync(outDir, { recursive: true });

// Petit serveur local : en file://, Chromium refuse d'exporter un canvas
// qui contient des images.
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".wav": "audio/wav" };
function serve() {
  const srv = http.createServer((req, res) => {
    const file = path.join(__dirname, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(__dirname) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(0, "127.0.0.1", () => r(srv)));
}

(async () => {
  const srv = await serve();
  const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("pageerror", e => { console.error("Erreur page :", e.message); process.exit(1); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?capture`);
  await page.evaluate(() => window.ready);
  const { FPS, DUR } = await page.evaluate(() => ({ FPS: window.FPS, DUR: window.DUR }));

  const i = process.argv.indexOf("--stills");
  if (i > 0) {
    for (const s of process.argv[i + 1].split(",").map(Number)) {
      const b64 = await page.evaluate(f => window.frameJPEG(f), Math.round(s * FPS));
      fs.writeFileSync(path.join(outDir, `still-${s}.jpg`), Buffer.from(b64, "base64"));
    }
  } else {
    const out = path.join(outDir, "casse-noisette-teaser.mp4");
    const audio = path.join(outDir, "bande-son.wav");
    const withAudio = fs.existsSync(audio);
    const ff = spawn(FFMPEG, [
      "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      ...(withAudio ? ["-i", audio] : []),
      "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
      ...(withAudio ? ["-c:a", "aac", "-b:a", "256k", "-shortest"] : []),
      "-movflags", "+faststart", out,
    ], { stdio: ["pipe", "inherit", "inherit"] });

    const N = Math.round(FPS * DUR), t0 = Date.now();
    for (let f = 0; f < N; f++) {
      const b64 = await page.evaluate(n => window.frameJPEG(n), f);
      if (!ff.stdin.write(Buffer.from(b64, "base64"))) await new Promise(r => ff.stdin.once("drain", r));
      if (f % 30 === 0) process.stdout.write(`\rimage ${f}/${N}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on("close", r));
    console.log(`\nTerminé : ${out}${withAudio ? " (avec son)" : " (sans son)"}`);
  }
  await browser.close();
  srv.close();
})();
