// Utility to lazy load Chinese font only when Chinese characters are detected
// This saves ~60KB on initial page load

let fontLoaded = false;

export function loadChineseFontIfNeeded(): void {
  if (fontLoaded) return;

  // Check if page contains Chinese characters
  const hasChineseText = /[\u4e00-\u9fff]/.test(document.body.textContent || '');
  
  if (hasChineseText) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap';
    link.media = 'print';
    link.onload = function() {
      (this as HTMLLinkElement).media = 'all';
    };
    document.head.appendChild(link);
    fontLoaded = true;
  }
}

// Auto-detect on DOM ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadChineseFontIfNeeded);
  } else {
    loadChineseFontIfNeeded();
  }
}

