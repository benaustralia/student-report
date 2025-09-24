import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { CollapsibleItem } from '@/components/ui/collapsible-item';
import { Plus, CheckCircle, Users, BookOpen, GraduationCap, ChevronDown, ChevronRight } from 'lucide-react';
import { importUsers, importClasses, importStudents, importTeachers, getAllUsers, getAllClasses, getAllStudents, getAllTeachers, updateUser, deleteUser, updateClass, deleteClass, updateStudent, deleteStudent, updateTeacher, deleteTeacher } from '@/services/firebaseService';
import { StatisticsBar } from './StatisticsBar';
import type { AdminUser, Class, Student, Teacher } from '@/types';

type DataType = 'users' | 'classes' | 'students' | 'teachers';
type ItemType = AdminUser | Class | Student | Teacher;

const CONFIG = {
  users: { icon: Users, title: 'Admins', fields: ['firstName', 'lastName', 'email', 'isAdmin'], empty: { firstName: '', lastName: '', email: '', isAdmin: false } },
  classes: { icon: BookOpen, title: 'Classes', fields: ['classLevel', 'classDay', 'classTime', 'classLocation', 'teacherEmail'], empty: { classLevel: '', classDay: '', classTime: '', classLocation: '', teacherEmail: '' } },
  students: { icon: GraduationCap, title: 'Students', fields: ['firstName', 'lastName', 'classId'], empty: { firstName: '', lastName: '', classId: '' } },
  teachers: { icon: Users, title: 'Teachers', fields: ['firstName', 'lastName', 'email'], empty: { firstName: '', lastName: '', email: '' } }
};

const OPS = { 
  import: { users: importUsers, classes: importClasses, students: importStudents, teachers: importTeachers }, 
  update: { users: updateUser, classes: updateClass, students: updateStudent, teachers: updateTeacher }, 
  delete: { users: deleteUser, classes: deleteClass, students: deleteStudent, teachers: deleteTeacher }, 
  getAll: [getAllUsers, getAllClasses, getAllStudents, getAllTeachers] 
};

export const DataBuilder = () => {
  const [data, setData] = useState<Record<DataType, ItemType[]>>({ users: [], classes: [], students: [], teachers: [] });
  const [newItems, setNewItems] = useState<Record<DataType, ItemType[]>>({ users: [], classes: [], students: [], teachers: [] });
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [openSections, setOpenSections] = useState<Record<DataType, boolean>>({ users: true, classes: true, students: true, teachers: true });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all(OPS.getAll.map(fn => fn()))
      .then(([users, classes, students, teachers]) => setData({ 
        users: (users || []) as ItemType[], 
        classes: (classes || []) as ItemType[], 
        students: (students || []) as ItemType[], 
        teachers: (teachers || []) as ItemType[] 
      }))
      .catch(() => setData({ users: [], classes: [], students: [], teachers: [] }))
      .finally(() => setLoading(false));
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
        setMessage(`Imported ${newItems[type].length} ${type}!`);
        const results = await Promise.all(OPS.getAll.map(fn => fn()));
        setData({ 
          users: (results[0] || []) as ItemType[], 
          classes: (results[1] || []) as ItemType[], 
          students: (results[2] || []) as ItemType[], 
          teachers: (results[3] || []) as ItemType[] 
        });
        // Notify other components that data has changed
        window.dispatchEvent(new CustomEvent('dataChanged', { detail: { type } }));
      } else if (action === 'update' && item?.id) {
        await OPS.update[type](item.id, item);
        setEditing(prev => new Set([...prev].filter(id => id !== item.id)));
        setMessage(`Updated ${type.slice(0, -1)}!`);
        // Refresh data after update to ensure UI reflects changes
        const results = await Promise.all(OPS.getAll.map(fn => fn()));
        setData({ 
          users: (results[0] || []) as ItemType[], 
          classes: (results[1] || []) as ItemType[], 
          students: (results[2] || []) as ItemType[], 
          teachers: (results[3] || []) as ItemType[] 
        });
        // Notify other components that data has changed
        window.dispatchEvent(new CustomEvent('dataChanged', { detail: { type } }));
      } else if (action === 'delete' && item?.id) {
        await OPS.delete[type](item.id);
        setData(prev => ({ ...prev, [type]: prev[type].filter(i => i.id !== item.id) }));
        setMessage(`Deleted ${type.slice(0, -1)}!`);
        // Notify other components that data has changed
        window.dispatchEvent(new CustomEvent('dataChanged', { detail: { type } }));
      }
    } catch (error: unknown) { setMessage(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`); }
  };

  const renderField = (type: DataType, item: ItemType, field: string, index: number, isNew: boolean) => 
    field === 'classId' && type === 'students' ? (
      <Select 
        value={((item as Student)[field as keyof Student] as string) || ''} 
        onValueChange={async (v) => {
          // Update local state first
          updateItem(type, isNew ? index : (item.id || ''), field, v, isNew);
          
          // If not a new item, automatically save to Firebase
          if (!isNew && item.id) {
            const updatedItem = { ...item, [field]: v };
            try {
              console.log('Auto-saving class assignment:', { type, updatedItem });
              await OPS.update[type](item.id, updatedItem);
              setMessage(`Student assigned to class!`);
              // Refresh data to ensure UI reflects the change
              const results = await Promise.all(OPS.getAll.map(fn => fn()));
              setData({ 
                users: (results[0] || []) as ItemType[], 
                classes: (results[1] || []) as ItemType[], 
                students: (results[2] || []) as ItemType[], 
                teachers: (results[3] || []) as ItemType[] 
              });
            } catch (error: unknown) {
              console.error('Failed to save class assignment:', error);
              setMessage(`Failed to assign student: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    ) : (
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

  const renderGroupedItems = (type: DataType, items: ItemType[], config: { fields: string[] }) => 
    Object.entries(groupByTeacher(items, item => type === 'students' ? (data.classes.find(c => c.id === (item as Student).classId) as Class)?.teacherEmail || '' : type === 'classes' ? (item as Class).teacherEmail || '' : '', type))
      .map(([teacher, groupItems]: [string, ItemType[]]) => (
        <div key={teacher} className="mb-4">
          <div className="flex items-center cursor-pointer p-2 bg-gray-100 dark:bg-gray-800 rounded-md mb-2" onClick={() => setOpenGroups(prev => ({ ...prev, [`${type}-${teacher}`]: !prev[`${type}-${teacher}`] }))}>
            {openGroups[`${type}-${teacher}`] ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
            <span className="font-medium">{getTeacherName(teacher)}</span>
            <span className="ml-2 text-sm text-gray-500">({groupItems.length})</span>
          </div>
          {openGroups[`${type}-${teacher}`] && (
            <div className="ml-6 space-y-2">
              {groupItems.map(item => (
                <CollapsibleItem
                  key={item.id}
                  title={
                    type === 'students'
                      ? `${(item as Student).firstName} ${(item as Student).lastName}`
                      : type === 'classes' ? `${(item as Class).classDay} ${(item as Class).classTime}` : ''
                  }
                  subtitle={
                    type === 'students'
                      ? (data.classes.find(c => c.id === (item as Student).classId) as Class)?.classDay
                      : type === 'classes' ? (item as Class).classLocation : ''
                  }
                  isEditing={editing.has(item.id!)}
                  onEdit={() => setEditing(prev => new Set([...prev, item.id!]))}
                  onSave={() =>
                    handleAction(
                      'update',
                      type,
                      item,
                      0
                    )
                  }
                  onCancel={() =>
                    setEditing(prev =>
                      new Set([...prev].filter(id => id !== item.id))
                    )
                  }
                  onDelete={() => handleAction('delete', type, item, 0)}
                >
                  {editing.has(item.id!) && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {config.fields.map((field: string) => (
                        <div key={field}>
                          <label className="text-sm font-medium">{field}</label>
                          {renderField(type, item, field, 0, false)}
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleItem>
              ))}
            </div>
          )}
        </div>
      ));

  const renderFlatItems = (type: DataType, items: ItemType[], config: { fields: string[] }) => 
    items.map(item => (
      <CollapsibleItem key={item.id} title={`${(item as AdminUser & { id: string } | Teacher).firstName} ${(item as AdminUser & { id: string } | Teacher).lastName}`} subtitle={(item as AdminUser & { id: string } | Teacher).email} isEditing={editing.has(item.id!)} onEdit={() => setEditing(prev => new Set([...prev, item.id!]))} onSave={() => handleAction('update', type, item, 0)} onCancel={() => setEditing(prev => new Set([...prev].filter(id => id !== item.id)))} onDelete={() => handleAction('delete', type, item, 0)}>
        {editing.has(item.id!) && <div className="grid gap-4 md:grid-cols-2">{config.fields.map((field: string) => <div key={field}><label className="text-sm font-medium">{field}</label>{renderField(type, item, field, 0, false)}</div>)}</div>}
      </CollapsibleItem>
    ));

  return (
    <div className="space-y-6">
      <StatisticsBar adminCount={data.users.filter(u => (u as AdminUser & { id: string }).isAdmin).length} teacherCount={data.teachers.length} classCount={data.classes.length} studentCount={data.students.length} loading={loading} />
      {message && <Alert><CheckCircle className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
      
      {Object.entries(CONFIG).map(([type, config]) => {
        const Icon = config.icon;
        const dataType = type as DataType;
        const items = data[dataType] || [];
        return (
          <CollapsibleCard key={type} title={config.title} icon={Icon} badge={`${newItems[dataType]?.length || 0} new | ${items.length} existing`} isOpen={openSections[dataType]} onToggle={open => setOpenSections(prev => ({ ...prev, [dataType]: open }))}>
            {['students', 'classes'].includes(dataType) ? renderGroupedItems(dataType, items, config) : renderFlatItems(dataType, items, config)}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => handleAction('add', dataType, null, 0)} className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" />Add New</Button>
              {newItems[dataType]?.length > 0 && <Button onClick={() => handleAction('submit', dataType, null, 0)} className="bg-green-600 hover:bg-green-700 text-white">Submit {newItems[dataType].length} New {config.title}</Button>}
            </div>
            {newItems[dataType]?.map((item, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="grid gap-4 md:grid-cols-2">{config.fields.map(field => <div key={field}><label className="text-sm font-medium">{field}</label>{renderField(dataType, item, field, index, true)}</div>)}</div>
                <Button onClick={() => handleAction('remove', dataType, null, index)} variant="destructive" size="sm">Remove</Button>
              </div>
            ))}
          </CollapsibleCard>
        );
      })}
    </div>
  );
};