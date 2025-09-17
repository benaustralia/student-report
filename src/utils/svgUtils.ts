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

    // Handle artwork image if provided
    if (data.artwork && data.artwork.trim()) {
      // Convert Google Drive URL to direct image URL if needed
      const imageUrl = convertGoogleDriveUrl(data.artwork);
      
      // Add image element to SVG
      const imageElement = `<image id="artwork" href="${imageUrl}" x="50" y="400" width="100" height="100" preserveAspectRatio="xMidYMid meet" />`;
      
      // Insert image before the closing </svg> tag
      svgText = svgText.replace('</svg>', `${imageElement}\n</svg>`);
    }

    return svgText;
  } catch (error) {
    console.error('Error loading SVG template:', error);
    throw new Error('Failed to load SVG template');
  }
};

// Helper function to convert Google Drive URLs to direct image URLs
function convertGoogleDriveUrl(url: string): string {
  // If it's already a direct image URL, return as is
  if (url.includes('drive.google.com/file/d/')) {
    // Extract file ID from Google Drive URL
    const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      const fileId = match[1];
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
  }
  
  // If it's already a direct image URL or other format, return as is
  return url;
}

