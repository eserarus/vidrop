import { useState } from 'react';
import { useI18n } from './i18n/index.jsx';
import Header from './components/Header';
import UrlInput from './components/UrlInput';
import VideoPreview from './components/VideoPreview';
import QualitySelector from './components/QualitySelector';
import DownloadButton from './components/DownloadButton';
import Features from './components/Features';
import Footer from './components/Footer';

// Auto-detect: localhost uses Express backend on port 3001, Vercel uses serverless /api/
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? '' : '';
const DOWNLOAD_BASE = isLocal ? 'http://localhost:3001' : '';

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

      if (!response.ok) {
        let errorMsg = t.errorGeneric;
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch { /* response wasn't JSON */ }
        throw new Error(errorMsg);
      }

      const data = await response.json();
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

      if (isLocal) {
        // Local: download via Express backend (yt-dlp)
        const params = new URLSearchParams({
          url,
          format_id: selectedFormat.format_id,
          quality: isAudio ? 'audio' : 'video',
          title: videoInfo?.title || 'vidrop-video',
        });
        if (videoInfo?.videoUrl) params.set('videoUrl', videoInfo.videoUrl);

        const downloadUrl = `http://localhost:3001/api/download?${params}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = '';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 1000);
      } else {
        // Vercel: prefer direct CDN URL from info response
        let directUrl = selectedFormat.downloadUrl || videoInfo?.bestDownloadUrl || videoInfo?.videoUrl;
        
        // Fallback: call download API if direct URL not available
        if (!directUrl) {
          const params = new URLSearchParams({
            url,
            format_id: selectedFormat.format_id,
            quality: isAudio ? 'audio' : 'video',
          });
          if (videoInfo?.videoUrl) params.set('videoUrl', videoInfo.videoUrl);
          
          const response = await fetch(`/api/download?${params}`);
          if (response.ok) {
            const data = await response.json();
            directUrl = data.downloadUrl;
          }
        }

        if (!directUrl) {
          throw new Error(t.errorDownload);
        }

        window.open(directUrl, '_blank');
      }

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
