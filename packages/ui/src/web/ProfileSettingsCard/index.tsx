import React, { useState, useRef } from 'react';
import styles from './ProfileSettingsCard.module.css';

export interface ProfileData {
  nickname: string;
  avatarUrl?: string;
}

export interface ProfileSettingsCardProps {
  profile: ProfileData;
  onSave: (data: ProfileData) => void;
}

export const ProfileSettingsCard: React.FC<ProfileSettingsCardProps> = ({
  profile,
  onSave
}) => {
  const [inEditAvatar, setInEditAvatar] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  
  // 裁剪属性
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cropBox, setCropBox] = useState({ x: 0, y: 0, size: 200 }); // 正方形裁剪框
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 });

  // 触发选图
  const handleTriggerPick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          setTempImageSrc(ev.target.result);
          setInEditAvatar(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Image 加载入图并居中裁剪框
  const handleImageLoad = () => {
    if (!imageRef.current) return;
    const { naturalWidth, naturalHeight } = imageRef.current;
    const initSize = Math.min(naturalWidth, naturalHeight, 300); // 适度初始大小
    setCropBox({
      x: (naturalWidth - initSize) / 2,
      y: (naturalHeight - initSize) / 2,
      size: initSize
    });
  };

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartPos.current = {
      x: clientX,
      y: clientY,
      cropX: cropBox.x,
      cropY: cropBox.y
    };
  };

  const onDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !imageRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - dragStartPos.current.x;
    const dy = clientY - dragStartPos.current.y;

    // 因为渲染尺度和实际尺度的比例，如果不计算会漂移。为了最简化：
    // 我们假设 Image 渲染了 100% 宽度，我们需要计算缩放比率
    const renderedWidth = imageRef.current.clientWidth;
    const scale = imageRef.current.naturalWidth / renderedWidth;

    let newX = dragStartPos.current.cropX + dx * scale;
    let newY = dragStartPos.current.cropY + dy * scale;

    // 边界限制
    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX + cropBox.size > imageRef.current.naturalWidth) newX = imageRef.current.naturalWidth - cropBox.size;
    if (newY + cropBox.size > imageRef.current.naturalHeight) newY = imageRef.current.naturalHeight - cropBox.size;

    setCropBox(prev => ({ ...prev, x: newX, y: newY }));
  };

  const stopDrag = () => {
    setIsDragging(false);
  };

  // 完成裁剪，生成 Canvas 结果
  const finishCrop = () => {
    if (!imageRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 256;
    canvas.height = 256;
    
    // 清空重绘，并把 cropBox 区域绘制进 256x256
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(
      imageRef.current,
      cropBox.x, cropBox.y, cropBox.size, cropBox.size,
      0, 0, 256, 256
    );

    const dataUrl = canvas.toDataURL('image/png');
    onSave({ ...profile, avatarUrl: dataUrl });
    
    setInEditAvatar(false);
    setTempImageSrc(null);
  };

  const cancelCrop = () => {
    setInEditAvatar(false);
    setTempImageSrc(null);
  };

  // 编辑昵称
  const handleEditNickname = () => {
    const nextName = window.prompt("修改您的大使称呼：", profile.nickname);
    if (nextName && nextName.trim() !== '' && nextName !== profile.nickname) {
      onSave({ ...profile, nickname: nextName.trim() });
    }
  };

  return (
    <>
      <div className={styles.cardContainer}>
        <div className={styles.avatarZone} onClick={handleTriggerPick}>
           {profile.avatarUrl ? (
             <img className={styles.avatarImg} src={profile.avatarUrl} alt="avatar" />
           ) : (
             <div className={styles.avatarFallback}>
               {profile.nickname.charAt(0).toUpperCase() || 'A'}
             </div>
           )}
           <div className={styles.avatarHover}>
              📷
           </div>
           <input 
             type="file" 
             accept="image/*" 
             ref={fileInputRef} 
             style={{ display: 'none' }} 
             onChange={handleFileChange} 
           />
        </div>

        <div className={styles.infoZone}>
           <div className={styles.nameRow}>
             <h2 className={styles.nickname}>{profile.nickname}</h2>
             <button className={styles.editBtn} onClick={handleEditNickname} title="修改昵称">
               ✎
             </button>
           </div>
           <p className={styles.desc}>点击左侧头像可更改全息投射的电子样貌，支持自定义图片裁剪。</p>
        </div>
      </div>

      {inEditAvatar && tempImageSrc && (
        <div className={styles.cropOverlay}>
           <div className={styles.cropModal}>
              <h3 className={styles.cropTitle}>剪裁实体切片</h3>
              <div 
                className={styles.imageWorkspace}
                onMouseMove={onDrag}
                onMouseUp={stopDrag}
                onMouseLeave={stopDrag}
                onTouchMove={onDrag}
                onTouchEnd={stopDrag}
              >
                 <img 
                   src={tempImageSrc} 
                   alt="source" 
                   className={styles.sourceImg}
                   ref={imageRef} 
                   onLoad={handleImageLoad}
                 />
                 
                 {/* 蒙版框，简单利用边框模拟位置，不阻挡事件 */}
                 {imageRef.current && (
                   <div 
                     className={styles.selectionBox}
                     onMouseDown={startDrag}
                     onTouchStart={startDrag}
                     style={{
                        // 计算基于 renderedWidth 在窗口里的百分比或实际占比的 left/top
                        // 为了简单视觉化，这里仅展示基于 scale 的渲染计算
                        left: `${(cropBox.x / imageRef.current.naturalWidth) * 100}%`,
                        top: `${(cropBox.y / imageRef.current.naturalHeight) * 100}%`,
                        width: `${(cropBox.size / imageRef.current.naturalWidth) * 100}%`,
                        height: `${(cropBox.size / imageRef.current.naturalHeight) * 100}%`,
                     }}
                   >
                      <div className={styles.gridLines}></div>
                   </div>
                 )}
              </div>
              <div className={styles.cropActions}>
                 <button className={styles.cancelBtn} onClick={cancelCrop}>舍弃并中止</button>
                 <button className={styles.confirmBtn} onClick={finishCrop}>✅ 固定影像印记</button>
              </div>
           </div>
           {/* 隐藏画板 */}
           <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}
    </>
  );
};
