import { useEffect, type FC } from 'react';
import { initLenisScroll } from '../scripts/lenisScroll';
import ThemeScene from '../components/ThemeScene';
import Header from '../components/Header';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Principles from '../components/Principles';
import Origin from '../components/Origin';
import Mascot from '../components/Mascot';
import People from '../components/People';
import SiteFooter from '../components/SiteFooter';
import CommunityModal from '../components/CommunityModal';
import DownloadPopup from '../components/DownloadPopup';

export const HomePage: FC = () => {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal');
    let observer: IntersectionObserver | null = null;

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px' },
      );
      els.forEach((el) => observer?.observe(el));
    } else {
      els.forEach((el) => el.classList.add('is-visible'));
    }

    const dots = Array.from(
      document.querySelectorAll<HTMLElement>('[data-snap-dot]'),
    );
    const links = document.querySelectorAll<HTMLElement>('[data-nav-link]');

    const setActive = (id: string) => {
      const activeIdx = dots.findIndex((dot) => dot.dataset.snapDot === id);
      dots.forEach((dot, idx) => {
        const isActive = dot.dataset.snapDot === id;
        const isPassed = activeIdx > -1 && idx < activeIdx;
        dot.classList.toggle('is-active', isActive);
        dot.classList.toggle('is-passed', isPassed);
        if (isActive) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });
      links.forEach((link) => {
        link.classList.toggle('is-active', link.dataset.navLink === id);
      });
    };

    const cleanupLenis = initLenisScroll(setActive);

    return () => {
      observer?.disconnect();
      cleanupLenis();
    };
  }, []);

  return (
    <>
      <ThemeScene />
      <div className="bg-overlay" aria-hidden="true" />
      <Header snapDots={true} />
      <main className="snap-root">
        <Hero />
        <Features />
        <Principles />
        <Origin />
        <Mascot />
        <People />
      </main>
      <SiteFooter />
      <CommunityModal />
      <DownloadPopup />
    </>
  );
};

export default HomePage;
