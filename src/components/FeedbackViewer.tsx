import React, { useState, useEffect, useMemo } from 'react';
import { Search, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { getAllReports } from '../services/firebaseService';
import type { ReportData } from '@/types';

interface FeedbackViewerProps {
  teacherEmail: string;
  trigger?: React.ReactNode;
}

export const FeedbackViewer: React.FC<FeedbackViewerProps> = ({ 
  teacherEmail, 
  trigger 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch reports when modal opens
  useEffect(() => {
    if (isOpen && teacherEmail) {
      fetchReports();
    }
  }, [isOpen, teacherEmail]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const allReports = await getAllReports();
      // Filter reports by teacher email
      const teacherReports = allReports.filter(report => 
        report.teacherEmail === teacherEmail && report.reportText?.trim()
      );
      setReports(teacherReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter reports based on search term
  const filteredReports = useMemo(() => {
    if (!searchTerm.trim()) return reports;
    
    const term = searchTerm.toLowerCase();
    return reports.filter(report => 
      report.studentName?.toLowerCase().includes(term) ||
      report.reportText?.toLowerCase().includes(term)
    );
  }, [reports, searchTerm]);

  // Copy text to clipboard
  const copyToClipboard = async (text: string, reportId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(reportId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  // Group reports by student for better organization
  const groupedReports = useMemo(() => {
    const groups: Record<string, ReportData[]> = {};
    filteredReports.forEach(report => {
      const studentName = report.studentName || 'Unknown Student';
      if (!groups[studentName]) {
        groups[studentName] = [];
      }
      groups[studentName].push(report);
    });
    return groups;
  }, [filteredReports]);

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Search className="h-4 w-4 mr-2" />
      View My Feedback
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>My Written Feedback</DialogTitle>
          <DialogDescription>
            Search and copy your previously written feedback to reuse and adapt.
          </DialogDescription>
        </DialogHeader>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by student name or feedback content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Results */}
        <ScrollArea className="h-[60vh] -mx-6 px-6">
          <div className="space-y-4 pt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading feedback...</div>
                </div>
              ) : Object.keys(groupedReports).length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground text-center">
                    {searchTerm ? 'No feedback found matching your search.' : 'No feedback written yet.'}
                  </div>
                </div>
              ) : (
                Object.entries(groupedReports).map(([studentName, studentReports]) => (
                <Card key={studentName}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{studentName}</span>
                      <Badge variant="secondary" className="shrink-0 ml-2">
                        {studentReports.length} feedback{studentReports.length !== 1 ? 's' : ''}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {studentReports.map((report) => (
                      <div key={report.id} className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-muted-foreground mb-2">
                              {new Date(report.createdAt).toLocaleDateString()} • 
                              {new Date(report.updatedAt).toLocaleDateString() !== new Date(report.createdAt).toLocaleDateString() && 
                                ` Updated: ${new Date(report.updatedAt).toLocaleDateString()}`
                              }
                            </p>
                            <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
                              {report.reportText}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(report.reportText, report.id)}
                            className="shrink-0"
                          >
                            {copiedId === report.id ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
