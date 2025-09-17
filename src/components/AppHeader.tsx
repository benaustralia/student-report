import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/theme-toggle';
import { RefreshCw } from 'lucide-react';

interface AppHeaderProps {
  loading: boolean;
  error: string | null;
  teacher: string;
  teachers: string[];
  search: string;
  onRefresh: () => void;
  onTeacherChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  loading,
  error,
  teacher,
  teachers,
  search,
  onRefresh,
  onTeacherChange,
  onSearchChange,
}) => {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">NSA Student Report-o-matic</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
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
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={teacher} onValueChange={onTeacherChange}>
              <SelectTrigger className="w-full sm:flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teachers</SelectItem>
                {teachers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input 
              placeholder="Search students..." 
              value={search} 
              onChange={(e) => onSearchChange(e.target.value)} 
              className="w-full sm:flex-1" 
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AppHeader;
