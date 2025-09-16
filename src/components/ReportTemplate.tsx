import React, { useEffect, useRef, useState } from 'react';
import type { ReportData } from '../types';
import { loadAndProcessSVG } from '../utils/svgUtils';

interface ReportTemplateProps {
  data: ReportData;
  className?: string;
  onLoad?: () => void;
}

export const ReportTemplate: React.FC<ReportTemplateProps> = ({ 
  data, 
  className = '',
  onLoad 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    const loadSVG = async () => {
      try {
        const svgText = await loadAndProcessSVG(data);
        setSvgContent(svgText);
        onLoad?.();
      } catch (error) {
        console.error('Error loading SVG template:', error);
      }
    };

    loadSVG();
  }, [data, onLoad]);

  if (!svgContent) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  return (
      <div 
        ref={containerRef}
        className={`bg-white ${className}`}
        style={{ 
          width: '595px', 
          height: '842px',
          aspectRatio: '595/842'
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: svgContent }}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />
      </div>
  );
};

export default ReportTemplate;
