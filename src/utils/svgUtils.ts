import type { ReportData } from '../types';

export const loadAndProcessSVG = async (data: ReportData): Promise<string> => {
  try {
    // Import the SVG template as raw text
    const svgModule = await import('../assets/report-template.svg?raw');
    let svgText = svgModule.default;

    // Replace the placeholder text content with actual data
    svgText = svgText.replace(
      /<text id="student-name"[^>]*><tspan[^>]*><\/tspan><\/text>/,
      `<text id="student-name" class="st5" transform="translate(200 235.52)"><tspan x="0" y="0">${data.studentName}</tspan></text>`
    );
    
    svgText = svgText.replace(
      /<text id="class-level"[^>]*><tspan[^>]*><\/tspan><\/text>/,
      `<text id="class-level" class="st5" transform="translate(200 263.47)"><tspan x="0" y="0">${data.classLevel}</tspan></text>`
    );
    
    svgText = svgText.replace(
      /<text id="class-location"[^>]*><tspan[^>]*><\/tspan><\/text>/,
      `<text id="class-location" class="st5" transform="translate(220 291.42)"><tspan x="0" y="0">${data.classLocation}</tspan></text>`
    );
    
    svgText = svgText.replace(
      /<text id="comments"[^>]*><tspan[^>]*><\/tspan><\/text>/,
      `<text id="comments" class="st5" transform="translate(200 536.37)"><tspan x="0" y="0">${data.comments}</tspan></text>`
    );
    
    svgText = svgText.replace(
      /<text id="teacher"[^>]*><tspan[^>]*><\/tspan><\/text>/,
      `<text id="teacher" class="st6" transform="translate(340 728.88)"><tspan x="0" y="0">${data.teacher}</tspan></text>`
    );
    
    svgText = svgText.replace(
      /<text id="date"[^>]*><tspan[^>]*><\/tspan><\/text>/,
      `<text id="date" class="st6" transform="translate(340 746.74)"><tspan x="0" y="0">${data.date || new Date().toLocaleDateString()}</tspan></text>`
    );

    return svgText;
  } catch (error) {
    console.error('Error loading SVG template:', error);
    throw new Error('Failed to load SVG template');
  }
};

