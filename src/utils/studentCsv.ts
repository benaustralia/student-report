export interface ParsedStudent {
  firstName: string;
  lastName: string;
  isValid: boolean;
  error?: string;
}

export function parseStudentsCSV(data: string): ParsedStudent[] {
  const lines = data.trim().split('\n');
  const students: ParsedStudent[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let firstName = '';
    let lastName = '';
    if (line.includes(',') || line.includes('\t')) {
      const parts = line.split(/[\,\t]/).map(part => part.trim());
      if (parts.length >= 2) {
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }
    } else {
      const hasParen = line.includes('(') && line.includes(')');
      if (hasParen) {
        const match = line.match(/^(.+\))\s+(.+)$/);
        if (match) {
          firstName = match[1].trim();
          lastName = match[2].trim();
        } else {
          const parts = line.split(/\s+/);
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }
      } else {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }
      }
    }
    if (!firstName || !lastName) {
      students.push({ firstName: firstName || '', lastName: lastName || '', isValid: false, error: 'firstName and lastName are required' });
      continue;
    }
    students.push({ firstName, lastName, isValid: true });
  }
  return students;
}
