import { useI18n } from '../i18n/index.jsx';

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function QualitySelector({ formats, selectedFormat, onSelect }) {
  const { t } = useI18n();

  if (!formats || formats.length === 0) return null;

  return (
    <div className="quality-section">
      <h3 className="quality-section-title">{t.qualityTitle}</h3>
      <div className="quality-grid">
        {formats.map((format, index) => (
          <div
            key={format.format_id}
            className={`quality-card ${selectedFormat?.format_id === format.format_id ? 'selected' : ''} ${index === 0 ? 'best' : ''}`}
            onClick={() => onSelect(format)}
            id={`quality-${format.quality_label}`}
            data-best-label={t.bestBadge}
          >
            <div className="quality-label">{format.quality_label}</div>
            <div className="quality-ext">{format.ext?.toUpperCase()}</div>
            {format.filesize && (
              <div className="quality-size">~{formatFileSize(format.filesize)}</div>
            )}
          </div>
        ))}
        
        {/* Audio Only option */}
        <div
          className={`quality-card quality-audio-card ${selectedFormat?.format_id === 'audio' ? 'selected' : ''}`}
          onClick={() => onSelect({ format_id: 'audio', quality_label: 'MP3', ext: 'mp3' })}
          id="quality-audio"
        >
          <div className="quality-label">🎵 MP3</div>
          <div className="quality-ext">{t.audioOnly}</div>
        </div>
      </div>
    </div>
  );
}
