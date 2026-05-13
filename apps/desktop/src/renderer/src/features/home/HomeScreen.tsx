import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  
   useEffect(() => {
    const saved = localStorage.getItem('desktop_sidebar_nav_order');
    let defaultRoute = '/diary';
    if (saved) {
      try {
        const order = JSON.parse(saved);
        if (order.length > 0) {
          const paths: Record<string, string> = {
            diary: '/diary', summary: '/summary', lan: '/lan-transfer', sync: '/data-sync', git: '/git',
          };
          defaultRoute = paths[order[0]] || '/diary';
        }
      } catch (e) {}
    }
    navigate(defaultRoute, { replace: true });
  }, [navigate]);

  return <div />;
};
