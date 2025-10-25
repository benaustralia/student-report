import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { CollapsibleItem } from '@/components/ui/collapsible-item';
import { Plus, Users, BookOpen, GraduationCap, ChevronDown, ChevronRight, Upload, FileText, Check, X } from 'lucide-react';
import { importUsers, importClasses, importStudents, importTeachers, getAllUsers, getAllClasses, getAllStudents, getAllTeachers, updateUser, deleteUser, updateClass, deleteClass, updateStudent, deleteStudent, updateTeacher, deleteTeacher, getAllRequests, importRequests, updateRequest, deleteRequest, approveRequest, declineRequest } from '@/services/firebaseService-ultra-final';
import { BulkStudentImport } from './BulkStudentImport';
import { toast } from 'sonner';
import type { AdminUser, Class, Student, Teacher, Request } from '@/types';
import { useAuthContext } from '@/hooks/useAuthContext';

type DataType = 'requests' | 'users' | 'classes' | 'students' | 'teachers';
type ItemType = AdminUser | Class | Student | Teacher | Request;

const CLASS_LEVEL_OPTIONS = [
  'Early Learning',
  'Primary', 
  'Intermediate',
  'Advanced',
  'Master',
  'Adult',
  'Sketching'
];

const CLASS_DAY_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const CLASS_TIME_OPTIONS = [
  '10:30am',
  '1:30pm',
  '3:45pm',
  '4:30pm'
];

const CLASS_LOCATION_OPTIONS = [
  'Mount Waverley',
  'Box Hill',
  'Balwyn North Primary School',
  'Camberwell',
  'Doncaster Gardens Primary School',
  'Preston',
  'Pines',
  'Glen Waverley Primary School'
  'Serpell Primary School'
];

const CONFIG = {
  requests: { icon: FileText, title: 'Requests', fields: ['type', 'status', 'teacherEmail', 'classId', 'studentId', 'studentFirstName', 'studentLastName', 'notes'], empty: { type: 'add_student', status: 'pending', teacherEmail: '', classId: '', notes: '' } },
  users: { icon: Users, title: 'Admins', fields: ['firstName', 'lastName', 'email', 'isAdmin'], empty: { firstName: '', lastName: '', email: '', isAdmin: true } },
  classes: { icon: BookOpen, title: 'Classes', fields: ['classLevel', 'classDay', 'classTime', 'classLocation', 'teacherEmail'], empty: { classLevel: '', classDay: '', classTime: '', classLocation: '', teacherEmail: '' } },
  students: { icon: GraduationCap, title: 'Students', fields: ['firstName', 'lastName', 'classId'], empty: { firstName: '', lastName: '', classId: '' } },
  teachers: { icon: Users, title: 'Teachers', fields: ['firstName', 'lastName', 'email'], empty: { firstName: '', lastName: '', email: '' } }
};

const OPS = { 
  import: { users: importUsers, classes: importClasses, students: importStudents, teachers: importTeachers, requests: importRequests }, 
  update: { users: updateUser, classes: updateClass, students: updateStudent, teachers: updateTeacher, requests: updateRequest }, 
  delete: { users: deleteUser, classes: deleteClass, students: deleteStudent, teachers: deleteTeacher, requests: deleteRequest }, 
  getAll: [getAllUsers, getAllClasses, getAllStudents, getAllTeachers, getAllRequests] 
};

// Utility function to convert camelCase to title case
const formatFieldLabel = (field: string): string => {
  return field
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim(); // Remove any leading/trailing spaces
};

export const DataBuilder = () => {
  const { user } = useAuthContext();
  const [data, setData] = useState<Record<DataType, ItemType[]>>({ users: [], classes: [], students: [], teachers: [], requests: [] });
  const [newItems, setNewItems] = useState<Record<DataType, ItemType[]>>({ users: [], classes: [], students: [], teachers: [], requests: [] });
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [openSections, setOpenSections] = useState<Record<DataType, boolean>>({ requests: true, users: false, classes: false, students: false, teachers: false });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showBulkImport, setShowBulkImport] = useState<string | null>(null);

  // Handle accordion state changes with auto-close functionality
  const handleAccordionToggle = (dataType: DataType, isOpen: boolean) => {
    setOpenSections(prev => {
      // If opening a section, close all others
      if (isOpen) {
        const newSections = { requests: false, users: false, classes: false, students: false, teachers: false };
        newSections[dataType] = true;
        return newSections;
      }
      // If closing a section, just update that section
      return { ...prev, [dataType]: false };
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [users, classes, students, teachers, requests] = await Promise.all(OPS.getAll.map(fn => fn()));
        setData({ 
          users: (users || []) as ItemType[], 
          classes: (classes || []) as ItemType[], 
          students: (students || []) as ItemType[], 
          teachers: (teachers || []) as ItemType[],
          requests: (requests || []) as ItemType[]
        });
      } catch (error) {
        console.error('Error loading data:', error);
        setData({ users: [], classes: [], students: [], teachers: [], requests: [] });
        toast.error('Failed to load some data. Please check your connection.');
      } finally {
        // Loading state removed
      }
    };
    
    loadData();
  }, []);

  const updateItem = (type: DataType, index: number | string, field: string, value: unknown, isNew = false) => {
    const setter = isNew ? setNewItems : setData;
    setter((prev: Record<DataType, ItemType[]>) => ({
      ...prev,
      [type]: prev[type].map((item, i) => {
        if (isNew ? i === index : item.id === index) {
          return { ...item, [field]: value } as ItemType;
        }
        return item;
      }),
    }));
  };

  const handleAction = async (action: 'add' | 'remove' | 'submit' | 'update' | 'delete', type: DataType, item: ItemType | null, index: number) => {
    try {
      if (action === 'add') setNewItems(prev => ({ ...prev, [type]: [...prev[type], { ...CONFIG[type].empty }] }));
      else if (action === 'remove') setNewItems(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
      else if (action === 'submit') {
        await (OPS.import[type] as (items: ItemType[]) => Promise<void>)(newItems[type]);
        setNewItems(prev => ({ ...prev, [type]: [] }));
        toast.success(`Imported ${newItems[type].length} ${type}!`);
        const results = await Promise.all(OPS.getAll.map(fn => fn()));
        setData({ 
          users: (results[0] || []) as ItemType[], 
          classes: (results[1] || []) as ItemType[], 
          students: (results[2] || []) as ItemType[], 
          teachers: (results[3] || []) as ItemType[],
          requests: (results[4] || []) as ItemType[]
        });
        // Notify other components that data has changed
        window.dispatchEvent(new CustomEvent('dataChanged', { 
          detail: { 
            type, 
            action: 'submit',
            count: newItems[type].length 
          } 
        }));
      } else if (action === 'update' && item?.id) {
        await OPS.update[type](item.id, item);
        setEditing(prev => new Set([...prev].filter(id => id !== item.id)));
        toast.success(`Updated ${type.slice(0, -1)}!`);
        // Refresh data after update to ensure UI reflects changes
        const results = await Promise.all(OPS.getAll.map(fn => fn()));
        setData({ 
          users: (results[0] || []) as ItemType[], 
          classes: (results[1] || []) as ItemType[], 
          students: (results[2] || []) as ItemType[], 
          teachers: (results[3] || []) as ItemType[],
          requests: (results[4] || []) as ItemType[]
        });
        // Notify other components that data has changed
        window.dispatchEvent(new CustomEvent('dataChanged', { 
          detail: { 
            type, 
            action: 'update',
            itemId: item.id,
            item: item 
          } 
        }));
      } else if (action === 'delete' && item?.id) {
        await OPS.delete[type](item.id);
        setData(prev => ({ ...prev, [type]: prev[type].filter(i => i.id !== item.id) }));
        toast.success(`Deleted ${type.slice(0, -1)}!`);
        // Notify other components that data has changed with specific details
        window.dispatchEvent(new CustomEvent('dataChanged', { 
          detail: { 
            type, 
            action: 'delete', 
            itemId: item.id,
            item: item 
          } 
        }));
      }
    } catch (error: unknown) { toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`); }
  };

  const renderField = (type: DataType, item: ItemType, field: string, index: number, isNew: boolean) => {
    if (field === 'classId' && type === 'students') {
      return (
        <Select 
          value={((item as Student)[field as keyof Student] as string) || ''} 
          onValueChange={async (v) => {
            // Update local state first
            updateItem(type, isNew ? index : (item.id || ''), field, v, isNew);
            
            // If not a new item, automatically save to Firebase
            if (!isNew && item.id) {
              const updatedItem = { ...item, [field]: v };
              try {
                await OPS.update[type](item.id, updatedItem);
                toast.success(`Student assigned to class!`);
                // Refresh data to ensure UI reflects the change
                const results = await Promise.all(OPS.getAll.map(fn => fn()));
                setData({ 
                  users: (results[0] || []) as ItemType[], 
                  classes: (results[1] || []) as ItemType[], 
                  students: (results[2] || []) as ItemType[], 
                  teachers: (results[3] || []) as ItemType[],
                  requests: (results[4] || []) as ItemType[]
                });
              } catch (error: unknown) {
                console.error('Failed to save class assignment:', error);
                toast.error(`Failed to assign student: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {data.classes.map(cls => (
              <SelectItem key={cls.id} value={cls.id || ''}>
                {(cls as Class).classDay} {(cls as Class).classTime} - {(cls as Class).classLevel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    } else if (field === 'classLevel' && type === 'classes') {
      return (
        <Select
          value={(item as Class)[field as keyof Class] as string || ''}
          onValueChange={(value) => updateItem(type, isNew ? index : item.id || '', field, value, isNew)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select class level..." />
          </SelectTrigger>
          <SelectContent>
            {CLASS_LEVEL_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    } else if (field === 'classDay' && type === 'classes') {
      return (
        <Select
          value={(item as Class)[field as keyof Class] as string || ''}
          onValueChange={(value) => updateItem(type, isNew ? index : item.id || '', field, value, isNew)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select class day..." />
          </SelectTrigger>
          <SelectContent>
            {CLASS_DAY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    } else if (field === 'classTime' && type === 'classes') {
      return (
        <Select
          value={(item as Class)[field as keyof Class] as string || ''}
          onValueChange={(value) => updateItem(type, isNew ? index : item.id || '', field, value, isNew)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select class time..." />
          </SelectTrigger>
          <SelectContent>
            {CLASS_TIME_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    } else if (field === 'classLocation' && type === 'classes') {
      return (
        <Select
          value={(item as Class)[field as keyof Class] as string || ''}
          onValueChange={(value) => updateItem(type, isNew ? index : item.id || '', field, value, isNew)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select class location..." />
          </SelectTrigger>
          <SelectContent>
            {CLASS_LOCATION_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    } else if (field === 'teacherEmail' && type === 'classes') {
      return (
        <Select
          value={(item as Class)[field as keyof Class] as string || ''}
          onValueChange={(value) => updateItem(type, isNew ? index : item.id || '', field, value, isNew)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select teacher..." />
          </SelectTrigger>
          <SelectContent>
            {data.teachers.map((teacher) => (
              <SelectItem key={teacher.id} value={(teacher as Teacher).email}>
                {(teacher as Teacher).firstName} {(teacher as Teacher).lastName} ({(teacher as Teacher).email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    } else if (field === 'isAdmin' && type === 'users') {
      // Only show isAdmin field when editing existing users, not when creating new ones
      if (isNew) {
        return null; // Don't render the field for new admin users
      }
      return (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={(item as AdminUser)[field as keyof AdminUser] as boolean || false}
            onChange={(e) => updateItem(type, isNew ? index : item.id || '', field, e.target.checked, isNew)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-muted-foreground">Admin privileges</span>
        </div>
      );
    } else {
      return (
        <Input
          value={(item as unknown as Record<string, unknown>)[field] as string || ''}
          onChange={e =>
            updateItem(
              type,
              isNew ? index : item.id || '',
              field,
              e.target.value,
              isNew
            )
          }
        />
      );
    }
  };

  const groupByTeacher = (items: ItemType[], getTeacher: (item: ItemType) => string, type: DataType) => 
    items.reduce((groups: Record<string, ItemType[]>, item: ItemType) => {
      const teacher = getTeacher(item) || (type === 'students' ? 'No Class Assigned' : 'No Teacher');
      (groups[teacher] = groups[teacher] || []).push(item);
      return groups;
    }, {});

  const getTeacherName = (email: string) => {
    const teacher = data.teachers.find(t => (t as Teacher).email === email) as Teacher;
    return teacher ? `${teacher.firstName} ${teacher.lastName}` : email;
  };

  const renderGroupedItems = (type: DataType, items: ItemType[], config: { fields: string[] }) => {
    if (type === 'students') {
      // For students, group by teacher first, then by class within each teacher
      const teacherGroups = groupByTeacher(items, item => (data.classes.find(c => c.id === (item as Student).classId) as Class)?.teacherEmail || '', type);
      
      return Object.entries(teacherGroups).map(([teacher, groupItems]: [string, ItemType[]]) => {
        // Group students by class within this teacher
        const classGroups = groupItems.reduce((groups: Record<string, ItemType[]>, item: ItemType) => {
          const classId = (item as Student).classId || 'No Class';
          const className = classId === 'No Class' ? 'No Class Assigned' : 
            (data.classes.find(c => c.id === classId) as Class)?.classDay + ' ' + 
            (data.classes.find(c => c.id === classId) as Class)?.classTime || 'Unknown Class';
          (groups[className] = groups[className] || []).push(item);
          return groups;
        }, {});

        return (
          <div key={teacher} className="mb-4">
            <div className="flex items-center cursor-pointer p-2 bg-muted rounded-md mb-2" onClick={() => setOpenGroups(prev => ({ ...prev, [`${type}-${teacher}`]: !prev[`${type}-${teacher}`] }))}>
              {openGroups[`${type}-${teacher}`] ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              <span className="font-medium">{getTeacherName(teacher)}</span>
              <span className="ml-2 text-sm text-muted-foreground">({groupItems.length})</span>
            </div>
            {openGroups[`${type}-${teacher}`] && (
              <div className="ml-6 space-y-3">
                {Object.entries(classGroups).map(([className, classItems]: [string, ItemType[]]) => (
                  <div key={className}>
                    <div className="flex items-center cursor-pointer p-2 bg-muted/50 rounded-md mb-2" onClick={() => setOpenGroups(prev => ({ ...prev, [`${type}-${teacher}-${className}`]: !prev[`${type}-${teacher}-${className}`] }))}>
                      {openGroups[`${type}-${teacher}-${className}`] ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                      <span className="font-medium text-sm">{className}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({classItems.length})</span>
                    </div>
                    {openGroups[`${type}-${teacher}-${className}`] && (
                      <div className="ml-6 space-y-2">
                        {classItems.map(item => (
                          <CollapsibleItem
                            key={item.id}
                            title={`${(item as Student).firstName} ${(item as Student).lastName}`}
                            subtitle={(data.classes.find(c => c.id === (item as Student).classId) as Class)?.classLevel || 'No Class'}
                            isEditing={editing.has(item.id!)}
                            onEdit={() => setEditing(prev => new Set([...prev, item.id!]))}
                            onSave={() => handleAction('update', type, item, 0)}
                            onCancel={() => setEditing(prev => new Set([...prev].filter(id => id !== item.id)))}
                            onDelete={() => handleAction('delete', type, item, 0)}
                          >
                            {editing.has(item.id!) && (
                              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                                {config.fields.map((field: string) => {
                                  const fieldElement = renderField(type, item, field, 0, false);
                                  // Don't render label if field is hidden (returns null)
                                  if (fieldElement === null) return null;
                                  return (
                                    <div key={field}>
                                      <label className="text-sm font-medium">{formatFieldLabel(field)}</label>
                                      {fieldElement}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CollapsibleItem>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      });
    } else {
      // For classes, use the original grouping by teacher
      return Object.entries(groupByTeacher(items, item => (item as Class).teacherEmail || '', type))
        .map(([teacher, groupItems]: [string, ItemType[]]) => (
          <div key={teacher} className="mb-4">
            <div className="flex items-center cursor-pointer p-2 bg-muted rounded-md mb-2" onClick={() => setOpenGroups(prev => ({ ...prev, [`${type}-${teacher}`]: !prev[`${type}-${teacher}`] }))}>
              {openGroups[`${type}-${teacher}`] ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              <span className="font-medium">{getTeacherName(teacher)}</span>
              <span className="ml-2 text-sm text-muted-foreground">({groupItems.length})</span>
            </div>
            {openGroups[`${type}-${teacher}`] && (
              <div className="ml-6 space-y-2">
                {groupItems.map(item => (
                  <div key={item.id} className="space-y-2">
                    <CollapsibleItem
                      title={`${(item as Class).classDay} ${(item as Class).classTime}`}
                      subtitle={(item as Class).classLocation}
                      isEditing={editing.has(item.id!)}
                      onEdit={() => setEditing(prev => new Set([...prev, item.id!]))}
                      onSave={() => handleAction('update', type, item, 0)}
                      onCancel={() => setEditing(prev => new Set([...prev].filter(id => id !== item.id)))}
                      onDelete={() => handleAction('delete', type, item, 0)}
                    >
                      {editing.has(item.id!) && (
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                          {config.fields.map((field: string) => (
                            <div key={field}>
                              <label className="text-sm font-medium">{field}</label>
                              {renderField(type, item, field, 0, false)}
                            </div>
                          ))}
                        </div>
                      )}
                    </CollapsibleItem>
                    <div className="ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBulkImport(item.id!)}
                        className="text-xs"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Import Students
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ));
    }
  };


  const handleApproveRequest = async (request: Request) => {
    if (!user?.email) return;
    try {
      await approveRequest(request.id, user.email);
      
      toast.success(`Request approved and ${request.type === 'add_student' ? 'student added' : 'student removed'}!`);
      
      // Refresh all data
      const results = await Promise.all(OPS.getAll.map(fn => fn()));
      setData({ 
        users: (results[0] || []) as ItemType[], 
        classes: (results[1] || []) as ItemType[], 
        students: (results[2] || []) as ItemType[], 
        teachers: (results[3] || []) as ItemType[],
        requests: (results[4] || []) as ItemType[]
      });
      
      // Notify other components that a request was approved
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { 
          type: 'requests', 
          action: 'approve',
          requestType: request.type
        } 
      }));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve request');
    }
  };

  const handleDeclineRequest = async (request: Request) => {
    if (!user?.email) return;
    try {
      await declineRequest(request.id, user.email);
      
      toast.success("Request declined");
      
      // Refresh requests
      const results = await Promise.all(OPS.getAll.map(fn => fn()));
      setData({ 
        users: (results[0] || []) as ItemType[], 
        classes: (results[1] || []) as ItemType[], 
        students: (results[2] || []) as ItemType[], 
        teachers: (results[3] || []) as ItemType[],
        requests: (results[4] || []) as ItemType[]
      });
      
      // Notify other components that a request was declined
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { 
          type: 'requests', 
          action: 'decline'
        } 
      }));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to decline request');
    }
  };

  const renderRequestItem = (request: Request) => {
    const classData = data.classes.find(c => c.id === request.classId) as Class | undefined;
    const student = request.studentId ? data.students.find(s => s.id === request.studentId) as Student | undefined : undefined;
    
    const title = request.type === 'add_student' 
      ? `Add: ${request.studentFirstName} ${request.studentLastName}`
      : `Remove: ${student ? `${student.firstName} ${student.lastName}` : 'Unknown Student'}`;
    
    const subtitle = `${classData ? `${classData.classLevel} - ${classData.classDay} ${classData.classTime}` : 'Unknown Class'} • ${request.teacherEmail}`;
    
    return (
      <div key={request.id} className="p-4 border rounded-lg">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex-1">
            <div className="text-lg font-semibold">{title}</div>
            <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>
          </div>
          <div className="flex gap-2 sm:flex-col">
            <Button
              onClick={() => handleApproveRequest(request)}
              variant="default"
              size="sm"
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              onClick={() => handleDeclineRequest(request)}
              variant="destructive"
              size="sm"
            >
              <X className="h-4 w-4 mr-1" />
              Decline
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderFlatItems = (type: DataType, items: ItemType[], config: { fields: string[] }) => 
    items.map(item => (
      <CollapsibleItem key={item.id} title={`${(item as AdminUser & { id: string } | Teacher).firstName} ${(item as AdminUser & { id: string } | Teacher).lastName}`} subtitle={(item as AdminUser & { id: string } | Teacher).email} isEditing={editing.has(item.id!)} onEdit={() => setEditing(prev => new Set([...prev, item.id!]))} onSave={() => handleAction('update', type, item, 0)} onCancel={() => setEditing(prev => new Set([...prev].filter(id => id !== item.id)))} onDelete={() => handleAction('delete', type, item, 0)}>
        {editing.has(item.id!) && <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">{config.fields.map((field: string) => {
          const fieldElement = renderField(type, item, field, 0, false);
          // Don't render label if field is hidden (returns null)
          if (fieldElement === null) return null;
          return <div key={field}><label className="text-sm font-medium">{formatFieldLabel(field)}</label>{fieldElement}</div>;
        })}</div>}
      </CollapsibleItem>
    ));

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      {Object.entries(CONFIG).map(([type, config]) => {
        const Icon = config.icon;
        const dataType = type as DataType;
        const items = data[dataType] || [];
        const pendingCount = dataType === 'requests' ? (items as Request[]).filter(r => r.status === 'pending').length : 0;
        
        return (
          <CollapsibleCard 
            key={type} 
            title={config.title} 
            icon={Icon} 
            badge={dataType === 'requests' 
              ? `${pendingCount}`
              : `${items.length}`
            } 
            isOpen={openSections[dataType]} 
            onToggle={open => handleAccordionToggle(dataType, open)}
          >
            {dataType === 'requests' ? (
              // Special rendering for requests - only show pending requests
              <div className="space-y-3">
                {pendingCount === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">No pending requests</div>
                ) : (
                  (items as Request[]).filter(r => r.status === 'pending').map(request => renderRequestItem(request))
                )}
              </div>
            ) : (
              // Normal rendering for other types
              <>
                {['students', 'classes'].includes(dataType) ? renderGroupedItems(dataType, items, config) : renderFlatItems(dataType, items, config)}
                {newItems[dataType]?.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">{config.fields.map(field => {
                      const fieldElement = renderField(dataType, item, field, index, true);
                      // Don't render label if field is hidden (returns null)
                      if (fieldElement === null) return null;
                      return <div key={field}><label className="text-sm font-medium">{formatFieldLabel(field)}</label>{fieldElement}</div>;
                    })}</div>
                  </div>
                ))}
                {newItems[dataType]?.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => handleAction('submit', dataType, null, 0)} variant="default">Submit {newItems[dataType].length} New {CONFIG[dataType].title}</Button>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => handleAction('add', dataType, null, 0)} variant="default"><Plus />Add New</Button>
                </div>
              </>
            )}
          </CollapsibleCard>
        );
      })}
      
      {/* Bulk Student Import Modal */}
      <BulkStudentImport
        classData={(data.classes as Class[]).find(c => c.id === showBulkImport) || null}
        isOpen={showBulkImport !== null}
        onClose={() => setShowBulkImport(null)}
        onSuccess={() => {
          // Reload data to show new students
          Promise.all(OPS.getAll.map(fn => fn()))
            .then(([users, classes, students, teachers, requests]) => setData({ 
              users: (users || []) as ItemType[], 
              classes: (classes || []) as ItemType[], 
              students: (students || []) as ItemType[], 
              teachers: (teachers || []) as ItemType[],
              requests: (requests || []) as ItemType[]
            }))
            .catch(() => setData({ users: [], classes: [], students: [], teachers: [], requests: [] }));
          
          toast.success('Students imported successfully!');
          setShowBulkImport(null);
          
          // Notify other components that data has changed
          window.dispatchEvent(new CustomEvent('dataChanged', { 
            detail: { 
              type: 'students', 
              action: 'bulk_import'
            } 
          }));
        }}
      />
    </div>
  );
};