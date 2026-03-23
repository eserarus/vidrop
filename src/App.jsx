import { useState } from 'react';
import { useI18n } from './i18n/index.jsx';
import Header from './components/Header';
import UrlInput from './components/UrlInput';
import VideoPreview from './components/VideoPreview';
import QualitySelector from './components/QualitySelector';
import DownloadButton from './components/DownloadButton';
import Features from './components/Features';
import Footer from './components/Footer';

const API_BASE = '';

export default function App() {
  const { t } = useI18n();
  const [step, setStep] = useState('input'); // input | loading | result
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAnalyze = async (inputUrl) => {
    setUrl(inputUrl);
    setError('');
    setSuccess('');
    setStep('loading');
    setVideoInfo(null);
    setSelectedFormat(null);

    try {
      const response = await fetch(`${API_BASE}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t.errorGeneric);
      }

      setVideoInfo(data);

      // Auto-select best quality
      if (data.formats && data.formats.length > 0) {
        setSelectedFormat(data.formats[0]);
      }

      setStep('result');
    } catch (err) {
      setError(err.message || t.errorGeneric);
      setStep('input');
    }
  };

  const handleDownload = async () => {
    if (!selectedFormat || !url) return;

    setDownloading(true);
    setError('');
    setSuccess('');

    try {
      const isAudio = selectedFormat.format_id === 'audio';
      const params = new URLSearchParams({
        url,
        format_id: selectedFormat.format_id,
        quality: isAudio ? 'audio' : 'video',
        title: videoInfo?.title || 'vidrop-video',
      });

      // Direct download via backend (bypass Vite proxy for large files)
      const downloadUrl = `http://localhost:3001/api/download?${params}`;
      
      // Use a hidden anchor tag for direct download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = '';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Clean up after a moment
      setTimeout(() => {
        document.body.removeChild(a);
      }, 1000);

      // Show success after a brief delay (download starts in background)
      setTimeout(() => {
        setSuccess(t.downloadStarted);
        setDownloading(false);
      }, 2000);
    } catch (err) {
      setError(err.message || t.errorDownload);
      setDownloading(false);
    }
  };

  const handleBack = () => {
    setStep('input');
    setVideoInfo(null);
    setSelectedFormat(null);
    setError('');
    setSuccess('');
  };

  return (
    <div className="app">
      <Header />

      <main className="app-main">
        {step === 'input' && (
          <>
            <section className="hero">
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                {t.heroBadge}
              </div>
              <h1>
                {t.heroTitle1} <span className="gradient-text">{t.heroTitleGradient}</span> {t.heroTitle2}
              </h1>
              <p className="hero-subtitle">
                {t.heroSubtitle}
              </p>
              <div className="hero-platforms">
                <span className="platform-chip youtube">▶ YouTube</span>
                <span className="platform-chip instagram">📷 Instagram</span>
              </div>
            </section>

            <UrlInput onSubmit={handleAnalyze} loading={false} />

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            <Features />
          </>
        )}

        {step === 'loading' && (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p className="loading-text">{t.loadingText}</p>
          </div>
        )}

        {step === 'result' && videoInfo && (
          <>
            <button className="back-btn" onClick={handleBack}>
              {t.backBtn}
            </button>

            <VideoPreview videoInfo={videoInfo} />

            <QualitySelector
              formats={videoInfo.formats}
              selectedFormat={selectedFormat}
              onSelect={setSelectedFormat}
            />

            <DownloadButton
              onDownload={handleDownload}
              downloading={downloading}
              selectedFormat={selectedFormat}
            />

            {error && (
              <div className="error-message" style={{ marginTop: '1rem' }}>
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div className="success-message" style={{ marginTop: '1rem' }}>
                {success}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
