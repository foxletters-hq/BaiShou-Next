import React, { InputHTMLAttributes } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  labelOn?: string;
  labelOff?: string;
}

export const Switch: React.FC<SwitchProps> = ({ labelOn, labelOff, className = '', ...props }) => {
  return (
    <label className={`${styles.root} ${className}`.trim()}>
      <input type="checkbox" className={styles.input} {...props} />
      <div className={styles.track}>
        <div className={styles.thumb}>
          {labelOn && <span className={styles.labelOn}>{labelOn}</span>}
          {labelOff && <span className={styles.labelOff}>{labelOff}</span>}
        </div>
      </div>
    </label>
  );
};
