import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Upload, CheckCircle, XCircle, AlertCircle, Users } from 'lucide-react';
import { importStudents, getStudentsForClass } from '@/services/firebaseService-ultra-final';
import type { Class, Student } from '@/types';
import { parseStudentsCSV, type ParsedStudent } from '@/utils/studentCsv';
import { ExistingStudents, CsvInput, PreviewList, ErrorOrSuccess } from '@/components/helpers/bulkStudentImport';

interface BulkStudentImportProps {
  classData: Class | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

 

export function BulkStudentImport({
  classData,
  isOpen,
  onClose,
  onSuccess
}: BulkStudentImportProps) {
  const [csvData, setCsvData] = useState('');
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Load existing students when modal opens
  useEffect(() => {
    if (isOpen && classData) {
      loadExistingStudents();
    }
  }, [isOpen, classData]);

  const loadExistingStudents = async () => {
    if (!classData) return;
    
    setLoadingExisting(true);
    try {
      const students = await getStudentsForClass(classData.id);
      setExistingStudents(students);
    } catch (error) {
      console.error('Error loading existing students:', error);
    } finally {
      setLoadingExisting(false);
    }
  };

  const parseCSV = (data: string): ParsedStudent[] => {
    const lines = data.trim().split('\n');
    const students: ParsedStudent[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      let firstName = '';
      let lastName = '';
      
      // Check if line contains comma or tab (CSV format)
      if (line.includes(',') || line.includes('\t')) {
        // CSV format: "firstName,lastName" or "firstName	lastName"
        const parts = line.split(/[,\t]/).map(part => part.trim());
        if (parts.length >= 2) {
          firstName = parts[0];
          // Join remaining parts as lastName (handles "De Los Reyes")
          lastName = parts.slice(1).join(' ');
        }
      } else {
        // Space-separated format: "firstName lastName" or "firstName middle lastName"
        // Handle nicknames in parentheses: "Jackie (Chen Wu) Li"
        const parts = line.split(/\s+/);
        
        if (parts.length >= 2) {
          // Check if there are parentheses (nickname)
          const hasParentheses = line.includes('(') && line.includes(')');
          
          if (hasParentheses) {
            // Extract everything up to and including the closing parenthesis as firstName
            const match = line.match(/^(.+\))\s+(.+)$/);
            if (match) {
              firstName = match[1].trim();
              lastName = match[2].trim();
            } else {
              // Fallback: first part is firstName, rest is lastName
              firstName = parts[0];
              lastName = parts.slice(1).join(' ');
            }
          } else {
            // No parentheses: first word is firstName, rest is lastName
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
          }
        }
      }
      
      // Validate
      if (!firstName || !lastName) {
        students.push({
          firstName: firstName || '',
          lastName: lastName || '',
          isValid: false,
          error: 'firstName and lastName are required'
        });
        continue;
      }
      
      students.push({
        firstName,
        lastName,
        isValid: true
      });
    }
    
    return students;
  };

  const handleCSVChange = (value: string) => {
    setCsvData(value);
    setError(null);
    setSuccess(null);
    
    if (value.trim()) {
      const parsed = parseCSV(value);
      setParsedStudents(parsed);
    } else {
      setParsedStudents([]);
    }
  };

  const handleImport = async () => {
    if (!classData || parsedStudents.length === 0) return;
    
    const validStudents = parsedStudents.filter(s => s.isValid);
    if (validStudents.length === 0) {
      setError('No valid students to import');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    
    try {
      const studentsToImport: Student[] = validStudents.map(student => ({
        id: '', // Will be generated by createDoc
        classId: classData.id,
        firstName: student.firstName,
        lastName: student.lastName,
        teacherEmail: classData.teacherEmail,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      await importStudents(studentsToImport);
      
      setSuccess(`Successfully imported ${validStudents.length} students`);
      setCsvData('');
      setParsedStudents([]);
      
      // Notify parent component
      onSuccess();
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import students');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedStudents.filter(s => s.isValid).length;
  const invalidCount = parsedStudents.filter(s => !s.isValid).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Students for {classData?.classLevel} - {classData?.classDay} at {classData?.classTime}
          </DialogTitle>
          <DialogDescription>
            Import multiple students at once. Supports multi-word last names (De Los Reyes) and nicknames in parentheses (Jackie (Chen Wu) Li).
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <ExistingStudents loading={loadingExisting} students={existingStudents} />
          <CsvInput value={csvData} onChange={handleCSVChange} disabled={isProcessing} />
          <PreviewList parsed={parsedStudents} validCount={validCount} invalidCount={invalidCount} />
          <ErrorOrSuccess error={error} success={success} />

          {/* Actions */}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={isProcessing || validCount === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {validCount} Students
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
