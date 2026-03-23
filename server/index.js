import express from 'express';
import cors from 'cors';
import { spawn, execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve yt-dlp binary: check venv first, then system PATH
function findYtDlp() {
  const venvPath = path.join(__dirname, '..', '.venv', 'bin', 'yt-dlp');
  if (fs.existsSync(venvPath)) return venvPath;
  
  try {
    const systemPath = execSync('which yt-dlp', { encoding: 'utf8' }).trim();
    if (systemPath) return systemPath;
  } catch {}
  
  return 'yt-dlp'; // fallback to PATH
}

const YT_DLP = findYtDlp();

const app = express();
const PORT = 3001;

app.use(cors({
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
}));
app.use(express.json());

// Temp directory for downloads
const TEMP_DIR = path.join(os.tmpdir(), 'vidrop-downloads');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Detect platform from URL
function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/instagram\.com/i.test(url)) return 'instagram';
  return 'unknown';
}

// Validate URL
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

// POST /api/info - Get video metadata
app.post('/api/info', async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Geçerli bir URL girin.' });
  }

  const platform = detectPlatform(url);
  if (platform === 'unknown') {
    return res.status(400).json({ error: 'Sadece YouTube ve Instagram desteklenmektedir.' });
  }

  try {
    const info = await getVideoInfo(url);
    res.json({ ...info, platform });
  } catch (err) {
    console.error('Info error:', err.message);
    res.status(500).json({ error: 'Video bilgisi alınamadı. URL\'yi kontrol edin.' });
  }
});

// GET /api/download - Download video
app.get('/api/download', async (req, res) => {
  const { url, format_id, quality, title: videoTitle } = req.query;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Geçerli bir URL girin.' });
  }

  try {
    const id = uuidv4();
    const outputTemplate = path.join(TEMP_DIR, `${id}.%(ext)s`);

    const args = [
      '--no-playlist',
      '--no-warnings',
      '-o', outputTemplate,
    ];

    if (format_id && format_id !== 'best') {
      // For combined format: video+audio
      args.push('-f', `${format_id}+bestaudio/best`);
      args.push('--merge-output-format', 'mp4');
    } else if (quality === 'audio') {
      args.push('-x');
      args.push('--audio-format', 'mp3');
      args.push('--audio-quality', '0');
    } else {
      args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
      args.push('--merge-output-format', 'mp4');
    }

    args.push(url);

    console.log(`[Download] Starting: yt-dlp ${args.join(' ')}`);

    const result = await runYtDlp(args);
    
    // Find the downloaded file
    const files = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith(id));

    if (files.length === 0) {
      return res.status(500).json({ error: 'İndirme başarısız oldu.' });
    }

    const filePath = path.join(TEMP_DIR, files[0]);
    const ext = path.extname(files[0]);
    
    // Build filename from title passed by frontend (avoids re-fetching info)
    const finalExt = ext || '.mp4';
    let filename = `vidrop-video${finalExt}`;
    if (videoTitle) {
      const safeName = decodeURIComponent(videoTitle)
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 80);
      if (safeName) filename = `${safeName}${finalExt}`;
    }

    const stat = fs.statSync(filePath);
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', ext === '.mp3' ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('end', () => {
      // Clean up temp file after sending
      try { fs.unlinkSync(filePath); } catch {}
    });

  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).json({ error: 'Video indirilemedi. Lütfen tekrar deneyin.' });
  }
});

// Get video info using yt-dlp --dump-json
function getVideoInfo(url) {
  return new Promise((resolve, reject) => {
    const args = ['--dump-json', '--no-playlist', '--no-warnings', url];
    const proc = spawn(YT_DLP, args);
    
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }

      try {
        const data = JSON.parse(stdout);
        
        // Extract available formats
        const formats = (data.formats || [])
          .filter(f => f.vcodec !== 'none' && f.height)
          .map(f => ({
            format_id: f.format_id,
            ext: f.ext,
            height: f.height,
            width: f.width,
            fps: f.fps,
            filesize: f.filesize || f.filesize_approx || null,
            vcodec: f.vcodec,
            acodec: f.acodec,
            quality_label: `${f.height}p${f.fps > 30 ? f.fps : ''}`,
          }))
          .sort((a, b) => b.height - a.height);

        // De-duplicate by height (keep best per resolution)
        const seen = new Set();
        const uniqueFormats = formats.filter(f => {
          const key = f.height;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        resolve({
          title: data.title || 'Untitled',
          thumbnail: data.thumbnail || '',
          duration: data.duration || 0,
          uploader: data.uploader || data.channel || '',
          view_count: data.view_count || 0,
          description: (data.description || '').substring(0, 200),
          formats: uniqueFormats.slice(0, 6),
        });
      } catch (e) {
        reject(new Error('Video bilgisi çözümlenemedi.'));
      }
    });

    proc.on('error', (err) => {
      reject(new Error('yt-dlp bulunamadı. Lütfen yt-dlp yükleyin.'));
    });
  });
}

// Run yt-dlp command
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP, args);
    
    let stderr = '';
    proc.stdout.on('data', (data) => {
      console.log(`[yt-dlp] ${data.toString().trim()}`);
    });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      } else {
        resolve();
      }
    });

    proc.on('error', (err) => {
      reject(new Error('yt-dlp bulunamadı. Lütfen yt-dlp yükleyin.'));
    });
  });
}

app.listen(PORT, () => {
  console.log(`\n🎬 ViDrop API server running on http://localhost:${PORT}\n`);
});
