import React, { useReducer, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, CheckCircle, Users, BookOpen, GraduationCap, FileText, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { importUsers, importClasses, importStudents, importReports, getAllUsers, getAllClasses, getAllStudents, getAllTeachers } from '@/services/firebaseService';
import { StatisticsBar } from './StatisticsBar';

type DataType = 'users' | 'classes' | 'students' | 'reports';
type DataItem = Record<string, any>;
type State = { editing: Record<DataType, DataItem[]>; stats: Record<DataType, DataItem[]> & { teachers: DataItem[] }; ui: { loadingStats: boolean; importing: boolean; importMessage: string; refreshKey: number; openSections: Record<DataType, boolean> }; };

const reducer = (state: State, action: any): State => {
  const { type, dataType, index, field, value, item, section, payload } = action;
  switch (type) {
    case 'SET_STATS': return { ...state, stats: { ...state.stats, ...payload } };
    case 'SET_UI': return { ...state, ui: { ...state.ui, ...payload } };
    case 'ADD_ITEM': return { ...state, editing: { ...state.editing, [dataType as DataType]: [...state.editing[dataType as DataType], item] }, ui: { ...state.ui, refreshKey: state.ui.refreshKey + 1 } };
    case 'UPDATE_ITEM': return { ...state, editing: { ...state.editing, [dataType as DataType]: state.editing[dataType as DataType].map((i: any, idx: number) => idx === index ? { ...i, [field]: value } : i) } };
    case 'REMOVE_ITEM': return { ...state, editing: { ...state.editing, [dataType as DataType]: state.editing[dataType as DataType].filter((_: any, i: number) => i !== index) }, ui: { ...state.ui, refreshKey: state.ui.refreshKey + 1 } };
    case 'CLEAR_EDITING': return { ...state, editing: { ...state.editing, [dataType as DataType]: [] }, ui: { ...state.ui, refreshKey: state.ui.refreshKey + 1 } };
    case 'TOGGLE_SECTION': return { ...state, ui: { ...state.ui, openSections: { ...state.ui.openSections, [section as DataType]: !state.ui.openSections[section as DataType] } } };
    default: return state;
  }
};

const configs = {
  users: { fields: ['firstName', 'lastName', 'email', 'isAdmin'], grid: 'md:grid-cols-4', empty: { firstName: '', lastName: '', email: '', isAdmin: false } },
  classes: { fields: ['classLevel', 'classDay', 'classTime', 'classLocation', 'teacherFirstName', 'teacherLastName', 'teacherEmail'], grid: 'md:grid-cols-4', empty: { classDay: '', classTime: '', classLevel: '', classLocation: '', teacherFirstName: '', teacherLastName: '', teacherEmail: '' } },
  students: { fields: ['firstName', 'lastName', 'classId', 'parentName', 'parentEmail', 'parentPhone', 'dateOfBirth', 'notes'], grid: 'md:grid-cols-3', empty: { firstName: '', lastName: '', classId: '', parentName: '', parentEmail: '', parentPhone: '', dateOfBirth: '', notes: '' } },
  reports: { fields: ['studentFirstName', 'studentLastName', 'classDay', 'classTime', 'classLevel', 'classLocation', 'teacherFirstName', 'teacherLastName', 'teacherEmail', 'reportText'], grid: 'md:grid-cols-3', empty: { studentFirstName: '', studentLastName: '', classDay: '', classTime: '', classLevel: '', classLocation: '', teacherFirstName: '', teacherLastName: '', teacherEmail: '', reportText: '' } }
};

const icons = { users: Users, classes: BookOpen, students: GraduationCap, reports: FileText };
const titles = { users: 'Admin & Teachers', classes: 'Classes', students: 'Students', reports: 'Reports' };
const importFns = { users: importUsers, classes: importClasses, students: importStudents, reports: importReports };

export const DataBuilder: React.FC = () => {
  const [state, dispatch] = useReducer(reducer, { editing: { users: [], classes: [], students: [], reports: [] }, stats: { users: [], teachers: [], classes: [], students: [], reports: [] }, ui: { loadingStats: true, importing: false, importMessage: '', refreshKey: 0, openSections: { users: true, classes: true, students: true, reports: true } } });
  const { editing, stats, ui } = state;

  useEffect(() => {
    (async () => {
      dispatch({ type: 'SET_UI', payload: { loadingStats: true } });
      try {
        const [users, teachers, classes, students] = await Promise.all([getAllUsers().catch(() => []), getAllTeachers().catch(() => []), getAllClasses().catch(() => []), getAllStudents().catch(() => [])]);
        const userMap = new Map();
        [...teachers, ...users].forEach(u => u.email && userMap.set(u.email, { ...u, isAdmin: u.isAdmin || false }));
        dispatch({ type: 'SET_STATS', payload: { users: Array.from(userMap.values()).filter(u => u.isAdmin), teachers: Array.from(new Map(teachers.map(t => [t.email, t])).values()), classes, students } });
      } catch (error) { console.error('Error loading data:', error); } finally { dispatch({ type: 'SET_UI', payload: { loadingStats: false } }); }
    })();
  }, []);

  const statistics = useMemo(() => ({ adminCount: stats.users.length + editing.users.filter(u => u.isAdmin).length, teacherCount: stats.teachers.length + editing.users.filter(u => !u.isAdmin).length, classCount: stats.classes.length + editing.classes.length, studentCount: stats.students.length + editing.students.length }), [stats, editing, ui.refreshKey]);
  const uniqueExistingUsers = useMemo(() => stats.users.length + stats.teachers.filter(t => !stats.users.some(u => u.email === t.email)).length, [stats]);

  const handlers = useMemo(() => ({
    add: (dataType: DataType) => dispatch({ type: 'ADD_ITEM', dataType, item: configs[dataType].empty }),
    update: (dataType: DataType, index: number, field: string, value: any) => dispatch({ type: 'UPDATE_ITEM', dataType, index, field, value }),
    remove: (dataType: DataType, index: number) => dispatch({ type: 'REMOVE_ITEM', dataType, index }),
    toggle: (section: DataType) => dispatch({ type: 'TOGGLE_SECTION', section }),
    submit: async (dataType: DataType) => {
      if (editing[dataType].length === 0) return;
      dispatch({ type: 'SET_UI', payload: { importing: true, importMessage: '' } });
      try { await importFns[dataType](editing[dataType]); dispatch({ type: 'CLEAR_EDITING', dataType }); dispatch({ type: 'SET_UI', payload: { importMessage: `Successfully imported ${editing[dataType].length} ${dataType}!` } }); } catch (error) { dispatch({ type: 'SET_UI', payload: { importMessage: `Failed to import ${dataType}: ${(error as Error).message}` } }); } finally { dispatch({ type: 'SET_UI', payload: { importing: false } }); }
    }
  }), [editing]);

  const checkDuplicate = useCallback((dataType: DataType, item: DataItem, excludeIndex?: number) => {
    const allItems = [...(stats[dataType] || []), ...editing[dataType]];
    return allItems.find((existing, index) => {
      if (index === excludeIndex) return false;
      if (dataType === 'users') return existing.email === item.email;
      if (dataType === 'classes') return Object.keys(item).every(key => existing[key] === item[key]);
      if (dataType === 'students') return existing.firstName === item.firstName && existing.lastName === item.lastName && existing.classId === item.classId;
      return false;
    });
  }, [stats, editing]);

  const renderForm = (dataType: DataType, items: DataItem[]) => items.map((item, index) => {
    const duplicate = checkDuplicate(dataType, item, index);
    return (
      <div key={index} className="p-4 border rounded-lg space-y-4">
        {duplicate && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
            <AlertCircle className="h-4 w-4" />
            {dataType === 'users' ? `User with email ${item.email} already exists` : dataType === 'classes' ? 'Class already exists for this teacher, day, time, level, and location' : `Student ${item.firstName} ${item.lastName} already exists in this class`}
          </div>
        )}
        <div className={`grid grid-cols-1 ${configs[dataType].grid} gap-4`}>
          {configs[dataType].fields.map(field => (
            <div key={field}>
              <Label>{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</Label>
              {field === 'reportText' ? (
                <Textarea value={item[field]} onChange={e => handlers.update(dataType, index, field, e.target.value)} placeholder="Enter the report content..." rows={4} />
              ) : field === 'isAdmin' ? (
                <Select value={item[field].toString()} onValueChange={value => handlers.update(dataType, index, field, value === 'true')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="true">Admin</SelectItem><SelectItem value="false">Teacher</SelectItem></SelectContent>
                </Select>
              ) : (
                <Input value={item[field] || ''} onChange={e => handlers.update(dataType, index, field, e.target.value)} placeholder={field.includes('Name') ? 'Name' : field.includes('Email') ? 'email@example.com' : field} type={field.includes('Email') ? 'email' : field.includes('dateOfBirth') ? 'date' : 'text'} />
              )}
            </div>
          ))}
          <div className="flex items-end gap-2">
            <Button variant="destructive" size="sm" onClick={() => handlers.remove(dataType, index)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    );
  });

  const renderSection = (dataType: DataType) => {
    const items = editing[dataType];
    const existingItems = stats[dataType];
    const Icon = icons[dataType];
    const title = titles[dataType];
    const existingCount = dataType === 'users' ? uniqueExistingUsers : existingItems.length;
    
    return (
      <Card key={dataType}>
        <Collapsible open={ui.openSections[dataType]} onOpenChange={() => handlers.toggle(dataType)}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{title}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    {items.length} new | {existingCount} existing
                  </Badge>
                </CardTitle>
                {ui.openSections[dataType] ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {existingItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Existing {title}</h4>
                  <div className="grid gap-2">
                    {existingItems.map((item, index) => (
                      <div key={`${dataType}-${index}`} className="p-3 bg-muted/50 rounded-lg">
                        <div className="font-medium">
                          {dataType === 'users' ? `${item.firstName} ${item.lastName}` : dataType === 'classes' ? `${item.classLevel} - ${item.teacherFirstName} ${item.teacherLastName}` : dataType === 'students' ? `${item.firstName} ${item.lastName}` : `${item.studentFirstName} ${item.studentLastName}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {dataType === 'users' ? item.email : dataType === 'classes' ? `${item.classDay} ${item.classTime} at ${item.classLocation}` : dataType === 'students' ? `Class ID: ${item.classId || 'No class assigned'}` : item.reportText?.substring(0, 50) + '...'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={() => handlers.add(dataType)} size="sm" className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New {title.slice(0, -1)}
                </Button>
                {items.length > 0 && (
                  <Button onClick={() => handlers.submit(dataType)} disabled={ui.importing} size="sm" className="bg-green-600 hover:bg-green-700">
                    {ui.importing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Submit {title} ({items.length})
                  </Button>
                )}
              </div>
              {renderForm(dataType, items)}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <StatisticsBar {...statistics} loading={ui.loadingStats} />
      {ui.importMessage && (
        <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${ui.importMessage.includes('failed') ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
          <CheckCircle className="h-4 w-4" />
          {ui.importMessage}
        </div>
      )}
      {(['users', 'classes', 'students', 'reports'] as DataType[]).map(renderSection)}
    </div>
  );
};