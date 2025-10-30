import { useState, Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { CollapsibleItem } from '@/components/ui/collapsible-item';
import { Plus, Users, BookOpen, GraduationCap, ChevronDown, ChevronRight, Upload, FileText, Check, X, Loader2 } from 'lucide-react';
import type { AdminUser, Class, Student, Teacher, Request } from '@/types';
import { useDataBuilderOperations, type DataType, type ItemType } from '@/hooks/useDataBuilderOperations';

// Lazy load heavy components
const BulkStudentImport = lazy(() => import('./BulkStudentImport').then(m => ({ default: m.BulkStudentImport })));

const CLASS_OPTIONS = { levels: ['Early Learning', 'Primary', 'Intermediate', 'Advanced', 'Master', 'Adult', 'Sketching'], days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], times: ['10:30am', '1:30pm', '3:45pm', '4:30pm'], locations: ['Mount Waverley', 'Box Hill', 'Balwyn North Primary School', 'Camberwell', 'Doncaster Gardens Primary School', 'Preston', 'Pines', 'Glen Waverley Primary School', 'Serpell Primary School'] };

const CONFIG: any = {
  CLASS_OPTIONS,
  SECTIONS: {
    requests: { icon: FileText, title: 'Requests', fields: ['type', 'status', 'teacherEmail', 'classId', 'studentId', 'studentFirstName', 'studentLastName', 'notes'], empty: { type: 'add_student', status: 'pending', teacherEmail: '', classId: '', notes: '' } },
    users: { icon: Users, title: 'Admins', fields: ['firstName', 'lastName', 'email', 'isAdmin'], empty: { firstName: '', lastName: '', email: '', isAdmin: true } },
    classes: { icon: BookOpen, title: 'Classes', fields: ['classLevel', 'classDay', 'classTime', 'classLocation', 'teacherEmail'], empty: { classLevel: '', classDay: '', classTime: '', classLocation: '', teacherEmail: '' } },
    students: { icon: GraduationCap, title: 'Students', fields: ['firstName', 'lastName', 'classId'], empty: { firstName: '', lastName: '', classId: '' } },
    teachers: { icon: Users, title: 'Teachers', fields: ['firstName', 'lastName', 'email'], empty: { firstName: '', lastName: '', email: '' } }
  },
  FIELD_CONFIGS: Object.fromEntries(['classLevel', 'classDay', 'classTime', 'classLocation'].map(field => [field, { options: CLASS_OPTIONS[field.replace('class', '').toLowerCase() + 's' as keyof typeof CLASS_OPTIONS], placeholder: `Select ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}...` }]))
};

const formatFieldLabel = (field: string) => field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
const createSelectField = (value: string, onValueChange: (v: string) => void, placeholder: string, options: string[], renderOption?: (option: string) => string) => (
  <Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option} value={option}>{renderOption?.(option) ?? option}</SelectItem>)}</SelectContent></Select>
);

interface DataBuilderUIProps {
  userEmail: string | null;
}

export function DataBuilderUI({ userEmail }: DataBuilderUIProps) {
  const emptyItems = Object.fromEntries(Object.entries(CONFIG.SECTIONS).map(([key, config]: [string, any]) => [key, config.empty])) as Record<DataType, ItemType>;
  const { data, newItems, updateItem, handleAction, handleRequestAction, handleBulkImportSuccess } = useDataBuilderOperations(emptyItems);
  
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [openSections, setOpenSections] = useState<Record<DataType, boolean>>({ requests: true, users: false, classes: false, students: false, teachers: false });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showBulkImport, setShowBulkImport] = useState<string | null>(null);

  const renderField = (type: DataType, item: ItemType, field: string, index: number, isNew: boolean) => {
    const value = (item as unknown as Record<string, unknown>)[field] as string || '';
    const updateValue = (v: string) => updateItem(type, isNew ? index : item.id || '', field, v, isNew);
    const classes = data.classes;
    const teachers = data.teachers;
    
    return field === 'classId' && type === 'students' ? createSelectField(value, updateValue, 'Select class', classes.map(c => c.id || ''), (id) => {
      const cls = classes.find(c => c.id === id) as Class;
      return `${cls.classDay} ${cls.classTime} - ${cls.classLevel}`;
    }) :
    CONFIG.FIELD_CONFIGS[field as keyof typeof CONFIG.FIELD_CONFIGS] && type === 'classes' ? (() => {
      const fieldConfig = CONFIG.FIELD_CONFIGS[field as keyof typeof CONFIG.FIELD_CONFIGS];
      return createSelectField(value, updateValue, fieldConfig.placeholder, fieldConfig.options);
    })() :
    field === 'teacherEmail' && type === 'classes' ? createSelectField(value, updateValue, 'Select teacher...', 
      teachers.map(t => (t as Teacher).email),
      (email) => {
        const teacher = teachers.find(t => (t as Teacher).email === email) as Teacher;
        return `${teacher.firstName} ${teacher.lastName} (${email})`;
      }
    ) :
    field === 'isAdmin' && type === 'users' && !isNew ? (
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={(item as AdminUser)[field as keyof AdminUser] as boolean || false}
          onChange={(e) => updateItem(type, isNew ? index : item.id || '', field, e.target.checked, isNew)}
          className="rounded border-gray-300"
        />
        <span className="text-sm text-muted-foreground">Admin privileges</span>
      </div>
    ) : <Input value={value} onChange={e => updateValue(e.target.value)} />;
  };

  const renderItems = (type: DataType, items: ItemType[], { fields }: { fields: string[] }) => {
    const isGrouped = ['students', 'classes'].includes(type);
    const classes = data.classes;
    const teachers = data.teachers;

    return !isGrouped ? items.map(item => (
      <CollapsibleItem 
        key={item.id} 
        title={`${(item as AdminUser & { id: string } | Teacher).firstName} ${(item as AdminUser & { id: string } | Teacher).lastName}`} 
        subtitle={(item as AdminUser & { id: string } | Teacher).email} 
        isEditing={editing.has(item.id!)} 
        onEdit={() => setEditing(prev => new Set([...prev, item.id!]))} 
        onSave={() => handleAction('update', type, item, 0)} 
        onCancel={() => setEditing(prev => new Set([...prev].filter(id => id !== item.id)))} 
        onDelete={() => handleAction('delete', type, item, 0)}
      >
        {editing.has(item.id!) && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {fields.map(field => {
              const fieldElement = renderField(type, item, field, 0, false);
              return fieldElement === null ? null : (
                <div key={field}>
                  <label className="text-sm font-medium">{type === 'classes' ? field : formatFieldLabel(field)}</label>
                  {fieldElement}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleItem>
    )) : (() => {
    const teacherGroups = items.reduce((groups, item) => {
      const teacher = (type === 'students' ? (classes.find(c => c.id === (item as Student).classId) as Class)?.teacherEmail || '' : (item as Class).teacherEmail || '') || (type === 'students' ? 'No Class Assigned' : 'No Teacher');
      return { ...groups, [teacher]: [...(groups[teacher] || []), item] };
    }, {} as Record<string, ItemType[]>);
    
    return Object.entries(teacherGroups).map(([teacher, groupItems]) => {
      const classGroups = type === 'students' ? groupItems.reduce((groups, item) => {
        const classId = (item as Student).classId || 'No Class';
        const className = classId === 'No Class' ? 'No Class Assigned' : 
          `${(classes.find(c => c.id === classId) as Class)?.classDay} ${(classes.find(c => c.id === classId) as Class)?.classTime}` || 'Unknown Class';
        return { ...groups, [className]: [...(groups[className] || []), item] };
      }, {} as Record<string, ItemType[]>) : { [teacher]: groupItems };

      return (
        <div key={teacher} className="mb-4">
          <div className="flex items-center cursor-pointer p-2 bg-muted rounded-md mb-2" onClick={() => setOpenGroups(prev => ({ ...prev, [`${type}-${teacher}`]: !prev[`${type}-${teacher}`] }))}>
            {openGroups[`${type}-${teacher}`] ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
            <span className="font-medium">{teachers.find(t => (t as Teacher).email === teacher) ? `${(teachers.find(t => (t as Teacher).email === teacher) as Teacher).firstName} ${(teachers.find(t => (t as Teacher).email === teacher) as Teacher).lastName}` : teacher}</span>
            <span className="ml-2 text-sm text-muted-foreground">({groupItems.length})</span>
          </div>
          {openGroups[`${type}-${teacher}`] && (
            <div className="ml-6 space-y-3">
              {Object.entries(classGroups).map(([className, classItems]: [string, ItemType[]]) => (
                <div key={className}>
                  {type === 'students' ? (
                    <div className="flex items-center cursor-pointer p-2 bg-muted/50 rounded-md mb-2" onClick={() => setOpenGroups(prev => ({ ...prev, [`${type}-${teacher}-${className}`]: !prev[`${type}-${teacher}-${className}`] }))}>
                      {openGroups[`${type}-${teacher}-${className}`] ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                      <span className="font-medium text-sm">{className}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({classItems.length})</span>
                    </div>
                  ) : null}
                  {(type === 'classes' || openGroups[`${type}-${teacher}-${className}`]) ? (
                    <div className={type === 'students' ? 'ml-6 space-y-2' : 'space-y-2'}>
                      {classItems.map(item => (
                        <div key={item.id} className={type === 'classes' ? 'space-y-2' : ''}>
                          <CollapsibleItem
                            title={type === 'students' 
                              ? `${(item as Student).firstName} ${(item as Student).lastName}`
                              : `${(item as Class).classDay} ${(item as Class).classTime}`
                            }
                            subtitle={type === 'students' 
                              ? `${(classes.find(c => c.id === (item as Student).classId) as Class)?.classLevel || 'No Class'}`
                              : `${(item as Class).classLocation}`
                            }
                            isEditing={editing.has(item.id!)}
                            onEdit={() => setEditing(prev => new Set([...prev, item.id!]))}
                            onSave={() => handleAction('update', type, item, 0)}
                            onCancel={() => setEditing(prev => new Set([...prev].filter(id => id !== item.id)))}
                            onDelete={() => handleAction('delete', type, item, 0)}
                          >
                            {editing.has(item.id!) && (
                              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                                {fields.map(field => {
                                  const fieldElement = renderField(type, item, field, 0, false);
                                  return fieldElement === null ? null : (
                                    <div key={field}>
                                      <label className="text-sm font-medium">{type === 'classes' ? field : formatFieldLabel(field)}</label>
                                      {fieldElement}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CollapsibleItem>
                          {type === 'classes' ? (
                            <div className="ml-4">
                              <Button variant="outline" size="sm" onClick={() => setShowBulkImport(item.id!)} className="text-xs">
                                <Upload className="h-3 w-3 mr-1" />Import Students
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
    })();
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      {Object.entries(CONFIG.SECTIONS).map(([type, config]: [string, any]) => {
        const { icon: Icon, title, fields } = config;
        const dataType = type as DataType;
        const items = data[dataType] || [];
        const pendingCount = dataType === 'requests' ? (items as Request[]).filter(r => r.status === 'pending').length : 0;
        
        return (
          <CollapsibleCard 
            key={type} 
            title={title}
            icon={Icon} 
            badge={dataType === 'requests' ? `${pendingCount}` : `${items.length}`} 
            isOpen={openSections[dataType]} 
            onToggle={open => {
              setOpenSections(prev => open ? { requests: false, users: false, classes: false, students: false, teachers: false, [dataType]: true } : { ...prev, [dataType]: false });
            }}
          >
            {dataType === 'requests' ? (
              <div className="space-y-3">
                {pendingCount === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">No pending requests</div>
                ) : (
                  (items as Request[]).filter(r => r.status === 'pending').map(request => {
                    const classData = data.classes.find(c => c.id === request.classId) as Class | undefined;
                    const student = request.studentId ? data.students.find(s => s.id === request.studentId) as Student | undefined : undefined;
                    return (
                      <div key={request.id} className="p-4 border rounded-lg">
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-lg font-semibold">
                              {request.type === 'add_student' 
                                ? `Add: ${request.studentFirstName} ${request.studentLastName}`
                                : `Remove: ${student ? `${student.firstName} ${student.lastName}` : 'Unknown Student'}`
                              }
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {`${classData ? `${classData.classLevel} - ${classData.classDay} ${classData.classTime}` : 'Unknown Class'} • ${request.teacherEmail}`}
                            </div>
                          </div>
                          <div className="flex gap-2 sm:flex-col">
                            <Button onClick={() => handleRequestAction(request, 'approve', userEmail || '')} variant="default" size="sm">
                              <Check className="h-4 w-4 mr-1" />Approve
                            </Button>
                            <Button onClick={() => handleRequestAction(request, 'decline', userEmail || '')} variant="destructive" size="sm">
                              <X className="h-4 w-4 mr-1" />Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <>
                {renderItems(dataType, items, { fields })}
                {newItems[dataType]?.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      {fields.map((field: string) => {
                        const fieldElement = renderField(dataType, item, field, index, true);
                        return fieldElement && (
                          <div key={field}>
                            <label className="text-sm font-medium">{formatFieldLabel(field)}</label>
                            {fieldElement}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {newItems[dataType]?.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => handleAction('submit', dataType, null, 0)} variant="default">
                      Submit {newItems[dataType].length} New {title}
                    </Button>
                  </div>
                ) : null}
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => handleAction('add', dataType, null, 0)} variant="default">
                    <Plus />Add New
                  </Button>
                </div>
              </>
            )}
          </CollapsibleCard>
        );
      })}
      
      {showBulkImport && (
        <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
          <BulkStudentImport
            classData={(data.classes as Class[]).find(c => c.id === showBulkImport) || null}
            isOpen={showBulkImport !== null}
            onClose={() => setShowBulkImport(null)}
            onSuccess={async () => {
              await handleBulkImportSuccess();
              setShowBulkImport(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

