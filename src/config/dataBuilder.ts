import { FileText, Users, BookOpen, GraduationCap } from 'lucide-react';

export const CLASS_OPTIONS = {
  levels: ['Early Learning', 'Primary', 'Intermediate', 'Advanced', 'Master', 'Adult', 'Sketching'],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  times: ['10:30am', '1:30pm', '3:45pm', '4:30pm'],
  locations: [
    'Mount Waverley', 'Box Hill', 'Balwyn North Primary School', 'Camberwell', 'Doncaster Gardens Primary School',
    'Preston', 'Pines', 'Glen Waverley Primary School', 'Serpell Primary School'
  ]
} as const;

export const CONFIG: any = {
  CLASS_OPTIONS,
  SECTIONS: {
    requests: { icon: FileText, title: 'Requests', fields: ['type', 'status', 'teacherEmail', 'classId', 'studentId', 'studentFirstName', 'studentLastName', 'notes'], empty: { type: 'add_student', status: 'pending', teacherEmail: '', classId: '', notes: '' } },
    users: { icon: Users, title: 'Admins', fields: ['firstName', 'lastName', 'email', 'isAdmin'], empty: { firstName: '', lastName: '', email: '', isAdmin: true } },
    classes: { icon: BookOpen, title: 'Classes', fields: ['classLevel', 'classDay', 'classTime', 'classLocation', 'teacherEmail'], empty: { classLevel: '', classDay: '', classTime: '', classLocation: '', teacherEmail: '' } },
    students: { icon: GraduationCap, title: 'Students', fields: ['firstName', 'lastName', 'classId'], empty: { firstName: '', lastName: '', classId: '' } },
    teachers: { icon: Users, title: 'Teachers', fields: ['firstName', 'lastName', 'email'], empty: { firstName: '', lastName: '', email: '' } }
  },
  FIELD_CONFIGS: Object.fromEntries(['classLevel', 'classDay', 'classTime', 'classLocation'].map(field => [
    field, { options: (CLASS_OPTIONS as any)[field.replace('class', '').toLowerCase() + 's'], placeholder: `Select ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}...` }
  ]))
};

export const formatFieldLabel = (field: string) => field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
