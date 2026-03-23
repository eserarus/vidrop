import { useI18n } from '../i18n/index.jsx';

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="footer">
      <p className="footer-text">
        <span className="brand">ViDrop</span> — {t.footerText} &copy; {new Date().getFullYear()}
      </p>
    </footer>
  );
}
