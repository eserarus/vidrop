import { useI18n } from '../i18n/index.jsx';

export default function DownloadButton({ onDownload, downloading, selectedFormat }) {
  const { t } = useI18n();
  const isAudio = selectedFormat?.format_id === 'audio';

  return (
    <div className="download-section">
      <button
        className={`download-btn ${downloading ? 'downloading' : ''}`}
        onClick={onDownload}
        disabled={!selectedFormat || downloading}
        id="download-btn"
      >
        {downloading ? (
          <>
            <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            {t.downloading}
          </>
        ) : (
          <>
            {isAudio ? '🎵' : '⬇️'} {selectedFormat ? `${selectedFormat.quality_label} ${isAudio ? t.downloadAudio : t.downloadVideo}` : t.selectQuality}
          </>
        )}
        {downloading && <div className="download-progress-bar" style={{ width: '60%' }} />}
      </button>
    </div>
  );
}
