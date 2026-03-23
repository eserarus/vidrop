import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, format_id, quality, title, videoUrl: directVideoUrl } = req.query;

  if (!url) return res.status(400).json({ error: 'Please provide a URL.' });

  try {
    const isYouTube = /youtube\.com|youtu\.be/i.test(url);
    const isInstagram = /instagram\.com/i.test(url);

    // ─── Instagram: Redirect to direct video URL ───
    if (isInstagram) {
      if (!directVideoUrl) {
        return res.status(400).json({ error: 'Instagram video URL missing.' });
      }
      // Redirect browser directly to Instagram CDN — instant, no timeout
      return res.redirect(302, decodeURIComponent(directVideoUrl));
    }

    // ─── YouTube: Get direct URL and redirect ───
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

    // Find the right format
    let chosenFormat;

    if (isAudio) {
      // Get best audio-only format
      chosenFormat = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
    } else if (format_id && format_id !== 'best' && format_id !== 'audio') {
      // Try specific itag
      chosenFormat = info.formats.find(f => f.itag === parseInt(format_id));
      if (!chosenFormat) {
        // Fallback to best audioandvideo
        chosenFormat = ytdl.chooseFormat(info.formats, { filter: 'audioandvideo', quality: 'highest' });
      }
    } else {
      chosenFormat = ytdl.chooseFormat(info.formats, { filter: 'audioandvideo', quality: 'highest' });
    }

    if (!chosenFormat || !chosenFormat.url) {
      return res.status(500).json({ error: 'No downloadable format found.' });
    }

    // Redirect to the direct video URL — instant, no timeout issues
    return res.redirect(302, chosenFormat.url);

  } catch (err) {
    console.error('Download error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed. Please try again.' });
    }
  }
}
