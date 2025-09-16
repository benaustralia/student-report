let fontBase64: string | null = null;

export const loadBrushATFFont = async (): Promise<string> => {
  if (fontBase64) {
    console.log('BrushATF-Book font already loaded');
    return fontBase64;
  }

  try {
    console.log('Loading BrushATF-Book font...');
    // Load the font file
    const fontResponse = await fetch('/BrushATF-Book.ttf');
    if (!fontResponse.ok) {
      throw new Error(`Failed to fetch font: ${fontResponse.status}`);
    }
    const fontArrayBuffer = await fontResponse.arrayBuffer();
    
    // Convert to base64
    fontBase64 = btoa(String.fromCharCode(...new Uint8Array(fontArrayBuffer)));
    console.log('Font base64 length:', fontBase64.length);
    
    console.log('BrushATF-Book font loaded successfully');
    return fontBase64;
  } catch (error) {
    console.error('Failed to load BrushATF-Book font:', error);
    console.warn('Falling back to default font');
    throw error;
  }
};

