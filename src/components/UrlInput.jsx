import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/index.jsx';

export default function UrlInput({ onSubmit, loading }) {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState(null);

  useEffect(() => {
    if (/youtube\.com|youtu\.be/i.test(url)) {
      setPlatform('youtube');
    } else if (/instagram\.com/i.test(url)) {
      setPlatform('instagram');
    } else {
      setPlatform(null);
    }
  }, [url]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      // Clipboard access denied
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  const platformIcon = platform === 'youtube' ? '▶' : platform === 'instagram' ? '📷' : '🔗';

  return (
    <div className="url-input-section">
      <form onSubmit={handleSubmit}>
        <div className={`url-input-wrapper ${platform ? `platform-${platform}` : ''}`}>
          <div className={`url-platform-icon ${platform || ''}`}>
            {platformIcon}
          </div>
          <input
            id="url-input"
            className="url-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t.urlPlaceholder}
            disabled={loading}
            autoComplete="off"
          />
          <button
            type="button"
            className="url-paste-btn"
            onClick={handlePaste}
            disabled={loading}
            title={t.pasteBtn}
          >
            📋 {t.pasteBtn}
          </button>
          <button
            type="submit"
            className="url-submit-btn"
            disabled={!url.trim() || loading}
            id="analyze-btn"
          >
            {loading ? (
              <>
                <span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                {t.analyzingBtn}
              </>
            ) : (
              <>🔍 {t.analyzeBtn}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
