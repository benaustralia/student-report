import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Users, Download } from 'lucide-react';
import ClassZIPButton from './ClassZIPButton';
import ReportThumbnail from './ReportThumbnail';
import type { Report, ClassData } from '../types';

interface TeacherCardProps {
  teacherName: string;
  classes: Record<string, ClassData>;
  expanded: Set<string | number>;
  onToggle: (id: string | number) => void;
  onOpenReportModal: (report: Report) => void;
  onDownloadPDF: (report: Report) => void;
  isGeneratingPDF: boolean;
}

export const TeacherCard: React.FC<TeacherCardProps> = ({
  teacherName,
  classes,
  expanded,
  onToggle,
  onOpenReportModal,
  onDownloadPDF,
  isGeneratingPDF,
}) => {
  const teacherKey = `teacher-${teacherName}`;
  
  return (
    <Collapsible open={expanded.has(teacherKey)} onOpenChange={() => onToggle(teacherKey)}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {expanded.has(teacherKey) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                <Users className="w-5 h-5" />
                {teacherName}
              </div>
              <Badge variant="outline">{Object.keys(classes).length} classes</Badge>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3">
        {Object.entries(classes).map(([classKey, classData]) => (
          <Collapsible key={classKey} open={expanded.has(classKey)} onOpenChange={() => onToggle(classKey)}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex-1 justify-between h-auto p-3 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {expanded.has(classKey) ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                    <span className="truncate">{classData.class}</span>
                    <Badge variant="outline" className="flex-shrink-0">{classData.reports.length}</Badge>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <ClassZIPButton classData={classData} teacherName={teacherName} />
            </div>
            <CollapsibleContent className="space-y-2 pt-2">
              {classData.reports.map((report) => (
                <Collapsible key={report.id} open={expanded.has(report.id)} onOpenChange={() => onToggle(report.id)}>
                  <Card className="border-muted">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between h-auto p-3">
                        <div className="text-left">
                          <div className="font-medium">{report.student}</div>
                        </div>
                        {expanded.has(report.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1">
                            <ReportThumbnail
                              data={{
                                studentName: report.student,
                                classLevel: report.class.split(' - ')[0] || report.grade,
                                classLocation: report.class.split(' - ')[1] || '',
                                comments: report.comments,
                                teacher: report.teacher,
                                date: new Date().toLocaleDateString()
                              }}
                              className="w-full max-w-sm mx-auto sm:mx-0"
                              onClick={() => onOpenReportModal(report)}
                            />
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                            <Button 
                              className="w-full sm:w-auto" 
                              onClick={() => onOpenReportModal(report)}
                              variant="outline"
                            >
                              View Report
                            </Button>
                            <Button 
                              className="w-full sm:w-auto" 
                              onClick={() => onDownloadPDF(report)}
                              disabled={isGeneratingPDF}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default TeacherCard;
