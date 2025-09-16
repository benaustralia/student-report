import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ThemeToggle } from '@/components/theme-toggle';
import { ChevronDown, ChevronRight, Users, Download, Archive, RefreshCw } from 'lucide-react';
import { fetchStudentReportsFromCSV } from './services/csvService';
import { GOOGLE_SHEET_ID } from './config/sheets';

interface Report {
  id: number;
  teacher: string;
  class: string;
  student: string;
  grade: string;
  comments: string;
  [key: string]: any;
}

interface ClassData {
  class: string;
  reports: Report[];
}

interface GroupedReports {
  [teacher: string]: {
    [classKey: string]: ClassData;
  };
}

export default function TeacherReports() {
  const [teacher, setTeacher] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!GOOGLE_SHEET_ID || GOOGLE_SHEET_ID.trim() === '') {
      setError('Please configure your Google Sheet ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchStudentReportsFromCSV(GOOGLE_SHEET_ID);
      
      const transformedData: Report[] = data
        .map((item, index) => {
          const teacher = `${item['Teacher First Name'] || ''} ${item['Teacher Last Name'] || ''}`.trim();
          const student = `${item['Student First Name'] || ''} ${item['Student Last Name'] || ''}`.trim();
          const classDay = item['Class Day'] || '';
          const classTime = item['Class Time'] || '';
          const classLevel = item['Class Level'] || '';
          const classLocation = item['Class Location'] || '';
          
          const classInfo = `${classLevel} - ${classLocation}`;
          const classDetails = classDay && classTime ? `, ${classDay}, ${classTime}` : '';
          const fullClassName = `${classInfo}${classDetails}`;
          
          return {
            id: index + 1,
            teacher,
            class: fullClassName,
            student,
            grade: classLevel,
            comments: item.Report || '',
            ...item
          };
        })
        .filter(report => 
          report.teacher && 
          report.teacher.trim() !== '' &&
          !report.student.toLowerCase().includes('fake') &&
          !report.student.toLowerCase().includes('name')
        );
      
      setReports(transformedData);
    } catch (err) {
      setError('Failed to fetch data from Google Sheets');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggle = (id: string | number) => setExpanded(prev => new Set(prev.has(id) ? [...prev].filter(x => x !== id) : [...prev, id]));
  const openReportModal = (report: Report) => { setSelectedReport(report); setIsModalOpen(true); };

  const filtered = useMemo(() => 
    reports
      .filter(r => teacher === 'all' || r.teacher === teacher)
      .filter(r => r.student.toLowerCase().includes(search.toLowerCase())), 
    [teacher, search, reports]
  );

  const grouped = useMemo((): GroupedReports => 
    filtered.reduce((acc, report) => {
      const key = `${report.teacher}-${report.class}`;
      if (!acc[report.teacher]) acc[report.teacher] = {};
      if (!acc[report.teacher][key]) acc[report.teacher][key] = { class: report.class, reports: [] };
      acc[report.teacher][key].reports.push(report);
      return acc;
    }, {} as GroupedReports), 
    [filtered]
  );

  const teachers = useMemo(() => 
    [...new Set(reports.map(r => r.teacher).filter(t => t && t.trim() !== ''))], 
    [reports]
  );

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">NSA Student Report-o-matic</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading student reports...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
            <p className="text-destructive font-medium">Error: {error}</p>
            <p className="text-sm text-muted-foreground mt-1">Make sure your Google Sheet is public and the Sheet ID is correct.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">Last updated: {new Date().toLocaleDateString()}</p>
            <div className="flex gap-3">
              <Select value={teacher} onValueChange={setTeacher}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teachers</SelectItem>
                  {teachers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
            </div>
          </>
        )}
      </div>

      {!loading && !error && Object.entries(grouped).map(([teacherName, classes]) => (
        <Card key={teacherName}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Users className="w-5 h-5" />{teacherName}</div>
              <Badge variant="outline">{Object.keys(classes).length} classes</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(classes).map(([classKey, classData]) => (
              <Collapsible key={classKey} open={expanded.has(classKey)} onOpenChange={() => toggle(classKey)}>
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="flex-1 justify-between h-auto p-3">
                      <div className="flex items-center gap-2">
                        {expanded.has(classKey) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span>{classData.class}</span>
                        <Badge variant="outline">{classData.reports.length}</Badge>
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); alert(`Downloading ZIP for ${classData.class} class with ${classData.reports.length} reports...`); }}>
                    <Archive className="w-4 h-4 mr-2" />ZIP
                  </Button>
                </div>
                <CollapsibleContent className="space-y-2 pt-2">
                  {classData.reports.map((report: Report) => (
                    <Collapsible key={report.id} open={expanded.has(report.id)} onOpenChange={() => toggle(report.id)}>
                      <Card className="border-muted">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between h-auto p-3">
                            <div className="text-left"><div className="font-medium">{report.student}</div></div>
                            {expanded.has(report.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0 space-y-3">
                            <div className="aspect-[8.5/11] bg-muted rounded border-2 border-dashed border-border flex items-center justify-center max-w-xs cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => openReportModal(report)}>
                              <span className="text-sm text-muted-foreground">Click to view PDF</span>
                            </div>
                            {report.comments && (
                              <div className="max-w-xs">
                                <p className="text-sm text-muted-foreground mb-1">Report:</p>
                                <p className="text-sm bg-muted/50 p-2 rounded border">{report.comments}</p>
                              </div>
                            )}
                            <Button className="max-w-xs" onClick={() => alert(`Downloading ${report.student}'s report...`)}>
                              <Download className="w-4 h-4 mr-2" />Download Report
                            </Button>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      ))}

      {filtered.length === 0 && <Card><CardContent className="text-center py-12"><p className="text-muted-foreground">No reports found</p></CardContent></Card>}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-4 sm:p-6">
          {selectedReport && <div className="w-full h-full min-h-[400px] max-h-[calc(90vh-2rem)] sm:max-h-[calc(90vh-3rem)] bg-muted rounded border-2 border-dashed border-border flex items-center justify-center overflow-hidden"><div className="text-center space-y-2 p-4"><div className="text-4xl sm:text-6xl">📄</div><p className="text-sm sm:text-lg text-muted-foreground">PDF Report Preview</p></div></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
