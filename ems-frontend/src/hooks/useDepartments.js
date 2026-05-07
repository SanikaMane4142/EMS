import { useQuery } from '@tanstack/react-query';
import { departmentService } from '../services/departmentService';

export const useDepartments = () => {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentService.getAll(),
  });
};
