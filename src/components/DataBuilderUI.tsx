import { useState, Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { CollapsibleItem } from '@/components/ui/collapsible-item';
import { Plus, Users, BookOpen, GraduationCap, ChevronDown, ChevronRight, Upload, FileText, Check, X, Loader2 } from 'lucide-react';
import type { AdminUser, Class, Student, Teacher, Request } from '@/types';
import { useDataBuilderOperations, type DataType, type ItemType } from '@/hooks/useDataBuilderOperations';
import { CONFIG, CLASS_OPTIONS, formatFieldLabel } from '@/config/dataBuilder';
import { createSelectField, renderFieldUI, renderItemsUI } from '@/components/helpers/dataBuilderUI';

// Lazy load heavy components
const BulkStudentImport = lazy(() => import('./BulkStudentImport').then(m => ({ default: m.BulkStudentImport })));

 
 

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

  const renderField = (type: DataType, item: ItemType, field: string, index: number, isNew: boolean) =>
    renderFieldUI(type, item, field, index, isNew, updateItem, { classes: data.classes as Class[], teachers: data.teachers as Teacher[] }, CONFIG.FIELD_CONFIGS);

  const renderItems = (type: DataType, items: ItemType[], { fields }: { fields: string[] }) =>
    renderItemsUI(type, items, fields, editing, (up) => setEditing(up), updateItem, handleAction, { classes: data.classes as Class[], teachers: data.teachers as Teacher[] }, CONFIG.FIELD_CONFIGS, formatFieldLabel);

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

