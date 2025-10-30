export function wrapTextWithNotoSans(text: string, maxPixelWidth: number): string[] {
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return [text];
  measureCtx.font = '11px "Noto Sans SC", Arial, sans-serif';
  if (measureCtx.measureText(text).width <= maxPixelWidth) return [text];
  return wrapTextByWidth(text, maxPixelWidth, measureCtx);
}

export function wrapTextByWidth(text: string, maxPixelWidth: number, measureCtx: CanvasRenderingContext2D): string[] {
  const lines: string[] = [];
  let currentLine = '';
  const tokens = text.split(/(\s+|[。！？，、；：]|[.!?])/);
  for (const token of tokens) {
    if (!token) continue;
    const testLine = currentLine + token;
    const testWidth = measureCtx.measureText(testLine).width;
    if (testWidth > maxPixelWidth) {
      if (currentLine.length > 0) {
        const trimmedLine = currentLine.trim();
        const punctuationMarks = ['.', '。', '!', '！', '?', '？', ',', '，', ';', '；', ':', '：'];
        const endsWithPunctuation = punctuationMarks.some(mark => trimmedLine.endsWith(mark));
        if (endsWithPunctuation) {
          lines.push(currentLine.trim());
          currentLine = token;
        } else {
          lines.push(currentLine.trim());
          currentLine = token;
        }
      } else {
        if (measureCtx.measureText(token).width > maxPixelWidth) {
          let tempLine = '';
          for (const char of token) {
            const testCharLine = tempLine + char;
            if (measureCtx.measureText(testCharLine).width > maxPixelWidth) {
              if (tempLine.length > 0) { lines.push(tempLine); tempLine = char; }
              else { lines.push(char); }
            } else { tempLine += char; }
          }
          currentLine = tempLine;
        } else { currentLine = token; }
      }
    } else { currentLine += token; }
  }
  if (currentLine.length > 0) lines.push(currentLine.trim());
  return lines;
}
