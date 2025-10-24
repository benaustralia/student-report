// Global debug log store for capturing logs from app startup
// This runs immediately when the module loads

if (typeof window !== 'undefined') {
  // Initialize global log store
  (window as any).debugLogStore = (window as any).debugLogStore || [];
  
  // Store original console methods
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Override console methods to capture logs
  console.log = (...args) => {
    const logEntry = `[LOG] ${new Date().toISOString()}: ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')}`;
    (window as any).debugLogStore.push(logEntry);
    originalLog(...args);
  };
  
  console.error = (...args) => {
    const logEntry = `[ERROR] ${new Date().toISOString()}: ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')}`;
    (window as any).debugLogStore.push(logEntry);
    originalError(...args);
  };
  
  console.warn = (...args) => {
    const logEntry = `[WARN] ${new Date().toISOString()}: ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')}`;
    (window as any).debugLogStore.push(logEntry);
    originalWarn(...args);
  };
  
  // Add initial startup log
  (window as any).debugLogStore.push(`[STARTUP] ${new Date().toISOString()}: Debug logging initialized`);
}
