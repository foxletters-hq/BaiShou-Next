import React from 'react';
import './TimelineNode.css';

interface TimelineNodeProps {
  children: React.ReactNode;
  isLast?: boolean;
  isFirst?: boolean;
}

export const TimelineNode: React.FC<TimelineNodeProps> = ({ children, isLast, isFirst: _isFirst }) => {
  return (
    <div className="timeline-node-v2">
      <div className="timeline-track-v2">
        {!isLast && <div className="timeline-line-v2" />}
        <div className="timeline-indicator-v2" />
      </div>
      <div className="timeline-content-v2">
        {children}
      </div>
    </div>
  );
};
