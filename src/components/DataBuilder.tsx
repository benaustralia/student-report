import { useAuthContext } from '@/hooks/useAuthContext';
import { DataBuilderUI } from './DataBuilderUI';

export const DataBuilder = () => {
  const { user } = useAuthContext();
  return <DataBuilderUI userEmail={user?.email || null} />;
};
