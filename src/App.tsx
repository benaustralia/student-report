import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { fetchStudentReportsFromCSV } from './services/csvService';
import { GOOGLE_SHEET_ID } from './config/sheets';
import { downloadReportAsPDF } from './services/pdfService';
import ReportTemplate from './components/ReportTemplate';
import AppHeader from './components/AppHeader';
import TeacherCard from './components/TeacherCard';
import type { Report, GroupedReports } from './types';

export default function TeacherReports() {
  const [teacher, setTeacher] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!GOOGLE_SHEET_ID?.trim()) {
      setError('Please configure your Google Sheet ID');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchStudentReportsFromCSV(GOOGLE_SHEET_ID);
      setReports(data
        .map((item, index) => ({
          id: index + 1,
          teacher: `${item['Teacher First Name'] || ''} ${item['Teacher Last Name'] || ''}`.trim(),
          student: `${item['Student First Name'] || ''} ${item['Student Last Name'] || ''}`.trim(),
          class: `${item['Class Level'] || ''} - ${item['Class Location'] || ''}${item['Class Day'] && item['Class Time'] ? `, ${item['Class Day']}, ${item['Class Time']}` : ''}`,
          grade: item['Class Level'] || '',
          comments: item.Report || '',
          ...item
        }))
        .filter(report => 
          report.teacher?.trim() && 
          !report.student.toLowerCase().includes('fake') &&
          !report.student.toLowerCase().includes('name')
        ));
    } catch (err) {
      setError('Failed to fetch data from Google Sheets');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const toggle = useCallback((id: string | number) => 
    setExpanded(prev => new Set(prev.has(id) ? [...prev].filter(x => x !== id) : [...prev, id])), []);
  const openReportModal = useCallback((report: Report) => {
    setSelectedReport(report);
    setIsModalOpen(true);
  }, []);
  const handleDownloadPDF = useCallback(async (report: Report) => {
    try {
      setIsGeneratingPDF(true);
      setError(null);
      
      const [classLevel, classLocation] = report.class.split(' - ');
      await downloadReportAsPDF({
        studentName: report.student,
        classLevel: classLevel || report.grade,
        classLocation: classLocation || '',
        comments: report.comments,
        teacher: report.teacher,
        date: new Date().toLocaleDateString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF. Please try again.';
      setError(errorMessage);
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  }, []);

  const { filtered, grouped, teachers } = useMemo(() => {
    const filtered = reports.filter(r => 
      (teacher === 'all' || r.teacher === teacher) &&
      r.student.toLowerCase().includes(search.toLowerCase())
    );
    const grouped = filtered.reduce((acc, report) => {
      const key = `${report.teacher}-${report.class}`;
      if (!acc[report.teacher]) acc[report.teacher] = {};
      if (!acc[report.teacher][key]) acc[report.teacher][key] = { class: report.class, reports: [] };
      acc[report.teacher][key].reports.push(report);
      return acc;
    }, {} as GroupedReports);
    const teachers = [...new Set(reports.map(r => r.teacher).filter(Boolean))];
    return { filtered, grouped, teachers };
  }, [teacher, search, reports]);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <AppHeader
        loading={loading}
        error={error}
        teacher={teacher}
        teachers={teachers}
        search={search}
        onRefresh={fetchData}
        onTeacherChange={setTeacher}
        onSearchChange={setSearch}
      />
      {!loading && !error && Object.entries(grouped).map(([teacherName, classes]) => (
        <TeacherCard
          key={teacherName}
          teacherName={teacherName}
          classes={classes}
          expanded={expanded}
          onToggle={toggle}
          onOpenReportModal={openReportModal}
          onDownloadPDF={handleDownloadPDF}
          isGeneratingPDF={isGeneratingPDF}
        />
      ))}
      {!filtered.length && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No reports found</p>
          </CardContent>
        </Card>
      )}
      <Drawer open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DrawerContent className="max-h-[96vh]">
          <DrawerHeader>
            <DrawerTitle>
              {selectedReport ? `${selectedReport.student} - Report` : 'Student Report'}
            </DrawerTitle>
          </DrawerHeader>
          {selectedReport && (
            <div className="px-4 pb-4 overflow-auto">
              <div className="flex justify-center">
                <ReportTemplate 
                  data={{
                    studentName: selectedReport.student,
                    classLevel: selectedReport.class.split(' - ')[0] || selectedReport.grade,
                    classLocation: selectedReport.class.split(' - ')[1] || '',
                    comments: selectedReport.comments,
                    teacher: selectedReport.teacher,
                    date: new Date().toLocaleDateString()
                  }}
                  className="max-w-full shadow-lg"
                />
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
