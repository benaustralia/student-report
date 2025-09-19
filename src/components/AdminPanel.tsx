import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileInput } from '@/components/ui/file-input';
import { Loader2, Database, CheckCircle, AlertCircle, Users, BookOpen, FileText, GraduationCap } from 'lucide-react';
import { 
  getAllUsers, 
  getAllClasses, 
  getAllStudents, 
  getUniqueTeacherCount,
  importUsers, 
  importClasses, 
  importStudents, 
  isUserAdmin
} from '@/services/firebaseService';
import type { User } from 'firebase/auth';
import type { Class, Student } from '@/types';

interface AdminPanelProps {
  user: User;
}

interface ImportData {
  users?: any[];
  classes?: Class[];
  students?: Student[];
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ user }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState<{
    users: any[];
    classes: Class[];
    students: Student[];
    teachers: number;
  }>({
    users: [],
    classes: [],
    students: [],
    teachers: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const adminStatus = await isUserAdmin(user.email || '');
        setIsAdmin(adminStatus);
        
        if (adminStatus) {
          await loadData();
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
        setError('Failed to check admin status');
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [users, classes, students, teachers] = await Promise.all([
        getAllUsers().catch(() => []), // Return empty array if collection doesn't exist
        getAllClasses().catch(() => []),
        getAllStudents().catch(() => []),
        getUniqueTeacherCount().catch(() => 0)
      ]);
      
      setData({ users, classes, students, teachers });
    } catch (err) {
      console.error('Error loading data:', err);
      // Don't set error for missing collections, just log it
      console.log('Collections may not exist yet - this is normal for new installations');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string) as ImportData;
        await handleImport(jsonData);
      } catch (err) {
        setError('Invalid JSON file');
        console.error('Error parsing JSON:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async (importData: ImportData) => {
    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('AdminPanel: Starting import with data:', importData);
      const importPromises = [];
      const importMessages = [];

      // Only import admin users (they're likely missing)
      if (importData.users && importData.users.length > 0) {
        console.log('AdminPanel: Importing users:', importData.users);
        importPromises.push(importUsers(importData.users));
        importMessages.push(`${importData.users.length} admin users`);
      }

      // Check if classes already exist before importing
      if (importData.classes && importData.classes.length > 0) {
        if (data.classes.length > 0) {
          importMessages.push(`Skipped ${importData.classes.length} classes (already exist)`);
        } else {
          importPromises.push(importClasses(importData.classes));
          importMessages.push(`${importData.classes.length} classes`);
        }
      }

      // Check if students already exist before importing
      if (importData.students && importData.students.length > 0) {
        if (data.students.length > 0) {
          importMessages.push(`Skipped ${importData.students.length} students (already exist)`);
        } else {
          importPromises.push(importStudents(importData.students));
          importMessages.push(`${importData.students.length} students`);
        }
      }

      if (importPromises.length === 0 && importMessages.length === 0) {
        setError('No valid data found in JSON file');
        return;
      }

      if (importPromises.length > 0) {
        await Promise.all(importPromises);
      }

      const successMessage = `Import completed: ${importMessages.join(', ')}`;
      setSuccess(successMessage);
      await loadData(); // Reload data to show changes
    } catch (err) {
      console.error('Error importing data:', err);
      setError('Failed to import data');
    } finally {
      setImporting(false);
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading admin panel...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>You don't have admin privileges to access this panel.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Admin Panel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="flex items-center space-x-3 p-6">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="text-2xl font-bold">{data.users.length}</div>
                <div className="text-sm text-muted-foreground">Admin</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center space-x-3 p-6">
                <GraduationCap className="h-8 w-8 text-orange-600" />
                <div className="text-2xl font-bold">{data.teachers}</div>
                <div className="text-sm text-muted-foreground">Teachers</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center space-x-3 p-6">
                <BookOpen className="h-8 w-8 text-green-600" />
                <div className="text-2xl font-bold">{data.classes.length}</div>
                <div className="text-sm text-muted-foreground">Classes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center space-x-3 p-6">
                <FileText className="h-8 w-8 text-purple-600" />
                <div className="text-2xl font-bold">{data.students.length}</div>
                <div className="text-sm text-muted-foreground">Students</div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Users List */}
          {data.users.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Admin Users ({data.users.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.users.map((user, index) => (
                  <Card key={index} className={`${
                    user.firstName && user.lastName ? '' : 'border-yellow-200 bg-yellow-50'
                  }`}>
                    <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                      <div className="flex items-center space-x-3">
                        <Users className="h-5 w-5 text-blue-600" />
                        {user.firstName && user.lastName ? (
                          <div className="space-y-1">
                            <div className="font-medium">{user.firstName} {user.lastName}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="font-medium text-yellow-800">⚠️ {user.email}</div>
                            <div className="text-xs text-yellow-600">Missing name data</div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}

          {/* No Data Message */}
          {data.users.length === 0 && data.classes.length === 0 && data.students.length === 0 && (
            <Card>
              <CardContent className="text-center p-8">
                <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
                <p className="text-muted-foreground">
                  Upload a JSON file to import admin users, classes, and students, or download the sample file to get started.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Error/Success Messages */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="flex items-center space-x-2 p-4">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="text-red-700">{error}</span>
              </CardContent>
            </Card>
          )}

          {success && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="flex items-center space-x-2 p-4">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-green-700">{success}</span>
              </CardContent>
            </Card>
          )}

          {/* JSON Import */}
          <Card>
            <CardHeader>
              <CardTitle>Import Data from JSON</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload a structured JSON file to import users, classes, and students.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileInput
                accept=".json"
                maxSize={10}
                onFileChange={(file) => {
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      try {
                        JSON.parse(e.target?.result as string);
                        handleFileUpload({ target: { files: [file] } } as any);
                      } catch (error) {
                        console.error('Error parsing JSON:', error);
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
                disabled={importing}
              />

              {importing && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Importing data...</span>
                </div>
              )}
            </CardContent>
          </Card>

        </CardContent>
      </Card>

    </div>
  );
};