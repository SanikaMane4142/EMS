import { useQuery } from '@tanstack/react-query';
import { leaveService } from '../services/leaveService';

export const useMyLeaves = (userId) => {
  return useQuery({
    queryKey: ['leaves', 'mine', userId],
    queryFn: () => leaveService.getMyLeaves(userId),
    enabled: !!userId,
  });
};
