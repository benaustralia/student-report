import { useEffect, useRef, useState } from 'react';
import reportTemplateSvg from '@/assets/report-template.svg?url';
import { fetchSvgTemplate, injectReportIntoSvg, convertUrlToDataUrl } from '@/services/reportSvg';

interface ReportTemplateProps { studentName: string; classLevel: string; classLocation: string; comments: string; teacher: string; date: string; artwork?: string; }

export function ReportTemplate({ studentName, classLevel, classLocation, comments, teacher, date, artwork }: ReportTemplateProps) {
  const svgRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ processedSvg: '', isLoading: true });

  // helpers moved to services/reportSvg

  useEffect(() => {
    const processSvgTemplate = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true }));
        const svgText = await fetchSvgTemplate(reportTemplateSvg);
        const artworkDataUrl = artwork ? await convertUrlToDataUrl(artwork) : undefined;
        const processed = injectReportIntoSvg(svgText, {
          studentName,
          classLevel,
          classLocation,
          teacherName: teacher,
          date,
          reportText: comments,
          artworkDataUrl
        });
        setState(prev => ({ ...prev, processedSvg: processed }));
      } catch (error) {
        console.error('Error processing SVG template:', error);
        const fallback = await fetchSvgTemplate(reportTemplateSvg);
        setState(prev => ({ ...prev, processedSvg: fallback }));
      } finally {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };
    processSvgTemplate();
  }, [studentName, classLevel, classLocation, comments, teacher, date, artwork]);


  return state.isLoading ? (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span className="ml-2 text-sm">Loading...</span>
    </div>
  ) : (
    <div 
      ref={svgRef} 
      className="w-full h-full overflow-auto flex items-start justify-center"
      dangerouslySetInnerHTML={{ __html: state.processedSvg }} 
    />
  );
}

export default ReportTemplate;
