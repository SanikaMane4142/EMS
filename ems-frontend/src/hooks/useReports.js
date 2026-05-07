import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportService } from '../services/reportService';

export const useReports = (dateStr) => {
  return useQuery({
    queryKey: ['reports', dateStr || 'all'],
    queryFn: () => dateStr ? reportService.getReportsByDate(dateStr) : reportService.getAllReports(),
  });
};

export const useReviewReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId, reviewerId }) => reportService.reviewReport(id, userId, reviewerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};
