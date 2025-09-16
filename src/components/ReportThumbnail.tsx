import React, { useEffect, useState } from 'react';
import type { ReportData } from '../types';
import { loadAndProcessSVG } from '../utils/svgUtils';

interface ReportThumbnailProps {
  data: ReportData;
  className?: string;
  onClick?: () => void;
}

export const ReportThumbnail: React.FC<ReportThumbnailProps> = ({ 
  data, 
  className = '',
  onClick 
}) => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSVG = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const svgText = await loadAndProcessSVG(data);
        // Modify the SVG for thumbnail display
        const modifiedSvg = svgText
          .replace('viewBox="0 0 595.28 841.89"', 'viewBox="0 0 595.28 841.89"')
          .replace('width="595.28"', 'width="100%"')
          .replace('height="841.89"', 'height="100%"')
          .replace('<svg id="Layer_1"', '<svg id="Layer_1" style="width: 100%; height: 100%; max-width: 100%; max-height: 100%;"');
        
        setSvgContent(modifiedSvg);
      } catch (err) {
        console.error('Error loading SVG template:', err);
        setError('Failed to load template');
      } finally {
        setIsLoading(false);
      }
    };

    loadSVG();
  }, [data]);

  if (isLoading) {
    return (
      <div 
        className={`aspect-[8.5/11] bg-muted rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors ${className}`}
        onClick={onClick}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <span className="text-xs text-muted-foreground">Generating preview...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={`aspect-[8.5/11] bg-muted rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors ${className}`}
        onClick={onClick}
      >
        <div className="text-center">
          <div className="text-2xl mb-2">📄</div>
          <span className="text-xs text-muted-foreground">Preview unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`bg-white rounded border-2 border-dashed border-border cursor-pointer hover:bg-muted/80 transition-colors ${className}`}
      onClick={onClick}
      style={{ 
        aspectRatio: '8.5/11',
        display: 'grid',
        gridTemplateRows: '1fr',
        gridTemplateColumns: '1fr',
        padding: '8px'
      }}
    >
      <div
        dangerouslySetInnerHTML={{ __html: svgContent }}
        className="overflow-hidden rounded"
        style={{
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0
        }}
      />
    </div>
  );
};

export default ReportThumbnail;
