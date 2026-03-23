import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, format_id, quality, title, videoUrl: directVideoUrl } = req.query;

  if (!url) return res.status(400).json({ error: 'Please provide a URL.' });

  try {
    const isYouTube = /youtube\.com|youtu\.be/i.test(url);
    const isInstagram = /instagram\.com/i.test(url);

    // Build filename
    const isAudio = quality === 'audio';
    const ext = isAudio ? 'mp3' : 'mp4';
    let filename = `vidrop-video.${ext}`;
    if (title) {
      const safeName = decodeURIComponent(title)
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 80);
      if (safeName) filename = `${safeName}.${ext}`;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');

    // ─── Instagram Download ───
    if (isInstagram) {
      if (!directVideoUrl) {
        return res.status(400).json({ error: 'Instagram video URL missing.' });
      }

      // Proxy the Instagram video to the client
      const videoRes = await fetch(decodeURIComponent(directVideoUrl), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Referer': 'https://www.instagram.com/',
        },
      });

      if (!videoRes.ok) {
        return res.status(500).json({ error: 'Failed to download Instagram video.' });
      }

      const contentLength = videoRes.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      // Stream the response body
      const reader = videoRes.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      };
      await pump();
      return;
    }

    // ─── YouTube Download ───
    if (!isYouTube || !ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid URL.' });
    }

    const options = {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      },
    };

    const clientOptions = [
      { playerClients: ['IOS'] },
      { playerClients: ['ANDROID'] },
      { playerClients: ['WEB_CREATOR'] },
      {},
    ];

    if (isAudio) {
      options.filter = 'audioonly';
      options.quality = 'highestaudio';
    } else if (format_id && format_id !== 'best' && format_id !== 'audio') {
      options.quality = parseInt(format_id);
    } else {
      options.filter = 'audioandvideo';
      options.quality = 'highest';
    }

    let stream;
    let lastError;

    for (const clientOpt of clientOptions) {
      try {
        stream = ytdl(url, { ...options, ...clientOpt });
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 8000);
          stream.once('response', () => { clearTimeout(timeout); resolve(); });
          stream.once('error', (err) => { clearTimeout(timeout); reject(err); });
        });
        break;
      } catch (e) {
        lastError = e;
        console.error(`[download] Client ${JSON.stringify(clientOpt)} failed:`, e.message);
        if (stream) { stream.destroy(); stream = null; }
      }
    }

    if (!stream) throw lastError || new Error('All download methods failed');

    stream.on('error', (err) => {
      console.error('Stream error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Download failed.' });
    });

    stream.pipe(res);

  } catch (err) {
    console.error('Download error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed. Please try again.' });
    }
  }
}
