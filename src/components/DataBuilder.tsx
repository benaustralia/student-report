import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { CollapsibleItem } from '@/components/ui/collapsible-item';
import { Plus, CheckCircle, Users, BookOpen, GraduationCap } from 'lucide-react';
import { importUsers, importClasses, importStudents, getAllUsers, getAllClasses, getAllStudents, updateUser, deleteUser, updateClass, deleteClass, updateStudent, deleteStudent, migrateToCustomIds } from '@/services/firebaseService';
import { StatisticsBar } from './StatisticsBar';

type DataType = 'users' | 'classes' | 'students';
type DataItem = Record<string, any>;

const configs = {
  users: { icon: Users, title: 'Users', fields: ['firstName', 'lastName', 'email', 'isAdmin'], empty: { firstName: '', lastName: '', email: '', isAdmin: false } },
  classes: { icon: BookOpen, title: 'Classes', fields: ['classLevel', 'classDay', 'classTime', 'classLocation', 'teacherEmail'], empty: { classLevel: '', classDay: '', classTime: '', classLocation: '', teacherEmail: '' } },
  students: { icon: GraduationCap, title: 'Students', fields: ['firstName', 'lastName', 'classId'], empty: { firstName: '', lastName: '', classId: '' } }
};

const importFns = { users: importUsers, classes: importClasses, students: importStudents };
const updateFns = { users: updateUser, classes: updateClass, students: updateStudent };
const deleteFns = { users: deleteUser, classes: deleteClass, students: deleteStudent };

export const DataBuilder = () => {
  const [data, setData] = useState<Record<DataType, DataItem[]>>({ users: [], classes: [], students: [] });
  const [newItems, setNewItems] = useState<Record<DataType, DataItem[]>>({ users: [], classes: [], students: [] });
  const [editing, setEditing] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [openSections, setOpenSections] = useState<Record<DataType, boolean>>({ users: true, classes: true, students: true });
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    Promise.all([getAllUsers(), getAllClasses(), getAllStudents()])
      .then(([users, classes, students]) => setData({ users, classes, students }))
      .finally(() => setLoading(false));
  }, []);

  const updateNewItem = (type: DataType, index: number, field: string, value: any) => 
    setNewItems(prev => ({ ...prev, [type]: prev[type].map((item, i) => i === index ? { ...item, [field]: value } : item) }));

  const updateExistingItem = (type: DataType, item: DataItem, field: string, value: any) => 
    setData(prev => ({ ...prev, [type]: prev[type].map(i => i.id === item.id ? { ...i, [field]: value } : i) }));

  const addNew = (type: DataType) => setNewItems(prev => ({ ...prev, [type]: [...prev[type], { ...configs[type].empty }] }));
  
  const removeNew = (type: DataType, index: number) => setNewItems(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));

  const submitNew = async (type: DataType) => {
    if (!newItems[type].length) return;
    try {
      await importFns[type](newItems[type]);
      setNewItems(prev => ({ ...prev, [type]: [] }));
      setMessage(`Successfully imported ${newItems[type].length} ${type}!`);
      
      // Refresh data after successful import
      const [users, classes, students] = await Promise.all([getAllUsers(), getAllClasses(), getAllStudents()]);
      setData({ users, classes, students });
    } catch (error: any) {
      setMessage(`Failed to import ${type}: ${error.message}`);
    }
  };

  const saveExisting = async (type: DataType, item: DataItem) => {
    try {
      console.log(`Updating ${type} with ID: ${item.id}`, item);
      
      // Validate classId if updating a student
      if (type === 'students' && item.classId) {
        const classExists = data.classes.some(cls => cls.id === item.classId);
        if (!classExists) {
          setMessage(`Error: Selected class does not exist. Please select a valid class.`);
          return;
        }
      }
      
      await updateFns[type](item.id, item);
      setEditing(prev => new Set([...prev].filter(id => id !== item.id)));
      setMessage(`Successfully updated ${type.slice(0, -1)}!`);
    } catch (error: any) {
      console.error(`Error updating ${type}:`, error);
      setMessage(`Failed to update: ${error.message}`);
    }
  };

  const deleteExisting = async (type: DataType, item: DataItem) => {
    try {
      await deleteFns[type](item.id);
      setData(prev => ({ ...prev, [type]: prev[type].filter(i => i.id !== item.id) }));
      setMessage(`Successfully deleted ${type.slice(0, -1)}!`);
    } catch (error: any) {
      setMessage(`Failed to delete: ${error.message}`);
    }
  };

  const runMigration = async () => {
    setIsMigrating(true);
    try {
      await migrateToCustomIds();
      setMessage('Migration completed! Refreshing data...');
      // Refresh data after migration
      const [users, classes, students] = await Promise.all([getAllUsers(), getAllClasses(), getAllStudents()]);
      setData({ users, classes, students });
    } catch (error: any) {
      setMessage(`Migration failed: ${error.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const renderField = (type: DataType, item: DataItem, field: string, index: number, isNew = false) => {
    const value = item[field] || '';
    const onChange = isNew ? (e: any) => updateNewItem(type, index, field, e.target.value) : (e: any) => updateExistingItem(type, item, field, e.target.value);
    
    if (field === 'isAdmin') {
      return (
        <Select value={value ? 'true' : 'false'} onValueChange={(v: string) => isNew ? updateNewItem(type, index, field, v === 'true') : updateExistingItem(type, item, field, v === 'true')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="true">Admin</SelectItem><SelectItem value="false">Teacher</SelectItem></SelectContent>
        </Select>
      );
    }
    
    if (field === 'classId' && type === 'students') {
      const selectedClass = data.classes.find((cls: DataItem) => cls.id === value);
      const displayValue = selectedClass ? `${selectedClass.classDay} ${selectedClass.classTime}` : '';
      
      return (
        <Select value={value} onValueChange={(v: string) => isNew ? updateNewItem(type, index, field, v) : updateExistingItem(type, item, field, v)}>
          <SelectTrigger className="min-w-[200px] bg-background border-input text-foreground">
            <SelectValue placeholder="Select a class">
              {displayValue}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-slate-900 text-white border-slate-700">
            {data.classes.map((cls: DataItem) => (
              <SelectItem 
                key={cls.id} 
                value={cls.id}
                className="text-white hover:bg-slate-700 focus:bg-slate-700"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-white">{cls.classDay} {cls.classTime}</span>
                  <span className="text-sm text-slate-300">{cls.classLocation}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    return <Input value={value} onChange={onChange} />;
  };

  const statistics = { 
    adminCount: data.users.filter(u => u.isAdmin).length, 
    teacherCount: data.users.filter(u => !u.isAdmin).length,
    classCount: data.classes.length, 
    studentCount: data.students.length 
  };

  return (
    <div className="space-y-6">
      <StatisticsBar {...statistics} loading={loading} />
      {message && <Alert><CheckCircle className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
      
      <div className="flex gap-2">
        <Button 
          onClick={runMigration} 
          disabled={isMigrating}
          variant="outline"
          className="bg-blue-50 text-blue-700 hover:bg-blue-100"
        >
          {isMigrating ? 'Migrating...' : 'Migrate to Custom IDs'}
        </Button>
      </div>
      
      {Object.entries(configs).map(([type, config]) => {
        const Icon = config.icon;
        const dataType = type as DataType;
        const isOpen = openSections[dataType];
        return (
          <CollapsibleCard
            key={type}
            title={config.title}
            icon={Icon}
            badge={`${newItems[dataType].length} new | ${data[dataType].length} existing`}
            isOpen={isOpen}
            onToggle={(open) => setOpenSections(prev => ({ ...prev, [dataType]: open }))}
          >
              {data[dataType].map((item: DataItem, index: number) => {
                // Debug: log duplicate IDs
                if (dataType === 'students' && item.id) {
                  const duplicateCount = data[dataType].filter(i => i.id === item.id).length;
                  if (duplicateCount > 1) {
                    console.warn(`Duplicate student ID found: ${item.id} (${duplicateCount} times)`);
                  }
                }

                const getTitle = () => {
                  if (dataType === 'users') return `${item.firstName} ${item.lastName}`;
                  if (dataType === 'classes') return `${item.classDay} ${item.classTime}`;
                  if (dataType === 'students') return `${item.firstName} ${item.lastName}`;
                  return item.id;
                };
                
                const getSubtitle = () => {
                  if (dataType === 'users') return item.email;
                  if (dataType === 'classes') return `${item.classLocation} • ${item.teacherEmail}`;
                  if (dataType === 'students') return `Class: ${item.classId?.slice(0, 8)}...`;
                  return '';
                };

                // Create a truly unique key
                const uniqueKey = `${dataType}-${item.id || 'no-id'}-${index}-${item.firstName || ''}-${item.lastName || ''}`;

                return (
                  <CollapsibleItem
                    key={uniqueKey}
                    title={getTitle()}
                    subtitle={getSubtitle()}
                    isEditing={editing.has(item.id)}
                    onEdit={() => setEditing(prev => new Set([...prev, item.id]))}
                    onDelete={() => deleteExisting(dataType, item)}
                    onSave={editing.has(item.id) ? () => saveExisting(dataType, item) : undefined}
                    onCancel={editing.has(item.id) ? () => setEditing(prev => new Set([...prev].filter(id => id !== item.id))) : undefined}
                  >
                    {editing.has(item.id) && (
                      <div className="grid gap-4 md:grid-cols-2">
                        {config.fields.map(field => (
                          <div key={field}><Label>{field}</Label>{renderField(dataType, item, field, 0)}</div>
                        ))}
                      </div>
                    )}
                  </CollapsibleItem>
                );
              })}

              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={() => addNew(dataType)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New
                </Button>
              </div>

              {newItems[dataType].map((item: DataItem, index: number) => (
                <div key={index} className="p-4 border rounded-lg space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {config.fields.map(field => (
                      <div key={field}><Label>{field}</Label>{renderField(dataType, item, field, index, true)}</div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => removeNew(dataType, index)}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Remove
                    </Button>
                    <Button 
                      onClick={() => submitNew(dataType)}
                      variant="default"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Submit
                    </Button>
                  </div>
                </div>
              ))}
          </CollapsibleCard>
        );
      })}
    </div>
  );
};