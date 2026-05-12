import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Determine the default route based on Sidebar preferences if needed,
    // otherwise default to Diary.
    const saved = localStorage.getItem('desktop_sidebar_nav_order');
    let defaultRoute = '/diary';
    if (saved) {
      try {
        const order = JSON.parse(saved);
        // 只处理主路由，不处理 settings 子路由
        if (order[0] === 'summary') defaultRoute = '/summary';
        else if (order[0] === 'lan') defaultRoute = '/lan-transfer';
        else if (order[0] === 'sync') defaultRoute = '/data-sync';
      } catch (e) {}
    }
    navigate(defaultRoute, { replace: true });
  }, [navigate]);

  return <div />;
};
