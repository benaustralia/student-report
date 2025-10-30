import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CollapsibleItem } from '@/components/ui/collapsible-item';
import { Input } from '@/components/ui/input';
import type { AdminUser, Class, Student, Teacher, Request } from '@/types';
import type { DataType, ItemType } from '@/hooks/useDataBuilderOperations';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';

export const createSelectField = (
  value: string,
  onValueChange: (v: string) => void,
  placeholder: string,
  options: string[],
  renderOption?: (option: string) => string
) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>
      {options.map(option => (
        <SelectItem key={option} value={option}>
          {renderOption?.(option) ?? option}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export function renderFieldUI(
  type: DataType,
  item: ItemType,
  field: string,
  index: number,
  isNew: boolean,
  updateItem: (type: DataType, id: string | number, field: string, value: any, isNew: boolean) => void,
  data: { classes: Class[]; teachers: Teacher[] },
  fieldConfigs: Record<string, { options: string[]; placeholder: string }>
) {
  const value = (item as unknown as Record<string, unknown>)[field] as string || '';
  const updateValue = (v: string | boolean) => updateItem(type, isNew ? index : (item.id as any) || '', field, v, isNew);
  const classes = data.classes;
  const teachers = data.teachers;
  if (field === 'classId' && type === 'students') {
    return createSelectField(value, (v) => updateValue(v), 'Select class', classes.map(c => c.id || ''), (id) => {
      const cls = classes.find(c => c.id === id) as Class;
      return `${cls.classDay} ${cls.classTime} - ${cls.classLevel}`;
    });
  }
  if (fieldConfigs[field] && type === 'classes') {
    const cfg = fieldConfigs[field];
    return createSelectField(value, (v) => updateValue(v), cfg.placeholder, cfg.options);
  }
  if (field === 'teacherEmail' && type === 'classes') {
    return createSelectField(value, (v) => updateValue(v), 'Select teacher...', teachers.map(t => (t as Teacher).email), (email) => {
      const t = teachers.find(tt => (tt as Teacher).email === email) as Teacher;
      return `${t.firstName} ${t.lastName} (${email})`;
    });
  }
  if (field === 'isAdmin' && type === 'users' && !isNew) {
    return (
      <div className="flex items-center space-x-2">
        <input type="checkbox" checked={(item as AdminUser)[field as keyof AdminUser] as boolean || false} onChange={(e) => updateValue(e.target.checked)} className="rounded border-gray-300" />
        <span className="text-sm text-muted-foreground">Admin privileges</span>
      </div>
    );
  }
  return <Input value={value} onChange={e => updateValue(e.target.value)} />;
}

export function renderItemsUI(
  type: DataType,
  items: ItemType[],
  fields: string[],
  editing: Set<string>,
  setEditing: (updater: (prev: Set<string>) => Set<string>) => void,
  updateItem: (type: DataType, id: string | number, field: string, value: any, isNew: boolean) => void,
  handleAction: (action: 'update' | 'delete', type: DataType, item: ItemType, page: number) => void,
  data: { classes: Class[]; teachers: Teacher[] },
  fieldConfigs: Record<string, { options: string[]; placeholder: string }>,
  formatFieldLabel: (field: string) => string
): ReactNode {
  const isGrouped = ['students', 'classes'].includes(type);
  const classes = data.classes;
  const teachers = data.teachers;
  if (!isGrouped) {
    return items.map(item => (
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
            {fields.map(field => (
              <div key={field}>
                <label className="text-sm font-medium">{type === 'classes' ? field : formatFieldLabel(field)}</label>
                {renderFieldUI(type, item, field, 0, false, updateItem, data, fieldConfigs)}
              </div>
            ))}
          </div>
        )}
      </CollapsibleItem>
    ));
  }
  const teacherGroups = items.reduce((groups, item) => {
    const teacher = (type === 'students' ? (classes.find(c => c.id === (item as Student).classId) as Class)?.teacherEmail || '' : (item as Class).teacherEmail || '') || (type === 'students' ? 'No Class Assigned' : 'No Teacher');
    return { ...groups, [teacher]: [...(groups[teacher] || []), item] };
  }, {} as Record<string, ItemType[]>);
  return Object.entries(teacherGroups).map(([teacher, groupItems]) => {
    const classGroups = type === 'students' ? groupItems.reduce((groups, item) => {
      const classId = (item as Student).classId || 'No Class';
      const className = classId === 'No Class' ? 'No Class Assigned' : `${(classes.find(c => c.id === classId) as Class)?.classDay} ${(classes.find(c => c.id === classId) as Class)?.classTime}` || 'Unknown Class';
      return { ...groups, [className]: [...(groups[className] || []), item] };
    }, {} as Record<string, ItemType[]>) : { [teacher]: groupItems };
    return (
      <div key={teacher} className="mb-4">
        <div className="flex items-center cursor-pointer p-2 bg-muted rounded-md mb-2" onClick={() => setEditing(prev => new Set(prev)) /* placeholder to keep signature */}>
          <ChevronRight className="h-4 w-4 mr-2" />
          <span className="font-medium">{teachers.find(t => (t as Teacher).email === teacher) ? `${(teachers.find(t => (t as Teacher).email === teacher) as Teacher).firstName} ${(teachers.find(t => (t as Teacher).email === teacher) as Teacher).lastName}` : teacher}</span>
          <span className="ml-2 text-sm text-muted-foreground">({groupItems.length})</span>
        </div>
        <div className="ml-6 space-y-3">
          {Object.entries(classGroups).map(([className, classItems]) => (
            <div key={className as string}>
              {(type === 'students') ? (
                <div className="flex items-center cursor-pointer p-2 bg-muted/50 rounded-md mb-2">
                  <ChevronDown className="h-4 w-4 mr-2" />
                  <span className="font-medium text-sm">{className as string}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{(classItems as ItemType[]).length}</span>
                </div>
              ) : null}
              <div className={type === 'students' ? 'ml-6 space-y-2' : 'space-y-2'}>
                {(classItems as ItemType[]).map(item => (
                  <div key={item.id} className={type === 'classes' ? 'space-y-2' : ''}>
                    <CollapsibleItem
                      title={type === 'students' ? `${(item as Student).firstName} ${(item as Student).lastName}` : `${(item as Class).classDay} ${(item as Class).classTime}`}
                      subtitle={type === 'students' ? `${(classes.find(c => c.id === (item as Student).classId) as Class)?.classLevel || 'No Class'}` : `${(item as Class).classLocation}`}
                      isEditing={editing.has(item.id!)}
                      onEdit={() => setEditing(prev => new Set([...prev, item.id!]))}
                      onSave={() => handleAction('update', type, item, 0)}
                      onCancel={() => setEditing(prev => new Set([...prev].filter(id => id !== item.id)))}
                      onDelete={() => handleAction('delete', type, item, 0)}
                    >
                      {editing.has(item.id!) && (
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                          {fields.map(field => (
                            <div key={field}>
                              <label className="text-sm font-medium">{type === 'classes' ? field : formatFieldLabel(field)}</label>
                              {renderFieldUI(type, item, field, 0, false, updateItem, data, fieldConfigs)}
                            </div>
                          ))}
                        </div>
                      )}
                    </CollapsibleItem>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  });
}
