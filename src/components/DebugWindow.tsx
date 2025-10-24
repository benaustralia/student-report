import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, X } from 'lucide-react';
import { toast } from 'sonner';

interface DebugWindowProps {
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DebugWindow: React.FC<DebugWindowProps> = ({ userEmail, isOpen, onClose }) => {
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const logs: string[] = [];

    console.log = (...args) => {
      logs.push(`[LOG] ${new Date().toISOString()}: ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}`);
      originalLog(...args);
    };

    console.error = (...args) => {
      logs.push(`[ERROR] ${new Date().toISOString()}: ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}`);
      originalError(...args);
    };

    console.warn = (...args) => {
      logs.push(`[WARN] ${new Date().toISOString()}: ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}`);
      originalWarn(...args);
    };

    // Add initial debug info
    logs.push(`[DEBUG] ${new Date().toISOString()}: Debug window opened for ${userEmail}`);
    logs.push(`[DEBUG] ${new Date().toISOString()}: User Agent: ${navigator.userAgent}`);
    logs.push(`[DEBUG] ${new Date().toISOString()}: Current URL: ${window.location.href}`);

    // Add any existing logs from the global log store
    const existingLogs = (window as any).debugLogStore || [];
    logs.unshift(...existingLogs);

    setDebugLogs([...logs]);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [isOpen, userEmail]);

  const copyLogs = () => {
    const logText = debugLogs.join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      toast.success('Debug logs copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy logs');
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden border-4 border-red-500 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">
            🐛 Debug Logs for {userEmail}
          </CardTitle>
          <div className="flex space-x-2">
            <Button onClick={copyLogs} size="sm" variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              Copy Logs
            </Button>
            <Button onClick={onClose} size="sm" variant="outline">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto max-h-[60vh]">
          <div className="bg-gray-100 p-4 rounded font-mono text-xs whitespace-pre-wrap">
            {debugLogs.length === 0 ? 'No logs yet...' : debugLogs.join('\n')}
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Instructions:</strong></p>
            <ol className="list-decimal list-inside space-y-1 mt-2">
              <li>Click "Copy Logs" button above</li>
              <li>Paste the logs in a text message to your administrator</li>
              <li>Include any error messages you see on screen</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
