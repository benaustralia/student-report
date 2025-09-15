import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ThemeToggle } from '@/components/theme-toggle';
import { ChevronDown, ChevronRight, Users, Download, Archive } from 'lucide-react';

interface Report {
  id: number;
  teacher: string;
  class: string;
  student: string;
  grade: string;
  comments: string;
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

const reports: Report[] = [
  { id: 1, teacher: 'Ms. Rodriguez', class: '5th Grade Math', student: 'Alice Johnson', grade: '5th', comments: 'Shows excellent problem-solving skills.' },
  { id: 2, teacher: 'Ms. Rodriguez', class: '4th Grade Math', student: 'David Chen', grade: '4th', comments: 'Improving steadily in algebraic thinking.' },
  { id: 3, teacher: 'Mr. Thompson', class: '5th Grade Science', student: 'Bob Smith', grade: '5th', comments: 'Strong understanding of scientific concepts.' },
  { id: 4, teacher: 'Mrs. Parker', class: '4th Grade English', student: 'Carol Williams', grade: '4th', comments: 'Creative writing continues to improve.' },
];

export default function TeacherReports() {
  const [teacher, setTeacher] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const toggle = (id: string | number) => setExpanded(prev => new Set(prev.has(id) ? [...prev].filter(x => x !== id) : [...prev, id]));

  const openReportModal = (report: Report) => {
    setSelectedReport(report);
    setIsModalOpen(true);
  };


  const filtered = useMemo(() => {
    return reports
      .filter(r => teacher === 'all' || r.teacher === teacher)
      .filter(r => r.student.toLowerCase().includes(search.toLowerCase()));
  }, [teacher, search]);

  const grouped = useMemo((): GroupedReports => {
    return filtered.reduce((acc, report) => {
      const key = `${report.teacher}-${report.class}`;
      if (!acc[report.teacher]) acc[report.teacher] = {};
      if (!acc[report.teacher][key]) acc[report.teacher][key] = { class: report.class, reports: [] };
      acc[report.teacher][key].reports.push(report);
      return acc;
    }, {} as GroupedReports);
  }, [filtered]);

  const teachers = [...new Set(reports.map(r => r.teacher))];

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">NSA Student Report-o-matic</h1>
        <p className="text-sm text-muted-foreground mb-4">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="flex gap-3">
          <Select value={teacher} onValueChange={setTeacher}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teachers</SelectItem>
              {teachers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input 
            placeholder="Search students..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <ThemeToggle />
        </div>
      </div>

      {Object.entries(grouped).map(([teacherName, classes]) => (
        <Card key={teacherName}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {teacherName}
              </div>
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
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      alert(`Downloading ZIP for ${classData.class} class with ${classData.reports.length} reports...`);
                    }}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    ZIP
                  </Button>
                </div>
                <CollapsibleContent className="space-y-2 pt-2">
                  {classData.reports.map((report: Report) => (
                    <Collapsible key={report.id} open={expanded.has(report.id)} onOpenChange={() => toggle(report.id)}>
                      <Card className="border-muted">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between h-auto p-3">
                            <div className="text-left">
                              <div className="font-medium">{report.student}</div>
                              <div className="text-sm text-muted-foreground">{report.grade}</div>
                            </div>
                            {expanded.has(report.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0 space-y-3">
                            <div 
                              className="aspect-[8.5/11] bg-muted rounded border-2 border-dashed border-border flex items-center justify-center max-w-xs cursor-pointer hover:bg-muted/80 transition-colors"
                              onClick={() => openReportModal(report)}
                            >
                              <span className="text-sm text-muted-foreground">Click to view PDF</span>
                            </div>
                            <Button 
                              className="max-w-xs" 
                              onClick={() => alert(`Downloading ${report.student}'s report...`)}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download Report
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

      {filtered.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No reports found</p>
          </CardContent>
        </Card>
      )}

      {/* Student Report Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-4 sm:p-6">
          {selectedReport && (
            <div className="w-full h-full min-h-[400px] max-h-[calc(90vh-2rem)] sm:max-h-[calc(90vh-3rem)] bg-muted rounded border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
              <div className="text-center space-y-2 p-4">
                <div className="text-4xl sm:text-6xl">📄</div>
                <p className="text-sm sm:text-lg text-muted-foreground">PDF Report Preview</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
