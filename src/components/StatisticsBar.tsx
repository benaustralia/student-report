import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { StatisticItem } from '@/components/ui/statistic-item';
import { Users, BookOpen, FileText } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/config/firebase';

interface StatisticsBarProps {
  className?: string;
}

export const StatisticsBar: React.FC<StatisticsBarProps> = ({
  className = ''
}) => {
  const [stats, setStats] = useState({
    userCount: 0,
    classCount: 0,
    studentCount: 0,
    loading: true
  });

  useEffect(() => {
    const unsubscribeFunctions: (() => void)[] = [];

    // Listen to adminUsers and teachers collections to get total user count
    let adminCount = 0;
    let teacherCount = 0;

    const updateUserCount = () => {
      setStats(prev => ({ ...prev, userCount: adminCount + teacherCount }));
    };

    const adminUnsubscribe = onSnapshot(
      query(collection(db, 'adminUsers')),
      (snapshot) => {
        adminCount = snapshot.docs.filter(doc => doc.data().isAdmin === true).length;
        updateUserCount();
      },
      (error) => {
        console.error('Error listening to adminUsers:', error);
        adminCount = 0;
        updateUserCount();
      }
    );
    unsubscribeFunctions.push(adminUnsubscribe);

    const teachersUnsubscribe = onSnapshot(
      query(collection(db, 'teachers')),
      (snapshot) => {
        teacherCount = snapshot.size;
        updateUserCount();
      },
      (error) => {
        console.error('Error listening to teachers:', error);
        teacherCount = 0;
        updateUserCount();
      }
    );
    unsubscribeFunctions.push(teachersUnsubscribe);

    // Listen to classes collection
    const classesUnsubscribe = onSnapshot(
      query(collection(db, 'classes')),
      (snapshot) => {
        const classCount = snapshot.size;
        setStats(prev => ({ ...prev, classCount }));
      },
      (error) => {
        console.error('Error listening to classes:', error);
        setStats(prev => ({ ...prev, classCount: 0 }));
      }
    );
    unsubscribeFunctions.push(classesUnsubscribe);

    // Listen to students collection
    const studentsUnsubscribe = onSnapshot(
      query(collection(db, 'students')),
      (snapshot) => {
        const studentCount = snapshot.size;
        setStats(prev => ({ ...prev, studentCount }));
      },
      (error) => {
        console.error('Error listening to students:', error);
        setStats(prev => ({ ...prev, studentCount: 0 }));
      }
    );
    unsubscribeFunctions.push(studentsUnsubscribe);

    // Set loading to false after first data load
    const timer = setTimeout(() => {
      setStats(prev => ({ ...prev, loading: false }));
    }, 1000);

    // Cleanup function
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      clearTimeout(timer);
    };
  }, []);

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8">
          <StatisticItem
            icon={Users}
            value={stats.userCount}
            label="Users"
            loading={stats.loading}
            iconColor="text-primary"
          />
          <StatisticItem
            icon={BookOpen}
            value={stats.classCount}
            label="Classes"
            loading={stats.loading}
            iconColor="text-green-600"
          />
          <StatisticItem
            icon={FileText}
            value={stats.studentCount}
            label="Students"
            loading={stats.loading}
            iconColor="text-purple-600"
          />
        </div>
      </CardContent>
    </Card>
  );
};