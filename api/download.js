import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, format_id, quality, videoUrl: directVideoUrl } = req.query;

  if (!url) return res.status(400).json({ error: 'Please provide a URL.' });

  try {
    const isYouTube = /youtube\.com|youtu\.be/i.test(url);
    const isInstagram = /instagram\.com/i.test(url);

    // ─── Instagram ───
    if (isInstagram) {
      if (!directVideoUrl) {
        return res.status(400).json({ error: 'Instagram video URL missing.' });
      }
      return res.status(200).json({ downloadUrl: decodeURIComponent(directVideoUrl) });
    }

    // ─── YouTube ───
    if (!isYouTube || !ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid URL.' });
    }

    const isAudio = quality === 'audio';

    const clientOptions = [
      { playerClients: ['IOS'] },
      { playerClients: ['ANDROID'] },
      { playerClients: ['WEB_CREATOR'] },
      {},
    ];

    let info;
    let lastError;

    for (const opts of clientOptions) {
      try {
        info = await ytdl.getInfo(url, {
          ...opts,
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            },
          },
        });
        break;
      } catch (e) {
        lastError = e;
        console.error(`[download] Client ${JSON.stringify(opts)} failed:`, e.message);
      }
    }

    if (!info) throw lastError || new Error('Could not get video info');

    // Find the right format with multiple fallbacks
    let chosenFormat = null;

    if (isAudio) {
      try { chosenFormat = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' }); } catch {}
    } else if (format_id && format_id !== 'best' && format_id !== 'audio') {
      // Try specific itag first
      chosenFormat = info.formats.find(f => f.itag === parseInt(format_id) && f.url);
    }

    // Fallback chain for video
    if (!chosenFormat && !isAudio) {
      // 1. Try audioandvideo (combined format)
      try { chosenFormat = ytdl.chooseFormat(info.formats, { filter: 'audioandvideo', quality: 'highest' }); } catch {}
      
      // 2. Try any format with video
      if (!chosenFormat) {
        chosenFormat = info.formats
          .filter(f => f.hasVideo && f.hasAudio && f.url)
          .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
      }

      // 3. Try video-only as last resort
      if (!chosenFormat) {
        chosenFormat = info.formats
          .filter(f => f.hasVideo && f.url)
          .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
      }
    }

    // Last resort: any format with a URL
    if (!chosenFormat) {
      chosenFormat = info.formats.find(f => f.url);
    }

    if (!chosenFormat || !chosenFormat.url) {
      console.error('[download] No format found. Available formats:', info.formats.map(f => ({
        itag: f.itag, hasVideo: f.hasVideo, hasAudio: f.hasAudio, height: f.height, hasUrl: !!f.url
      })));
      return res.status(500).json({ error: 'No downloadable format found.' });
    }

    console.log(`[download] Chosen format: itag=${chosenFormat.itag}, ${chosenFormat.height}p, hasAudio=${chosenFormat.hasAudio}`);

    return res.status(200).json({ downloadUrl: chosenFormat.url });

  } catch (err) {
    console.error('Download error:', err.message, err.stack);
    return res.status(500).json({ error: 'Download failed. Please try again.' });
  }
}
