import { useState } from 'react';
import { toast } from 'sonner';
import type { AdminUser, Class, Student, Teacher, Request } from '@/types';
import { importUsers, importClasses, importStudents, importTeachers, importRequests, updateUser, updateClass, updateStudent, updateTeacher, updateRequest, deleteUser, deleteClass, deleteStudent, deleteTeacher, deleteRequest } from '@/services/firebaseService-ultra-final';

type DataType = 'requests' | 'users' | 'classes' | 'students' | 'teachers';
type ItemType = AdminUser | Class | Student | Teacher | Request;

const OPS = {
  import: { users: importUsers, classes: importClasses, students: importStudents, teachers: importTeachers, requests: importRequests },
  update: { users: updateUser, classes: updateClass, students: updateStudent, teachers: updateTeacher, requests: updateRequest },
  delete: { users: deleteUser, classes: deleteClass, students: deleteStudent, teachers: deleteTeacher, requests: deleteRequest }
};

export const useItemOperations = (refreshData: () => Promise<any>) => {
  const [newItems, setNewItems] = useState<Record<DataType, ItemType[]>>({
    users: [], classes: [], students: [], teachers: [], requests: []
  });
  const [editing, setEditing] = useState<Set<string>>(new Set());

  const handleAction = async (action: 'add' | 'remove' | 'submit' | 'update' | 'delete', type: DataType, item: ItemType | null, index: number, emptyItem: ItemType) => {
    try {
      if (action === 'add') {
        setNewItems(prev => ({ ...prev, [type]: [...prev[type], emptyItem] }));
      } else if (action === 'remove') {
        setNewItems(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
      } else if (action === 'submit') {
        await (OPS.import[type] as any)(newItems[type]);
        setNewItems(prev => ({ ...prev, [type]: [] }));
        toast.success(`Imported ${newItems[type].length} ${type}!`);
        await refreshData();
      } else if (action === 'update' && item?.id) {
        await OPS.update[type](item.id, item);
        setEditing(prev => new Set([...prev].filter(id => id !== item.id)));
        toast.success(`Updated ${type.slice(0, -1)}!`);
        await refreshData();
      } else if (action === 'delete' && item?.id) {
        await OPS.delete[type](item.id);
        toast.success(`Deleted ${type.slice(0, -1)}!`);
        await refreshData();
      }
    } catch (error: unknown) {
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return { newItems, setNewItems, editing, setEditing, handleAction };
};

