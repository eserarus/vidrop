import ytdl from '@distube/ytdl-core';

// ========================
// Instagram Scraper
// ========================
async function getInstagramInfo(url) {
  const shortcodeMatch = url.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!shortcodeMatch) throw new Error('Invalid Instagram URL.');
  const shortcode = shortcodeMatch[2];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  let videoUrl = null, thumbnail = null, title = '', uploader = '';

  // Try embed endpoint
  try {
    const embedRes = await fetch(`https://www.instagram.com/p/${shortcode}/embed/`, { headers });
    if (embedRes.ok) {
      const html = await embedRes.text();
      const videoMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
      if (videoMatch) videoUrl = videoMatch[1].replace(/\\u0026/g, '&');
      if (!videoUrl) { const m = html.match(/<video[^>]+src="([^"]+)"/); if (m) videoUrl = m[1].replace(/&amp;/g, '&'); }
      const thumbMatch = html.match(/"display_url"\s*:\s*"([^"]+)"/);
      if (thumbMatch) thumbnail = thumbMatch[1].replace(/\\u0026/g, '&');
      const captionMatch = html.match(/"caption"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]{0,200})"/);
      if (captionMatch) title = captionMatch[1].replace(/\\n/g, ' ').substring(0, 100);
      const userMatch = html.match(/"username"\s*:\s*"([^"]+)"/);
      if (userMatch) uploader = userMatch[1];
    }
  } catch (e) { console.error('[IG embed]', e.message); }

  // Fallback: main page
  if (!videoUrl) {
    try {
      const pageRes = await fetch(url, { headers, redirect: 'follow' });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const m = html.match(/<meta\s+(?:property="og:video"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:video")/i);
        if (m) videoUrl = (m[1] || m[2]).replace(/&amp;/g, '&');
        if (!thumbnail) { const m2 = html.match(/<meta\s+(?:property="og:image"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:image")/i); if (m2) thumbnail = (m2[1] || m2[2]); }
        if (!title) { const m3 = html.match(/<meta\s+(?:property="og:title"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:title")/i); if (m3) title = m3[1] || m3[2]; }
        if (!videoUrl) { const m4 = html.match(/"video_url"\s*:\s*"([^"]+)"/); if (m4) videoUrl = m4[1].replace(/\\u0026/g, '&'); }
      }
    } catch (e) { console.error('[IG page]', e.message); }
  }

  if (!videoUrl) throw new Error('Could not extract video. The post may be private or not a video.');

  return {
    title: title || `Instagram Reel — @${uploader || 'unknown'}`,
    thumbnail: thumbnail || '',
    duration: 0,
    uploader: uploader ? `@${uploader}` : '',
    view_count: 0,
    description: '',
    platform: 'instagram',
    videoUrl,
    bestDownloadUrl: videoUrl,
    formats: [{
      format_id: 'original', ext: 'mp4', height: 1080, width: 1080,
      fps: 30, filesize: null, quality_label: 'Original', hasAudio: true,
      downloadUrl: videoUrl,
    }],
  };
}

// ========================
// Main Handler
// ========================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Please provide a URL.' });

  try {
    const isYouTube = /youtube\.com|youtu\.be/i.test(url);
    const isInstagram = /instagram\.com/i.test(url);

    if (!isYouTube && !isInstagram) {
      return res.status(400).json({ error: 'Only YouTube and Instagram are supported.' });
    }

    if (isInstagram) {
      const info = await getInstagramInfo(url);
      return res.status(200).json(info);
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL.' });
    }

    // Try multiple clients
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
        break;
      } catch (e) {
        lastError = e;
        console.error(`[ytdl] ${JSON.stringify(opts)} failed:`, e.message);
      }
    }

    if (!info) {
      // Fallback: oEmbed for basic info
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          const videoId = ytdl.getVideoID(url);
          return res.status(200).json({
            title: oembed.title || 'Untitled',
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: 0, uploader: oembed.author_name || '', view_count: 0,
            description: '', platform: 'youtube',
            bestDownloadUrl: '',
            formats: [{ format_id: 'best', ext: 'mp4', height: 720, width: 1280, fps: 30, filesize: null, quality_label: '720p', hasAudio: true, downloadUrl: '' }],
          });
        }
      } catch (e) { console.error('[oEmbed]', e.message); }
      throw lastError || new Error('All extraction methods failed');
    }

    const vd = info.videoDetails;

    // ── Build format list ──
    // PRIORITY: formats with BOTH video and audio (can be played directly)
    const combinedFormats = info.formats
      .filter(f => f.hasVideo && f.hasAudio && f.url && f.height)
      .map(f => ({
        format_id: f.itag.toString(),
        ext: f.container || 'mp4',
        height: f.height,
        width: f.width,
        fps: f.fps || 30,
        filesize: f.contentLength ? parseInt(f.contentLength) : null,
        quality_label: f.qualityLabel || `${f.height}p`,
        hasAudio: true,
        downloadUrl: f.url,
      }))
      .sort((a, b) => b.height - a.height);

    // De-duplicate by height
    const seen = new Set();
    const uniqueFormats = combinedFormats.filter(f => {
      if (seen.has(f.height)) return false;
      seen.add(f.height);
      return true;
    });

    // Best download URL
    const bestUrl = uniqueFormats[0]?.downloadUrl || '';

    // Audio URL
    let audioUrl = '';
    try {
      const audioFormat = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
      if (audioFormat?.url) audioUrl = audioFormat.url;
    } catch {}

    const thumbs = vd.thumbnails || [];
    
    console.log(`[info] ${vd.title} — ${combinedFormats.length} combined, ${videoOnlyFormats.length} video-only, bestUrl: ${!!bestUrl}`);

    return res.status(200).json({
      title: vd.title || 'Untitled',
      thumbnail: thumbs.length > 0 ? thumbs[thumbs.length - 1].url : '',
      duration: parseInt(vd.lengthSeconds) || 0,
      uploader: vd.author?.name || vd.ownerChannelName || '',
      view_count: parseInt(vd.viewCount) || 0,
      description: (vd.description || '').substring(0, 200),
      platform: 'youtube',
      formats: uniqueFormats.slice(0, 6),
      bestDownloadUrl: bestUrl,
      audioDownloadUrl: audioUrl,
    });

  } catch (err) {
    console.error('Info error:', err.message, err.stack);
    return res.status(500).json({
      error: 'Could not fetch video information. Please check the URL and try again.',
    });
  }
}
