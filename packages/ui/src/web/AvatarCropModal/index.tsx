import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './cropImage';
import styles from './AvatarCropModal.module.css';

export interface AvatarCropModalProps {
  imageSrc: string;
  onCanceled: () => void;
  onCropped: (croppedImageBase64OrURL: string) => void;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({ imageSrc, onCanceled, onCropped }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixelsVal: any) => {
    setCroppedAreaPixels(croppedAreaPixelsVal);
  }, []);

  const handleConfirm = async () => {
    try {
      if (!croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
      onCropped(croppedImage);
    } catch (e) {
      console.error('Crop Error', e);
      onCanceled();
    }
  };

  const modalRender = (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.cropperContainer}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="rect"
            showGrid={true}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            style={{
              cropAreaStyle: {
                border: '2px dashed var(--color-primary)',
              }
            }}
          />
        </div>
        
        <div className={styles.controls}>
          <div className={styles.sliderGroup}>
            <label>缩放</label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.05}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>
          
          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onCanceled}>取消</button>
            <button className={styles.confirmBtn} onClick={handleConfirm}>保存裁剪</button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalRender, document.body);
};
