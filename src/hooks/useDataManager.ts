import { useState, useEffect } from 'react';
import type { AdminUser, Class, Student, Teacher, Request } from '@/types';
import { getAllUsers, getAllClasses, getAllStudents, getAllTeachers, getAllRequests } from '@/services/firebaseService-ultra-final';

type DataType = 'requests' | 'users' | 'classes' | 'students' | 'teachers';
type ItemType = AdminUser | Class | Student | Teacher | Request;

export const useDataManager = () => {
  const [data, setData] = useState<Record<DataType, ItemType[]>>({
    users: [], classes: [], students: [], teachers: [], requests: []
  });

  const refreshAllData = async (): Promise<Record<DataType, ItemType[]>> => {
    const results = await Promise.all([getAllUsers(), getAllClasses(), getAllStudents(), getAllTeachers(), getAllRequests()]);
    return Object.fromEntries(['users', 'classes', 'students', 'teachers', 'requests'].map((key, i) => [key, results[i] || []])) as Record<DataType, ItemType[]>;
  };

  useEffect(() => {
    refreshAllData()
      .then(setData)
      .catch(() => setData({ users: [], classes: [], students: [], teachers: [], requests: [] }));
  }, []);

  return { data, setData, refreshAllData };
};

