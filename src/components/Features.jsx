import { useI18n } from '../i18n/index.jsx';

export default function Features() {
  const { t } = useI18n();

  const features = [
    {
      icon: '⚡',
      iconClass: 'violet',
      title: t.feature1Title,
      description: t.feature1Desc,
    },
    {
      icon: '🎬',
      iconClass: 'cyan',
      title: t.feature2Title,
      description: t.feature2Desc,
    },
    {
      icon: '🔒',
      iconClass: 'emerald',
      title: t.feature3Title,
      description: t.feature3Desc,
    },
    {
      icon: '🎵',
      iconClass: 'rose',
      title: t.feature4Title,
      description: t.feature4Desc,
    },
  ];

  return (
    <section className="features">
      <h2 className="features-title">{t.featuresTitle}</h2>
      <p className="features-subtitle">{t.featuresSubtitle}</p>
      <div className="features-grid">
        {features.map((feature, i) => (
          <div
            className="feature-card"
            key={i}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className={`feature-icon ${feature.iconClass}`}>
              {feature.icon}
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
