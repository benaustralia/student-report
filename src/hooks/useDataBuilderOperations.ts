import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { AdminUser, Class, Student, Teacher, Request } from '@/types';
import { 
  importUsers, importClasses, importStudents, importTeachers, importRequests,
  getAllUsers, getAllClasses, getAllStudents, getAllTeachers, getAllRequests,
  updateUser, updateClass, updateStudent, updateTeacher, updateRequest,
  deleteUser, deleteClass, deleteStudent, deleteTeacher, deleteRequest,
  approveRequest, declineRequest
} from '@/services/firebaseService-ultra-final';

export type DataType = 'requests' | 'users' | 'classes' | 'students' | 'teachers';
export type ItemType = AdminUser | Class | Student | Teacher | Request;

const OPS = {
  import: { users: importUsers, classes: importClasses, students: importStudents, teachers: importTeachers, requests: importRequests },
  update: { users: updateUser, classes: updateClass, students: updateStudent, teachers: updateTeacher, requests: updateRequest },
  delete: { users: deleteUser, classes: deleteClass, students: deleteStudent, teachers: deleteTeacher, requests: deleteRequest },
  getAll: [getAllUsers, getAllClasses, getAllStudents, getAllTeachers, getAllRequests]
} as const;

const DATA_TYPES = ['users', 'classes', 'students', 'teachers', 'requests'] as const;
const EMPTY_DATA = () => ({ users: [], classes: [], students: [], teachers: [], requests: [] }) as Record<DataType, ItemType[]>;

const notifyDataChange = (type: DataType, action: string, details = {}) => 
  window.dispatchEvent(new CustomEvent('dataChanged', { detail: { type, action, ...details } }));

export const useDataBuilderOperations = (emptyItems: Record<DataType, ItemType>) => {
  const [data, setData] = useState(EMPTY_DATA);
  const [newItems, setNewItems] = useState(EMPTY_DATA);

  const refreshAllData = async () => {
    const results = await Promise.all(OPS.getAll.map(fn => fn()));
    return Object.fromEntries(DATA_TYPES.map((key, i) => [key, results[i] || []])) as Record<DataType, ItemType[]>;
  };

  useEffect(() => {
    refreshAllData().then(setData).catch(() => setData(EMPTY_DATA()));
  }, []);

  const updateItem = (type: DataType, index: number | string, field: string, value: unknown, isNew = false) => 
    (isNew ? setNewItems : setData)(prev => ({
      ...prev,
      [type]: prev[type].map((item, i) => 
        (isNew ? i === index : item.id === index) ? { ...item, [field]: value } as ItemType : item
      )
    }));

  const handleAction = async (action: 'add' | 'remove' | 'submit' | 'update' | 'delete', type: DataType, item: ItemType | null, index: number) => {
    const actions = {
      add: () => setNewItems(prev => ({ ...prev, [type]: [...prev[type], emptyItems[type]] })),
      remove: () => setNewItems(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) })),
      submit: async () => {
        await OPS.import[type](newItems[type] as any);
        setNewItems(prev => ({ ...prev, [type]: [] }));
        toast.success(`Imported ${newItems[type].length} ${type}!`);
        setData(await refreshAllData());
        notifyDataChange(type, 'submit', { count: newItems[type].length });
      },
      update: async () => {
        if (!item?.id) return;
        await OPS.update[type](item.id, item);
        toast.success(`Updated ${type.slice(0, -1)}!`);
        setData(await refreshAllData());
        notifyDataChange(type, 'update', { itemId: item.id, item });
      },
      delete: async () => {
        if (!item?.id) return;
        await OPS.delete[type](item.id);
        setData(prev => ({ ...prev, [type]: prev[type].filter(i => i.id !== item.id) }));
        toast.success(`Deleted ${type.slice(0, -1)}!`);
        notifyDataChange(type, 'delete', { itemId: item.id, item });
      }
    };

    try {
      await actions[action]();
    } catch (error) {
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRequestAction = async (request: Request, action: 'approve' | 'decline', userEmail: string) => {
    if (!userEmail) return;
    try {
      await (action === 'approve' ? approveRequest : declineRequest)(request.id, userEmail);
      const messages = {
        approve: `Request approved and ${request.type === 'add_student' ? 'student added' : 'student removed'}!`,
        decline: 'Request declined'
      };
      toast.success(messages[action]);
      setData(await refreshAllData());
      notifyDataChange('requests', action, { requestType: request.type });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} request`);
    }
  };

  const handleBulkImportSuccess = async () => {
    try {
      setData(await refreshAllData());
      toast.success('Students imported successfully!');
      notifyDataChange('students', 'bulk_import');
    } catch {
      setData(EMPTY_DATA());
    }
  };

  return { data, setData, newItems, setNewItems, updateItem, handleAction, handleRequestAction, handleBulkImportSuccess, refreshAllData };
};

