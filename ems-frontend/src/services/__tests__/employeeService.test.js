import { describe, it, expect, vi, beforeEach } from 'vitest';
import { employeeService } from '../employeeService';
import { supabase } from '../../lib/supabaseClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('employeeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAll should fetch employees with department data', async () => {
    const mockData = [{ id: 1, full_name: 'John Doe', departments: { name: 'IT' } }];
    
    // Setup the fluent API mock
    const orderMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    supabase.from.mockReturnValue({ select: selectMock });

    const result = await employeeService.getAll();

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(result).toEqual(mockData);
  });

  it('getAll should throw error if fetch fails', async () => {
    const mockError = new Error('Database Error');
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: mockError });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    supabase.from.mockReturnValue({ select: selectMock });

    await expect(employeeService.getAll()).rejects.toThrow('Database Error');
  });
});
