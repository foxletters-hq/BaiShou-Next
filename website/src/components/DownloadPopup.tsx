import { useEffect, useRef, useState, type FC } from 'react';
import buildDataRaw from '../generated/build-data.json';
import {
  DOWNLOAD_URLS,
  formatReleaseVersion,
  RELEASE_CHANNEL_MANIFEST_URLS,
  type ReleaseChannelManifest,
  type ResolvedDownloads,
} from '../data/site';
import { useApp } from '../context/AppContext';

const PANEL_MS = 380;

const initialDownloads: ResolvedDownloads = (
  buildDataRaw as { downloads?: ResolvedDownloads }
).downloads ?? {
  android: { url: DOWNLOAD_URLS.android },
  windows: { url: DOWNLOAD_URLS.windows },
};

async function fetchLatestDownloads(): Promise<ResolvedDownloads | null> {
  for (const manifestUrl of RELEASE_CHANNEL_MANIFEST_URLS) {
    try {
      const res = await fetch(manifestUrl, {
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const data = (await res.json()) as ReleaseChannelManifest;
      return {
        android: {
          url: data.android?.downloadUrl ?? DOWNLOAD_URLS.android,
          version: data.android?.version,
        },
        windows: {
          url: data.windows?.downloadUrl ?? DOWNLOAD_URLS.windows,
          version: data.windows?.version,
        },
      };
    } catch {
      // 主源不可达时自动回退至备用源
    }
  }
  return null;
}

interface DownloadGridProps {
  downloads: ResolvedDownloads;
  windowsLabel: string;
  androidLabel: string;
}

const DownloadGrid: FC<DownloadGridProps> = ({
  downloads,
  windowsLabel,
  androidLabel,
}) => {
  const windowsVersion = formatReleaseVersion(downloads.windows.version);
  const androidVersion = formatReleaseVersion(downloads.android.version);

  return (
    <div className="dl-popup-grid">
      <a
        href={downloads.windows.url}
        className="dl-popup-card"
        data-dl-windows
        download={
          downloads.windows.url.includes('/releases/download/')
            ? 'BaiShou-Windows-Setup.exe'
            : undefined
        }
      >
        <span className="dl-popup-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
          </svg>
        </span>
        <span className="dl-popup-label" data-i18n="download.windows">
          {windowsLabel}
        </span>
        <span
          className="dl-popup-size"
          data-dl-windows-version
          hidden={!windowsVersion}
        >
          {windowsVersion}
        </span>
      </a>

      <a
        href={downloads.android.url}
        className="dl-popup-card"
        data-dl-android
        download={
          downloads.android.url.includes('/releases/download/')
            ? 'BaiShou-Android.apk'
            : undefined
        }
      >
        <span className="dl-popup-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M17.523 15.341a.997.997 0 0 0 0-1.994.997.997 0 0 0 0 1.994m-11.046 0a.997.997 0 0 0 0-1.994.997.997 0 0 0 0 1.994m11.405-6.02l1.997-3.46a.416.416 0 0 0-.152-.567.416.416 0 0 0-.568.152L17.112 8.95a12.14 12.14 0 0 0-5.112-1.116 12.14 12.14 0 0 0-5.112 1.116L4.84 5.446a.416.416 0 0 0-.568-.152.416.416 0 0 0-.152.567l1.997 3.46C2.688 11.186.344 14.663 0 18.766h24c-.344-4.103-2.688-7.58-6.118-9.445" />
          </svg>
        </span>
        <span className="dl-popup-label" data-i18n="download.android">
          {androidLabel}
        </span>
        <span
          className="dl-popup-size"
          data-dl-android-version
          hidden={!androidVersion}
        >
          {androidVersion}
        </span>
      </a>
    </div>
  );
};

export const DownloadPopup: FC = () => {
  const { dict, isDownloadOpen, closeDownloadModal } = useApp();
  const [downloads, setDownloads] =
    useState<ResolvedDownloads>(initialDownloads);
  const [rendered, setRendered] = useState(false);
  const [openClass, setOpenClass] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void fetchLatestDownloads().then((next) => {
      if (next) setDownloads(next);
    });
  }, []);

  useEffect(() => {
    if (isDownloadOpen) {
      void fetchLatestDownloads().then((next) => {
        if (next) setDownloads(next);
      });
      setRendered(true);
      document.documentElement.classList.add('modal-open');
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOpenClass(true);
          closeBtnRef.current?.focus();
        });
      });
      return () => cancelAnimationFrame(raf);
    }

    setOpenClass(false);
    document.documentElement.classList.remove('modal-open');
    const timer = window.setTimeout(() => {
      setRendered(false);
    }, PANEL_MS + 40);
    return () => window.clearTimeout(timer);
  }, [isDownloadOpen]);

  useEffect(() => {
    if (!isDownloadOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDownloadModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDownloadOpen, closeDownloadModal]);

  return (
    <div
      className={['dl-popup', openClass && 'is-open'].filter(Boolean).join(' ')}
      data-dl-popup
      hidden={!rendered}
      aria-hidden={!isDownloadOpen}
    >
      <div
        className="dl-popup-backdrop"
        data-dl-close
        tabIndex={-1}
        onClick={closeDownloadModal}
      />

      <div
        className="dl-popup-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dl-popup-title"
        data-lenis-prevent
      >
        <button
          ref={closeBtnRef}
          type="button"
          className="dl-popup-close"
          data-dl-close
          aria-label={dict.download.closeAria}
          data-i18n-aria-label="download.closeAria"
          onClick={closeDownloadModal}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <header className="dl-popup-header">
          <h2 id="dl-popup-title" data-i18n="download.title">
            {dict.download.title}
          </h2>
          <p className="dl-popup-lead" data-i18n="download.lead">
            {dict.download.lead}
          </p>
        </header>

        <DownloadGrid
          downloads={downloads}
          windowsLabel={dict.download.windows}
          androidLabel={dict.download.android}
        />
      </div>
    </div>
  );
};

export default DownloadPopup;
