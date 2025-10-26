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
};

const notifyDataChange = (type: DataType, action: string, details: Record<string, unknown> = {}) => 
  window.dispatchEvent(new CustomEvent('dataChanged', { detail: { type, action, ...details } }));

export const useDataBuilderOperations = (emptyItems: Record<DataType, ItemType>) => {
  const [data, setData] = useState<Record<DataType, ItemType[]>>({
    users: [], classes: [], students: [], teachers: [], requests: []
  });
  const [newItems, setNewItems] = useState<Record<DataType, ItemType[]>>({
    users: [], classes: [], students: [], teachers: [], requests: []
  });

  const refreshAllData = async (): Promise<Record<DataType, ItemType[]>> => {
    const results = await Promise.all(OPS.getAll.map((fn: () => Promise<any>) => fn()));
    return Object.fromEntries(['users', 'classes', 'students', 'teachers', 'requests'].map((key, i) => [key, (results[i] || []) as ItemType[]])) as Record<DataType, ItemType[]>;
  };

  useEffect(() => {
    refreshAllData()
      .then(setData)
      .catch(() => setData({ users: [], classes: [], students: [], teachers: [], requests: [] }));
  }, []);

  const updateItem = (type: DataType, index: number | string, field: string, value: unknown, isNew = false) => {
    const setter = isNew ? setNewItems : setData;
    setter(prev => ({
      ...prev,
      [type]: prev[type].map((item, i) => 
        (isNew ? i === index : item.id === index) ? { ...item, [field]: value } as ItemType : item
      )
    }));
  };

  const handleAction = async (action: 'add' | 'remove' | 'submit' | 'update' | 'delete', type: DataType, item: ItemType | null, index: number) => {
    try {
      if (action === 'add') {
        setNewItems(prev => ({ ...prev, [type]: [...prev[type], emptyItems[type]] }));
      } else if (action === 'remove') {
        setNewItems(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
      } else if (action === 'submit') {
        await (OPS.import[type] as (items: ItemType[]) => Promise<void>)(newItems[type]);
        setNewItems(prev => ({ ...prev, [type]: [] }));
        toast.success(`Imported ${newItems[type].length} ${type}!`);
        const newData = await refreshAllData();
        setData(newData);
        notifyDataChange(type, 'submit', { count: newItems[type].length });
      } else if (action === 'update' && item?.id) {
        await OPS.update[type](item.id, item);
        toast.success(`Updated ${type.slice(0, -1)}!`);
        const newData = await refreshAllData();
        setData(newData);
        notifyDataChange(type, 'update', { itemId: item.id, item });
      } else if (action === 'delete' && item?.id) {
        await OPS.delete[type](item.id);
        setData(prev => ({ ...prev, [type]: prev[type].filter(i => i.id !== item.id) }));
        toast.success(`Deleted ${type.slice(0, -1)}!`);
        notifyDataChange(type, 'delete', { itemId: item.id, item });
      }
    } catch (error: unknown) {
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRequestAction = async (request: Request, action: 'approve' | 'decline', userEmail: string) => {
    if (!userEmail) return;
    try {
      await (action === 'approve' ? approveRequest : declineRequest)(request.id, userEmail);
      toast.success(action === 'approve' 
        ? `Request approved and ${request.type === 'add_student' ? 'student added' : 'student removed'}!`
        : 'Request declined'
      );
      const newData = await refreshAllData();
      setData(newData);
      notifyDataChange('requests', action, { requestType: request.type });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} request`);
    }
  };

  const handleBulkImportSuccess = async () => {
    try {
      const newData = await refreshAllData();
      setData(newData);
      toast.success('Students imported successfully!');
      notifyDataChange('students', 'bulk_import');
    } catch {
      setData({ users: [], classes: [], students: [], teachers: [], requests: [] });
    }
  };

  return {
    data,
    setData,
    newItems,
    setNewItems,
    updateItem,
    handleAction,
    handleRequestAction,
    handleBulkImportSuccess,
    refreshAllData
  };
};

