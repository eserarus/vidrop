import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Please provide a URL.' });
  }

  try {
    const isYouTube = /youtube\.com|youtu\.be/i.test(url);
    const isInstagram = /instagram\.com/i.test(url);

    if (!isYouTube && !isInstagram) {
      return res.status(400).json({ error: 'Only YouTube and Instagram are supported.' });
    }

    if (isInstagram) {
      return res.status(400).json({ 
        error: 'Instagram downloads are only available in the local version.' 
      });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL.' });
    }

    // Try multiple approaches to bypass YouTube bot detection on cloud IPs
    let info;
    const clientOptions = [
      { playerClients: ['IOS'] },
      { playerClients: ['ANDROID'] },
      { playerClients: ['WEB_CREATOR'] },
      {},
    ];

    let lastError;
    for (const opts of clientOptions) {
      try {
        info = await ytdl.getInfo(url, {
          ...opts,
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          },
        });
        break; // success
      } catch (e) {
        lastError = e;
        console.error(`[ytdl] Client ${JSON.stringify(opts)} failed:`, e.message);
      }
    }

    if (!info) {
      // Fallback: try YouTube oEmbed API for basic info (no formats)
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        );
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          
          // Extract video ID for thumbnail
          const videoId = ytdl.getVideoID(url);
          
          return res.status(200).json({
            title: oembed.title || 'Untitled',
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: 0,
            uploader: oembed.author_name || '',
            view_count: 0,
            description: '',
            platform: 'youtube',
            formats: [
              {
                format_id: 'best',
                ext: 'mp4',
                height: 720,
                width: 1280,
                fps: 30,
                filesize: null,
                quality_label: '720p',
                hasAudio: true,
              },
            ],
          });
        }
      } catch (oembedErr) {
        console.error('[oEmbed] Fallback failed:', oembedErr.message);
      }

      throw lastError || new Error('All extraction methods failed');
    }

    const videoDetails = info.videoDetails;

    // Extract video formats with height info
    const videoFormats = info.formats
      .filter(f => f.hasVideo && f.height)
      .map(f => ({
        format_id: f.itag.toString(),
        ext: f.container || 'mp4',
        height: f.height,
        width: f.width,
        fps: f.fps || 30,
        filesize: f.contentLength ? parseInt(f.contentLength) : null,
        vcodec: f.videoCodec || '',
        acodec: f.audioCodec || '',
        hasAudio: f.hasAudio,
        quality_label: f.qualityLabel || `${f.height}p`,
        url: f.url,
      }))
      .sort((a, b) => b.height - a.height);

    // De-duplicate by height (keep best per resolution, prefer with audio)
    const seen = new Set();
    const uniqueFormats = videoFormats.filter(f => {
      const key = f.height;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const thumbnails = videoDetails.thumbnails || [];
    const bestThumb = thumbnails.length > 0 
      ? thumbnails[thumbnails.length - 1].url 
      : '';

    return res.status(200).json({
      title: videoDetails.title || 'Untitled',
      thumbnail: bestThumb,
      duration: parseInt(videoDetails.lengthSeconds) || 0,
      uploader: videoDetails.author?.name || videoDetails.ownerChannelName || '',
      view_count: parseInt(videoDetails.viewCount) || 0,
      description: (videoDetails.description || '').substring(0, 200),
      platform: 'youtube',
      formats: uniqueFormats.slice(0, 6),
    });

  } catch (err) {
    console.error('Info error:', err.message, err.stack);
    return res.status(500).json({ 
      error: 'Could not fetch video information. Please check the URL and try again.' 
    });
  }
}
