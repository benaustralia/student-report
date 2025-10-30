import { useState, useEffect } from 'react';
import type { AdminUser, Class, Student, Teacher, Request } from '@/types';
import { getAllUsers, getAllClasses, getAllStudents, getAllTeachers, getAllRequests } from '@/services/firebaseService-ultra-final';

type DataType = 'requests' | 'users' | 'classes' | 'students' | 'teachers';
type ItemType = AdminUser | Class | Student | Teacher | Request;

const DATA_TYPES = ['users', 'classes', 'students', 'teachers', 'requests'] as const;
const EMPTY_DATA = { users: [], classes: [], students: [], teachers: [], requests: [] } as Record<DataType, ItemType[]>;
const FETCHERS = [getAllUsers, getAllClasses, getAllStudents, getAllTeachers, getAllRequests] as const;

export const useDataManager = () => {
  const [data, setData] = useState<Record<DataType, ItemType[]>>(EMPTY_DATA);

  const refreshAllData = async () => {
    const results = await Promise.all(FETCHERS.map(fn => fn()));
    return Object.fromEntries(DATA_TYPES.map((key, i) => [key, results[i] || []])) as Record<DataType, ItemType[]>;
  };

  useEffect(() => {
    refreshAllData().then(setData).catch(() => setData(EMPTY_DATA));
  }, []);

  return { data, setData, refreshAllData };
};

