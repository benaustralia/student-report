import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { ReportData } from '../types';
import { loadAndProcessSVG } from '../utils/svgUtils';
import { loadBrushATFFont } from './fontService';

export const generateVectorPDF = async (svgContent: string, filename: string = 'report.pdf'): Promise<void> => {
  try {
    // Load the BrushATF-Book font first
    const fontBase64 = await loadBrushATFFont();
    
    // Create PDF with A4 dimensions (595.28 x 841.89 points)
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
      height: 841.89 // A4 height in points
    });

    // Save the PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error generating vector PDF:', error);
    throw new Error('Failed to generate vector PDF');
  }
};

export const downloadReportAsPDF = async (
  reportData: ReportData, 
  filename?: string
): Promise<void> => {
  try {
    // Validate input data
    if (!reportData.studentName?.trim()) {
      throw new Error('Student name is required');
    }
    
    // Get the processed SVG content directly
    const svgContent = await loadAndProcessSVG(reportData);
    
    if (!svgContent || svgContent.trim().length === 0) {
      throw new Error('Failed to generate report content');
    }
    
    // Generate vector PDF
    const defaultFilename = `${reportData.studentName.replace(/\s+/g, '_')}_Report.pdf`;
    await generateVectorPDF(svgContent, filename || defaultFilename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('font') || error.message.includes('Failed to fetch font')) {
        throw new Error('Failed to load font. Please try again.');
      } else if (error.message.includes('SVG') || error.message.includes('Failed to load SVG template')) {
        throw new Error('Failed to process report template. Please try again.');
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      } else if (error.message.includes('Could not parse SVG content')) {
        throw new Error('Invalid SVG content. Please try again.');
      }
    }
    
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

