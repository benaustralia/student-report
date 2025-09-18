// Data migration utility for RBA system
// This script helps migrate data from the old structure to the new RBA structure

import { 
  collection, 
  addDoc, 
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Class, Student } from '../types';

// Sample data structure for migration
export const sampleClasses: Omit<Class, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    teacherEmail: 'Wenli11651@gmail.com',
    teacherFirstName: 'Wenli',
    teacherLastName: 'Zhang',
    classDay: 'Wednesday',
    classTime: '3:45 PM',
    classLocation: 'Glen Waverley Primary School',
    classLevel: 'Wednesday Class'
  },
  {
    teacherEmail: 'Wenli11651@gmail.com',
    teacherFirstName: 'Wenli',
    teacherLastName: 'Zhang',
    classDay: 'Thursday',
    classTime: '3:45 PM',
    classLocation: 'Box Hill North',
    classLevel: 'Thursday Class'
  },
  {
    teacherEmail: 'Wenli11651@gmail.com',
    teacherFirstName: 'Wenli',
    teacherLastName: 'Zhang',
    classDay: 'Saturday',
    classTime: '10:30 AM',
    classLocation: 'Mount Waverley',
    classLevel: 'Saturday Class'
  }
];

export const sampleStudents: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Students for Wednesday Class (Glen Waverley Primary School)
  { classId: 'class1', firstName: 'Lilly', lastName: 'Lane' },
  { classId: 'class1', firstName: 'Bobby', lastName: 'Smith' },
  { classId: 'class1', firstName: 'Fancy', lastName: 'Pants' },
  
  // Students for Thursday Class (Box Hill North)
  { classId: 'class2', firstName: 'Shadow', lastName: 'Puppy' },
  { classId: 'class2', firstName: 'Ninky', lastName: 'Nonk' },
  { classId: 'class2', firstName: 'Wham', lastName: 'Wham' },
  
  // Students for Saturday Class (Mount Waverley)
  { classId: 'class3', firstName: 'Little', lastName: 'Dude' },
  { classId: 'class3', firstName: 'Girly', lastName: 'Girl' },
  { classId: 'class3', firstName: 'Kan', lastName: 'Kan' }
];

// Migration functions
export const migrateClasses = async (): Promise<string[]> => {
  const classIds: string[] = [];
  
  for (const classData of sampleClasses) {
    try {
      const docRef = await addDoc(collection(db, 'classes'), {
        ...classData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      classIds.push(docRef.id);
      console.log(`Created class: ${classData.classLevel} - ${classData.classLocation}`);
    } catch (error) {
      console.error('Error creating class:', error);
    }
  }
  
  return classIds;
};

export const migrateStudents = async (classIds: string[]): Promise<string[]> => {
  const studentIds: string[] = [];
  let classIndex = 0;
  
  for (const studentData of sampleStudents) {
    try {
      // Map classId to actual Firestore document ID
      const actualClassId = classIds[classIndex] || classIds[0];
      
      const docRef = await addDoc(collection(db, 'students'), {
        ...studentData,
        classId: actualClassId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      studentIds.push(docRef.id);
      console.log(`Created student: ${studentData.firstName} ${studentData.lastName}`);
      
      // Move to next class after 3 students (for Ben's classes) or 3 students (for Wenli's classes)
      if (studentIds.length % 3 === 0) {
        classIndex++;
      }
    } catch (error) {
      console.error('Error creating student:', error);
    }
  }
  
  return studentIds;
};

export const createAdminUser = async (email: string): Promise<void> => {
  try {
    await addDoc(collection(db, 'adminUsers'), {
      email,
      isAdmin: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`Created admin user: ${email}`);
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Create sample reports for testing
export const createSampleReports = async (classIds: string[], studentIds: string[]): Promise<void> => {
  try {
    const reportsRef = collection(db, 'reports');
    
    // Create a sample report for each student
    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];
      const classId = classIds[Math.floor(i / 3)]; // 3 students per class
      
      const sampleReport = {
        studentId: studentId,
        classId: classId,
        teacherEmail: 'Wenli11651@gmail.com',
        teacherFirstName: 'Wenli',
        teacherLastName: 'Zhang',
        classDay: i < 3 ? 'Wednesday' : i < 6 ? 'Thursday' : 'Saturday',
        classTime: i < 3 ? '3:45 PM' : i < 6 ? '3:45 PM' : '10:30 AM',
        classLocation: i < 3 ? 'Glen Waverley Primary School' : i < 6 ? 'Box Hill North' : 'Mount Waverley',
        classLevel: i < 3 ? 'Wednesday Class' : i < 6 ? 'Thursday Class' : 'Saturday Class',
        studentFirstName: studentId === studentIds[0] ? 'Lilly' : studentId === studentIds[1] ? 'Bobby' : studentId === studentIds[2] ? 'Fancy' : 
                         studentId === studentIds[3] ? 'Shadow' : studentId === studentIds[4] ? 'Ninky' : studentId === studentIds[5] ? 'Wham' :
                         studentId === studentIds[6] ? 'Little' : studentId === studentIds[7] ? 'Girly' : 'Kan',
        studentLastName: studentId === studentIds[0] ? 'Lane' : studentId === studentIds[1] ? 'Smith' : studentId === studentIds[2] ? 'Pants' :
                        studentId === studentIds[3] ? 'Puppy' : studentId === studentIds[4] ? 'Nonk' : studentId === studentIds[5] ? 'Wham' :
                        studentId === studentIds[6] ? 'Dude' : studentId === studentIds[7] ? 'Girl' : 'Kan',
        reportText: `This is a sample report for ${studentId === studentIds[0] ? 'Lilly Lane' : studentId === studentIds[1] ? 'Bobby Smith' : studentId === studentIds[2] ? 'Fancy Pants' : 
                    studentId === studentIds[3] ? 'Shadow Puppy' : studentId === studentIds[4] ? 'Ninky Nonk' : studentId === studentIds[5] ? 'Wham Wham' :
                    studentId === studentIds[6] ? 'Little Dude' : studentId === studentIds[7] ? 'Girly Girl' : 'Kan Kan'}. The student has shown great progress in their artistic development.`,
        artworkUrl: 'https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=Student+Artwork',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await addDoc(reportsRef, sampleReport);
      console.log(`Created sample report for student ${i + 1}`);
    }
    
    console.log('Sample reports created successfully!');
  } catch (error) {
    console.error('Error creating sample reports:', error);
  }
};

// Main migration function
export const runMigration = async (): Promise<void> => {
  console.log('Starting data migration...');
  
  try {
    // Create admin users
    await createAdminUser('bahinton@gmail.com');
    await createAdminUser('Wenli11651@gmail.com');
    
    // Migrate classes
    const classIds = await migrateClasses();
    console.log(`Created ${classIds.length} classes`);
    
    // Migrate students
    const studentIds = await migrateStudents(classIds);
    console.log(`Created ${studentIds.length} students`);
    
    // Create sample reports
    await createSampleReports(classIds, studentIds);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

// Function to clear all existing data
export const clearAllData = async (): Promise<void> => {
  try {
    console.log('Clearing existing data...');
    
    // Clear classes
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    for (const doc of classesSnapshot.docs) {
      await deleteDoc(doc.ref);
    }
    console.log(`Cleared ${classesSnapshot.docs.length} classes`);
    
    // Clear students
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    for (const doc of studentsSnapshot.docs) {
      await deleteDoc(doc.ref);
    }
    console.log(`Cleared ${studentsSnapshot.docs.length} students`);
    
    // Clear reports
    const reportsSnapshot = await getDocs(collection(db, 'reports'));
    for (const doc of reportsSnapshot.docs) {
      await deleteDoc(doc.ref);
    }
    console.log(`Cleared ${reportsSnapshot.docs.length} reports`);
    
    // Clear admin users
    const adminSnapshot = await getDocs(collection(db, 'adminUsers'));
    for (const doc of adminSnapshot.docs) {
      await deleteDoc(doc.ref);
    }
    console.log(`Cleared ${adminSnapshot.docs.length} admin users`);
    
    console.log('Data cleared successfully!');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};

// Function to check if data already exists
export const checkExistingData = async (): Promise<boolean> => {
  try {
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const adminSnapshot = await getDocs(collection(db, 'adminUsers'));
    
    return classesSnapshot.docs.length > 0 || 
           studentsSnapshot.docs.length > 0 || 
           adminSnapshot.docs.length > 0;
  } catch (error) {
    console.error('Error checking existing data:', error);
    return false;
  }
};
