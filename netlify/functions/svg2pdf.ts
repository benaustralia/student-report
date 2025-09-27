import type { Handler, HandlerResponse } from "@netlify/functions";
import PDFDocument from "pdfkit";
// @ts-ignore – typings are patchy
import SVGtoPDF from "svg-to-pdfkit";
import fs from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";

const A4_W = 595.28, A4_H = 841.89; // 210×297mm in points
let noto: Buffer | null = null;

export const handler: Handler = async (event) => {
  console.log('=== SVG2PDF Function Started ===');
  console.log('Request method:', event.httpMethod);
  console.log('Request headers:', JSON.stringify(event.headers, null, 2));
  console.log('Request path:', event.path);
  console.log('Request query:', JSON.stringify(event.queryStringParameters, null, 2));
  
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    } as HandlerResponse;
  }

  try {
    console.log('Processing POST request...');
    
    // Validate request body
    if (!event.body) {
      console.error('ERROR: Missing request body');
      return { 
        statusCode: 400, 
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: "Missing request body", details: "The request must include a JSON body with an 'svg' field" })
      } as HandlerResponse;
    }
    
    console.log('Request body length:', event.body.length);
    console.log('Request body preview (first 200 chars):', event.body.substring(0, 200));
    
    // Parse and validate JSON
    let parsedBody;
    try {
      parsedBody = JSON.parse(event.body);
      console.log('Successfully parsed JSON body');
    } catch (parseError) {
      console.error('ERROR: Failed to parse JSON body:', parseError);
      return { 
        statusCode: 400, 
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: "Invalid JSON", 
          details: `Failed to parse request body: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` 
        })
      } as HandlerResponse;
    }
    
    // Validate SVG field
    const { svg, textData } = parsedBody;
    if (!svg) {
      console.error('ERROR: Missing svg field in request body');
      return { 
        statusCode: 400, 
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: "Missing svg field", 
          details: "The request body must include an 'svg' field containing the SVG content" 
        })
      } as HandlerResponse;
    }
    
    if (typeof svg !== "string") {
      console.error('ERROR: svg field is not a string, type:', typeof svg);
      return { 
        statusCode: 400, 
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: "Invalid svg field", 
          details: `The 'svg' field must be a string, but received ${typeof svg}` 
        })
      } as HandlerResponse;
    }
    
    console.log('SVG content length:', svg.length);
    console.log('SVG preview (first 300 chars):', svg.substring(0, 300));
    
    // Modify SVG to ensure it uses our Chinese font
    let modifiedSvg = svg;
    
    // Add font-family to the root SVG element
    if (modifiedSvg.includes('<svg')) {
      if (modifiedSvg.includes('style=')) {
        // If style attribute exists, add font-family to it
        modifiedSvg = modifiedSvg.replace(/style="([^"]*)"/, 'style="$1; font-family: NotoSansSC, sans-serif;"');
      } else {
        // Add new style attribute with font-family
        modifiedSvg = modifiedSvg.replace('<svg', '<svg style="font-family: NotoSansSC, sans-serif;"');
      }
      console.log('Modified SVG to include Chinese font-family');
    }
    
    // Also ensure all text elements use the Chinese font
    modifiedSvg = modifiedSvg.replace(/<text([^>]*)>/g, (match, attrs) => {
      if (attrs.includes('font-family')) {
        return match; // Already has font-family
      } else if (attrs.includes('style=')) {
        return `<text${attrs.replace(/style="([^"]*)"/, 'style="$1; font-family: NotoSansSC, sans-serif;"')}>`;
      } else {
        return `<text${attrs} style="font-family: NotoSansSC, sans-serif;">`;
      }
    });
    
    console.log('SVG modification completed');

    // Load font file
    console.log('Loading font file...');
    if (!noto) {
      // Try multiple possible paths for the font file
      const possibleFontPaths = [
        // Local development path
        "/Users/benhinton/Documents/Github/studentreports/fonts/NotoSansSC-Regular.ttf",
        // Netlify function environment paths - prioritize the data directory
        path.join(__dirname, 'data/NotoSansSC-Regular.ttf'),
        path.join(__dirname, '../../fonts/NotoSansSC-Regular.ttf'),
        path.join(__dirname, '../../../fonts/NotoSansSC-Regular.ttf'),
        path.join(process.cwd(), 'fonts/NotoSansSC-Regular.ttf'),
        path.join(process.cwd(), 'netlify/functions/data/NotoSansSC-Regular.ttf')
      ];
      
      let fontPath: string | null = null;
      
      for (const testPath of possibleFontPaths) {
        try {
          await fs.access(testPath);
          fontPath = testPath;
          console.log('Font found at:', testPath);
          break;
        } catch (pathError) {
          console.log('Font not found at:', testPath);
        }
      }
      
      if (!fontPath) {
        console.error('Font file not found in any expected location');
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ 
            error: "Font loading failed", 
            details: "NotoSansSC-Regular.ttf font file is required but not found" 
          })
        } as HandlerResponse;
      } else {
        console.log('Font path:', fontPath);
        console.log('Current working directory:', process.cwd());
        console.log('__dirname:', __dirname);
        
        // Also copy font data to the function directory for PDFKit
        const fontDataPath = path.join(__dirname, "data", "Helvetica.afm");
        const sourceFontDataPath = "/Users/benhinton/Documents/Github/studentreports/netlify/functions/data/Helvetica.afm";
        
        try {
          // Ensure the data directory exists
          const dataDir = path.dirname(fontDataPath);
          await fs.mkdir(dataDir, { recursive: true });
          
          // Copy font data if it doesn't exist
          try {
            await fs.access(fontDataPath);
            console.log('Font data already exists');
          } catch {
            await fs.copyFile(sourceFontDataPath, fontDataPath);
            console.log('Font data copied successfully');
          }
        } catch (copyError) {
          console.warn('Warning: Could not copy font data:', copyError);
        }
        
        try {
          noto = await fs.readFile(fontPath);
          console.log('Font loaded successfully, size:', noto.length, 'bytes');
        } catch (fontError) {
          console.error('ERROR: Failed to load font file:', fontError);
          return {
            statusCode: 500,
            headers: {
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ 
              error: "Font loading failed", 
              details: `Could not load NotoSansSC-Regular.ttf: ${fontError instanceof Error ? fontError.message : 'Unknown error'}` 
            })
          } as HandlerResponse;
        }
      }
    } else {
      console.log('Using cached font, size:', noto.length, 'bytes');
    }

    // Create PDF document
    console.log('Creating PDF document...');
    console.log('PDF dimensions:', { width: A4_W, height: A4_H });
    
    const doc = new PDFDocument({ 
      size: [A4_W, A4_H], 
      margin: 0
    });
    
    // Register the Chinese font
    try {
      doc.registerFont("NotoSansSC", noto);
      doc.font("NotoSansSC");
      console.log('Chinese font registered and set successfully');
    } catch (fontError) {
      console.error('ERROR: Failed to register Chinese font:', fontError);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: "Chinese font registration failed", 
          details: `Could not register Chinese font: ${fontError instanceof Error ? fontError.message : 'Unknown error'}` 
        })
      } as HandlerResponse;
    }

    // Set up PDF stream
    console.log('Setting up PDF stream...');
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((res, rej) => {
      stream.on("data", c => {
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      });
      stream.on("end", () => {
        console.log('PDF stream ended, total chunks:', chunks.length);
        res(Buffer.concat(chunks));
      });
      stream.on("error", (streamError) => {
        console.error('ERROR: PDF stream error:', streamError);
        rej(streamError);
      });
    });

    doc.pipe(stream);
    
    // Convert SVG to PDF
    console.log('Converting SVG to PDF...');
    try {
      // Add the SVG as background (graphics only, no text)
      SVGtoPDF(doc, modifiedSvg, 0, 0, {
        width: A4_W,
        height: A4_H,
        preserveAspectRatio: 'none',
        fontCallback: (fontFamily: string, fontWeight: string, fontStyle: string) => {
          console.log('Font callback called for:', fontFamily, fontWeight, fontStyle);
          return 'NotoSansSC'; // Use embedded Noto Sans SC font
        },
      });
      
      console.log('SVG background added, now adding vector text...');
      
      // Text is now embedded in the SVG, no need to add it separately
      console.log('Text is embedded in SVG, no separate text addition needed');
      
      console.log('All vector text added successfully');
    } catch (svgError) {
      console.error('ERROR: SVG to PDF conversion failed:', svgError);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: "SVG conversion failed", 
          details: `Failed to convert SVG to PDF: ${svgError instanceof Error ? svgError.message : 'Unknown error'}` 
        })
      } as HandlerResponse;
    }
    
    // Add logo as PDF image (no border) - LAST to ensure it's on top
    try {
      // Try multiple possible paths for the logo
      const possiblePaths = [
        path.join(__dirname, '../src/assets/NSALogo.png'),
        path.join(__dirname, '../../src/assets/NSALogo.png'),
        path.join(process.cwd(), 'src/assets/NSALogo.png'),
        path.join(process.cwd(), 'netlify/functions/data/NSALogo.png')
      ];
      
      let logoBuffer: Buffer | null = null;
      let logoPath: string | null = null;
      
      for (const testPath of possiblePaths) {
        try {
          logoBuffer = await fs.readFile(testPath);
          logoPath = testPath;
          console.log('Logo found at:', testPath);
          break;
        } catch (pathError) {
          console.log('Logo not found at:', testPath);
        }
      }
      
      if (logoBuffer) {
        // Add logo to bottom right
        doc.image(logoBuffer, 460, 680, { width: 80, height: 80 });
        console.log('Logo added successfully from:', logoPath);
      } else {
        console.error('Logo not found in any of the expected locations');
      }
    } catch (logoError) {
      console.error('Failed to add logo:', logoError);
      // Continue without logo if it fails
    }
    
    doc.end();
    console.log('PDF document finalized');

    // Wait for PDF generation to complete
    console.log('Waiting for PDF generation to complete...');
    const pdf = await done;
    console.log('PDF generated successfully, size:', pdf.length, 'bytes');
    
    const base64Pdf = pdf.toString("base64");
    console.log('PDF converted to base64, length:', base64Pdf.length);
    
    console.log('=== SVG2PDF Function Completed Successfully ===');
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="report.pdf"',
        'Access-Control-Allow-Origin': '*',
      },
      body: base64Pdf,
      isBase64Encoded: true,
    } as HandlerResponse;
  } catch (e: any) {
    console.error('=== CRITICAL ERROR in SVG2PDF Function ===');
    console.error('Error type:', typeof e);
    console.error('Error message:', e?.message || 'No message');
    console.error('Error stack:', e?.stack || 'No stack trace');
    console.error('Full error object:', JSON.stringify(e, null, 2));
    console.error('=== END ERROR LOG ===');
    
    return { 
      statusCode: 500, 
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: "Internal server error", 
        details: `svg2pdf error: ${e?.message || e}`,
        timestamp: new Date().toISOString()
      })
    } as HandlerResponse;
  }
};
