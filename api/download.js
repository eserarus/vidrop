import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, format_id, quality, title } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Please provide a URL.' });
  }

  try {
    const isYouTube = /youtube\.com|youtu\.be/i.test(url);

    if (!isYouTube) {
      return res.status(400).json({ 
        error: 'Instagram downloads are only available in the local version.' 
      });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL.' });
    }

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

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');

    // Determine download options
    const options = {};

    if (isAudio) {
      options.filter = 'audioonly';
      options.quality = 'highestaudio';
    } else if (format_id && format_id !== 'best' && format_id !== 'audio') {
      // Try specific itag
      options.quality = parseInt(format_id);
    } else {
      options.filter = 'audioandvideo';
      options.quality = 'highest';
    }

    // Stream the video
    const stream = ytdl(url, options);

    stream.on('error', (err) => {
      console.error('Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed. Please try again.' });
      }
    });

    stream.pipe(res);

  } catch (err) {
    console.error('Download error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed. Please try again.' });
    }
  }
}
