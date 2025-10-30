import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, CheckCircle, XCircle } from 'lucide-react';
import type { Student } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ParsedStudent } from '@/utils/studentCsv';

export function ExistingStudents({ loading, students }: { loading: boolean; students: Student[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Existing Students in This Class
          <Badge variant="secondary" className="ml-2">{students.length}</Badge>
        </h3>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Loading students...</span>
          </div>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students in this class yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
            {students.map((student) => (
              <div key={student.id} className="flex items-center gap-2 p-2 rounded border">
                <div className="font-medium text-sm">{student.firstName} {student.lastName}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CsvInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean; }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="text-base font-semibold">Student Data</h3>
      </CardHeader>
      <CardContent className="pt-0">
        <Textarea
          placeholder={"Paste your CSV data here...\nSupports: firstName,lastName OR firstName lastName\nMulti-word last names: Ezra,De Los Reyes OR Ezra De Los Reyes\nNicknames: Jackie (Chen Wu),Li OR Jackie (Chen Wu) Li\nExample:\nJohn,Smith\nJane Doe\nEzra De Los Reyes\nJackie (Chen Wu) Li"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[120px] font-mono text-sm"
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
}

export function PreviewList({ parsed, validCount, invalidCount }: { parsed: ParsedStudent[]; validCount: number; invalidCount: number; }) {
  if (parsed.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <h3 className="text-base font-semibold flex items-center gap-2">Preview ({validCount} valid, {invalidCount} invalid)</h3>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2">
          {parsed.map((student, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded border">
              <div className="flex-1">
                <span className="font-medium">{student.firstName} {student.lastName}</span>
              </div>
              <div className="flex items-center gap-2">
                {student.isValid ? (
                  <Badge variant="default" className="text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Valid
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    <XCircle className="h-3 w-3 mr-1" />
                    {student.error}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ErrorOrSuccess({ error, success }: { error: string | null; success: string | null; }) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (success) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <AlertDescription className="text-green-800 dark:text-green-200">{success}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

export function AddStudentSection({
  firstName,
  lastName,
  setFirst,
  setLast,
  onSubmit,
  submitting
}: {
  firstName: string;
  lastName: string;
  setFirst: (v: string) => void;
  setLast: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">Request to Add Student</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">First Name</label>
            <Input value={firstName} onChange={(e) => setFirst(e.target.value)} placeholder="Enter first name" />
          </div>
          <div>
            <label className="text-sm font-medium">Last Name</label>
            <Input value={lastName} onChange={(e) => setLast(e.target.value)} placeholder="Enter last name" />
          </div>
        </div>
        <Button onClick={onSubmit} disabled={submitting || !firstName.trim() || !lastName.trim()} className="w-full">
          {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting Request...</>) : 'Request to Add Student'}
        </Button>
        <p className="text-xs text-muted-foreground">This will send a request to the admin to add this student to the class.</p>
      </div>
    </Card>
  );
}
