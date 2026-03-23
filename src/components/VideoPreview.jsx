import { useI18n } from '../i18n/index.jsx';

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViews(count, viewsLabel) {
  if (!count) return '';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M ${viewsLabel}`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K ${viewsLabel}`;
  return `${count} ${viewsLabel}`;
}

export default function VideoPreview({ videoInfo }) {
  const { t } = useI18n();

  if (!videoInfo) return null;

  const { title, thumbnail, duration, uploader, view_count, platform } = videoInfo;

  return (
    <div className="video-preview">
      <div className="video-thumbnail-container">
        {thumbnail && (
          <img
            className="video-thumbnail"
            src={thumbnail}
            alt={title}
            referrerPolicy="no-referrer"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
        {duration > 0 && (
          <div className="video-duration-badge">
            {formatDuration(duration)}
          </div>
        )}
        <div className={`video-platform-badge ${platform}`}>
          {platform === 'youtube' ? '▶ YouTube' : '📷 Instagram'}
        </div>
      </div>
      <div className="video-info">
        <h2 className="video-title">{title}</h2>
        <div className="video-uploader">
          <span>👤 {uploader}</span>
          {view_count > 0 && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span>{formatViews(view_count, t.views)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
