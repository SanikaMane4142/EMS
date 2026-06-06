import { useQuery } from '@tanstack/react-query';
import { departmentService } from '../services/departmentService';

export const useDepartments = () => {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentService.getAll(),
  });
};

export const useDepartmentStats = () => {
  return useQuery({
    queryKey: ['departments', 'stats'],
    queryFn: () => departmentService.getDepartmentStats(),
  });
};
