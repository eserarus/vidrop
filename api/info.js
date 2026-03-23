import ytdl from '@distube/ytdl-core';

// ========================
// Instagram Scraper
// ========================
async function getInstagramInfo(url) {
  // Extract shortcode from URL
  const shortcodeMatch = url.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!shortcodeMatch) {
    throw new Error('Invalid Instagram URL.');
  }
  const shortcode = shortcodeMatch[2];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Mode': 'navigate',
  };

  // Method 1: Try the embed endpoint
  let videoUrl = null;
  let thumbnail = null;
  let title = '';
  let uploader = '';

  try {
    const embedRes = await fetch(`https://www.instagram.com/p/${shortcode}/embed/`, { headers });
    if (embedRes.ok) {
      const html = await embedRes.text();

      // Extract video URL from embed HTML
      const videoMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
      if (videoMatch) {
        videoUrl = videoMatch[1].replace(/\\u0026/g, '&');
      }

      // Try to find video in other patterns
      if (!videoUrl) {
        const srcMatch = html.match(/<video[^>]+src="([^"]+)"/);
        if (srcMatch) {
          videoUrl = srcMatch[1].replace(/&amp;/g, '&');
        }
      }

      // Extract thumbnail
      const thumbMatch = html.match(/"display_url"\s*:\s*"([^"]+)"/) ||
                          html.match(/og:image['"]\s+content=['"](https:\/\/[^'"]+)['"]/);
      if (thumbMatch) {
        thumbnail = thumbMatch[1].replace(/\\u0026/g, '&');
      }

      // Extract caption/title
      const captionMatch = html.match(/"caption"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]{0,200})"/);
      if (captionMatch) {
        title = captionMatch[1].replace(/\\n/g, ' ').substring(0, 100);
      }

      // Extract username
      const userMatch = html.match(/"username"\s*:\s*"([^"]+)"/);
      if (userMatch) {
        uploader = userMatch[1];
      }
    }
  } catch (e) {
    console.error('[Instagram embed] Error:', e.message);
  }

  // Method 2: Try the main page with mobile user agent
  if (!videoUrl) {
    try {
      const pageRes = await fetch(url, {
        headers,
        redirect: 'follow',
      });
      if (pageRes.ok) {
        const html = await pageRes.text();

        // Extract from og:video meta tag
        const ogVideoMatch = html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
                              html.match(/<meta\s+content="([^"]+)"\s+property="og:video"/i);
        if (ogVideoMatch) {
          videoUrl = ogVideoMatch[1].replace(/&amp;/g, '&');
        }

        // Extract thumbnail from og:image
        if (!thumbnail) {
          const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                                html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
          if (ogImageMatch) {
            thumbnail = ogImageMatch[1].replace(/&amp;/g, '&');
          }
        }

        // Extract title from og:title
        if (!title) {
          const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                                html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
          if (ogTitleMatch) {
            title = ogTitleMatch[1];
          }
        }

        // Try to find video URL in JSON data within script tags
        if (!videoUrl) {
          const jsonMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
          if (jsonMatch) {
            videoUrl = jsonMatch[1].replace(/\\u0026/g, '&');
          }
        }
      }
    } catch (e) {
      console.error('[Instagram page] Error:', e.message);
    }
  }

  if (!videoUrl) {
    throw new Error('Could not extract video. The post may be private or not a video.');
  }

  return {
    title: title || `Instagram Reel — @${uploader || 'unknown'}`,
    thumbnail: thumbnail || '',
    duration: 0,
    uploader: uploader ? `@${uploader}` : '',
    view_count: 0,
    description: '',
    platform: 'instagram',
    videoUrl, // Direct URL for download
    formats: [
      {
        format_id: 'original',
        ext: 'mp4',
        height: 1080,
        width: 1080,
        fps: 30,
        filesize: null,
        quality_label: 'Original',
        hasAudio: true,
      },
    ],
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

    // ─── Instagram ───
    if (isInstagram) {
      const info = await getInstagramInfo(url);
      return res.status(200).json(info);
    }

    // ─── YouTube ───
    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL.' });
    }

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
        console.error(`[ytdl] Client ${JSON.stringify(opts)} failed:`, e.message);
      }
    }

    if (!info) {
      // Fallback: YouTube oEmbed
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        );
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          const videoId = ytdl.getVideoID(url);
          return res.status(200).json({
            title: oembed.title || 'Untitled',
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: 0,
            uploader: oembed.author_name || '',
            view_count: 0,
            description: '',
            platform: 'youtube',
            formats: [{ format_id: 'best', ext: 'mp4', height: 720, width: 1280, fps: 30, filesize: null, quality_label: '720p', hasAudio: true }],
          });
        }
      } catch (e) {
        console.error('[oEmbed] Fallback failed:', e.message);
      }
      throw lastError || new Error('All extraction methods failed');
    }

    const vd = info.videoDetails;
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
      }))
      .sort((a, b) => b.height - a.height);

    const seen = new Set();
    const uniqueFormats = videoFormats.filter(f => {
      if (seen.has(f.height)) return false;
      seen.add(f.height);
      return true;
    });

    const thumbs = vd.thumbnails || [];
    return res.status(200).json({
      title: vd.title || 'Untitled',
      thumbnail: thumbs.length > 0 ? thumbs[thumbs.length - 1].url : '',
      duration: parseInt(vd.lengthSeconds) || 0,
      uploader: vd.author?.name || vd.ownerChannelName || '',
      view_count: parseInt(vd.viewCount) || 0,
      description: (vd.description || '').substring(0, 200),
      platform: 'youtube',
      formats: uniqueFormats.slice(0, 6),
    });

  } catch (err) {
    console.error('Info error:', err.message, err.stack);
    return res.status(500).json({
      error: 'Could not fetch video information. Please check the URL and try again.',
    });
  }
}
