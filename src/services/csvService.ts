// Alternative approach: Use Google Sheets CSV export
// This is simpler and doesn't require API keys for public sheets

export async function fetchStudentReportsFromCSV(sheetId: string) {
  try {
    // Google Sheets CSV export URL
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=OfficeUseREACT`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('Error fetching CSV data:', error);
    return [];
  }
}

function parseCSV(csvText: string) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  const data = lines.slice(1)
    .filter(line => line.trim()) // Remove empty lines
    .map((line, index) => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj: any = { id: index + 1 };
      
      headers.forEach((header, i) => {
        obj[header] = values[i] || '';
      });
      
      return obj;
    });
  
  return data;
}

