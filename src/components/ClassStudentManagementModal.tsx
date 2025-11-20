import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Loader2, UserPlus, UserMinus, Clock } from 'lucide-react';
import { getStudentsForClass, createRequest, getAllRequests } from '@/services/firebaseService-ultra-final';
import { toast } from 'sonner';
import type { Class, Student } from '@/types';
import { formatStudentName } from '@/lib/utils';

interface ClassStudentManagementModalProps {
  classData: Class | null;
  teacherEmail: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ClassStudentManagementModal: React.FC<ClassStudentManagementModalProps> = ({
  classData,
  teacherEmail,
  isOpen,
  onClose,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [newStudentFirstName, setNewStudentFirstName] = useState('');
  const [newStudentLastName, setNewStudentLastName] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && classData) {
      loadStudents();
    }
  }, [isOpen, classData]);

  const loadStudents = async () => {
    if (!classData) return;
    
    setLoading(true);
    try {
      const [classStudents, allRequests] = await Promise.all([
        getStudentsForClass(classData.id),
        getAllRequests()
      ]);
      
      setStudents(classStudents);
      
      // Find pending removal requests for this class and this teacher
      const pendingRemovalRequests = allRequests
        .filter(req => 
          req.classId === classData.id && 
          req.type === 'remove_student' && 
          req.status === 'pending' &&
          req.teacherEmail === teacherEmail
        )
        .map(req => req.studentId)
        .filter(Boolean) as string[];
      
      setPendingRequests(new Set(pendingRemovalRequests));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAddStudent = async () => {
    if (!classData || !newStudentFirstName.trim() || !newStudentLastName.trim()) {
      toast.error("Please enter both first and last name");
      return;
    }

    setAddingStudent(true);
    try {
      await createRequest({
        type: 'add_student',
        status: 'pending',
        teacherEmail,
        classId: classData.id,
        studentFirstName: newStudentFirstName.trim(),
        studentLastName: newStudentLastName.trim(),
        requestedAt: new Date(),
      });
      
      toast.success(`Request to add ${newStudentFirstName.trim()} ${newStudentLastName.trim()} has been submitted`);
      
      setNewStudentFirstName('');
      setNewStudentLastName('');
      
      // Notify that a request was created
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { 
          type: 'requests', 
          action: 'create'
        } 
      }));
    } catch (error) {
      console.error('Error creating request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setAddingStudent(false);
    }
  };

  const handleRequestRemoveStudent = async (student: Student) => {
    if (!classData) return;

    try {
      await createRequest({
        type: 'remove_student',
        status: 'pending',
        teacherEmail,
        classId: classData.id,
        studentId: student.id,
        requestedAt: new Date(),
      });
      
      // Add to pending requests to show visual feedback
      setPendingRequests(prev => new Set([...prev, student.id]));
      
      toast.success(`Request to remove ${formatStudentName(student.firstName, student.lastName)} has been submitted`);
      
      // Notify that a request was created
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { 
          type: 'requests', 
          action: 'create'
        } 
      }));
    } catch (error) {
      console.error('Error creating remove request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit request');
    }
  };

  if (!classData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Manage Students - {classData.classLevel}
          </DialogTitle>
          <DialogDescription>
            {classData.classDay} at {classData.classTime} • {classData.classLocation}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">

          {/* Add Student Section */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Request to Add Student
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <Input
                    value={newStudentFirstName}
                    onChange={(e) => setNewStudentFirstName(e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <Input
                    value={newStudentLastName}
                    onChange={(e) => setNewStudentLastName(e.target.value)}
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              <Button
                onClick={handleRequestAddStudent}
                disabled={addingStudent || !newStudentFirstName.trim() || !newStudentLastName.trim()}
                className="w-full"
              >
                {addingStudent ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting Request...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Request to Add Student
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                This will send a request to the admin to add this student to the class.
              </p>
            </div>
          </Card>

          {/* Current Students Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <UserMinus className="h-4 w-4" />
              Current Students
              <Badge variant="secondary" className="ml-2">{students.length}</Badge>
            </h3>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading students...</span>
              </div>
            ) : students.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                No students in this class yet
              </Card>
            ) : (
              <div className="space-y-2">
                {students.map((student) => {
                  const isPendingRemoval = pendingRequests.has(student.id);
                  
                  return (
                    <Card key={student.id} className={`p-3 ${isPendingRemoval ? 'bg-yellow-50 border-yellow-200' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium">
                              {formatStudentName(student.firstName, student.lastName)}
                            </div>
                          </div>
                          {isPendingRemoval && (
                            <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-100">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending Removal
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRequestRemoveStudent(student)}
                          disabled={isPendingRemoval}
                          className={`text-destructive hover:text-destructive ${isPendingRemoval ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {isPendingRemoval ? 'Requested' : 'Request Removal'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => {
            // Dispatch event to refresh student data when modal closes
            window.dispatchEvent(new CustomEvent('dataChanged', { 
              detail: { 
                type: 'students', 
                action: 'refresh'
              } 
            }));
            onClose();
          }}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

