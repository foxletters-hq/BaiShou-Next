import React from 'react';
import styles from './DiaryMetaCard.module.css';

interface DiaryMeta {
  weather: string;
  temperature: string;
  location: string;
  emotion: string; // e.g. "😀", "😢"
}

interface DiaryMetaCardProps {
  meta: DiaryMeta;
}

export const DiaryMetaCard: React.FC<DiaryMetaCardProps> = ({ meta }) => {
  return (
    <div className={styles.card}>
       <div className={styles.emotionCircle}>
          {meta.emotion}
       </div>
       <div className={styles.infoCol}>
          <div className={styles.weatherLine}>
             <span className={styles.weatherIcon}>⛅</span>
             <span>{meta.weather} • {meta.temperature}</span>
          </div>
          <div className={styles.locationLine}>
             <span className={styles.locationIcon}>📍</span>
             <span>{meta.location}</span>
          </div>
       </div>
    </div>
  );
};
