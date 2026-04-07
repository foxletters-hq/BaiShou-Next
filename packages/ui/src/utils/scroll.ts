/**
 * 使用自定义时长和平滑曲线，将目标元素滚动到其容器的正中间
 * 解决浏览器原生 scrollIntoView(smooth) 速度不可控且部分场景不够平滑的问题。
 */
export function smoothScrollToCenter(container: HTMLElement, target: HTMLElement, duration: number = 600) {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  
  // 计算目标中心与容器中心的偏差
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const containerCenterY = containerRect.top + containerRect.height / 2;
  
  const start = container.scrollTop;
  const end = start + (targetCenterY - containerCenterY);
  const change = end - start;
  const startTime = performance.now();

  // 如果距离极小，直接忽略
  if (Math.abs(change) < 2) return;

  // 如果时长指定为0，直接瞬间滚动到位
  if (duration <= 0) {
    container.scrollTop = end;
    return;
  }

  function animateScroll(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease-out Quartic: 起步稍快，结尾极其平缓，带来丝滑“刹车”体验
    const ease = 1 - Math.pow(1 - progress, 4);
      
    container.scrollTop = start + change * ease;
    if (progress < 1) {
      requestAnimationFrame(animateScroll);
    }
  }
  requestAnimationFrame(animateScroll);
}
