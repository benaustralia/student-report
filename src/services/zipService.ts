import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { ReportData } from './pdfService';
import { loadAndProcessSVG } from '../utils/svgUtils';
import { loadBrushATFFont } from './fontService';

export interface ClassReport {
  studentName: string;
  classLevel: string;
  classLocation: string;
  comments: string;
  teacher: string;
  date?: string;
}

export const generateClassZIP = async (
  classReports: ClassReport[],
  className: string,
  teacherName: string
): Promise<void> => {
  try {
    const zip = new JSZip();
    
    // Create a folder for this class
    const folderName = `${teacherName.replace(/\s+/g, '_')}_${className.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const classFolder = zip.folder(folderName);
    
    if (!classFolder) {
      throw new Error('Failed to create ZIP folder');
    }

    // Generate PDFs for each student and add to ZIP
    const pdfPromises = classReports.map(async (report) => {
      try {
        // Generate vector PDF data
        const pdfData = await generateVectorPDFData(report);
        
        // Add PDF to ZIP
        const fileName = `${report.studentName.replace(/\s+/g, '_')}_Report.pdf`;
        classFolder.file(fileName, pdfData, { binary: true });
        
        return { success: true, student: report.studentName };
      } catch (error) {
        console.error(`Error generating PDF for ${report.studentName}:`, error);
        return { success: false, student: report.studentName, error };
      }
    });

    // Wait for all PDFs to be generated
    const results = await Promise.all(pdfPromises);
    
    // Check if any PDFs were successfully generated
    const successfulReports = results.filter(r => r.success);
    if (successfulReports.length === 0) {
      throw new Error('No PDFs could be generated');
    }

    // Generate ZIP file
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // Download the ZIP file
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${folderName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Show success message
    const failedCount = results.length - successfulReports.length;
    if (failedCount > 0) {
      alert(`ZIP created with ${successfulReports.length} reports. ${failedCount} reports failed to generate.`);
    } else {
      alert(`ZIP created successfully with ${successfulReports.length} reports!`);
    }

  } catch (error) {
    console.error('Error generating ZIP:', error);
    throw new Error('Failed to generate ZIP file');
  }
};

const generateVectorPDFData = async (reportData: ReportData): Promise<Uint8Array> => {
  // Load the BrushATF-Book font first
  const fontBase64 = await loadBrushATFFont();
  
  // Get the processed SVG content
  const svgContent = await loadAndProcessSVG(reportData);
  
  // Create PDF with A4 dimensions
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  // Add the font to this PDF instance
  pdf.addFileToVFS('BrushATF-Book.ttf', fontBase64);
  pdf.addFont('BrushATF-Book.ttf', 'BrushATF-Book', 'normal');
  console.log('BrushATF-Book font added to PDF instance');

  // Create a temporary SVG element
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = svgContent;
  const svgElement = tempDiv.querySelector('svg') as SVGElement;
  
  if (!svgElement) {
    throw new Error('Could not parse SVG content');
  }

  // Ensure SVG fills the full page
  svgElement.setAttribute('width', '595.28');
  svgElement.setAttribute('height', '841.89');
  svgElement.setAttribute('viewBox', '0 0 595.28 841.89');

  // Convert SVG to vector PDF using svg2pdf.js
  await pdf.svg(svgElement, {
    x: 0,
    y: 0,
    width: 595.28, // A4 width in points
    height: 841.89, // A4 height in points
    fontFamilyMapping: {
      'BrushATF-Book': 'BrushATF-Book',
      'Helvetica': 'Helvetica',
      'Arial': 'Helvetica',
      'sans-serif': 'Helvetica'
    },
    preserveAspectRatio: 'xMidYMid meet'
  });
  
  // Return PDF as array buffer
  return pdf.output('arraybuffer');
};
