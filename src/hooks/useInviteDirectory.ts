import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type { User } from '../lib/AuthContext';
import { isScriptDocument } from '../pages/SecFilings/components/DocumentRunningHeader';

/**
 * The people an invite can be sent to. A script is written and reviewed with the Social Media portal's people, so its
 * list comes from there (people with no account here yet can't be invited); everything else uses this portal's own
 * directory. When the directory is unavailable the contributor is typed in: there are no made-up fallback people,
 * since picking one would invite, and give document access to, an address nobody chose.
 */
export function useInviteDirectory() {
  const forScript = isScriptDocument();
  return useQuery({
    queryKey: [forScript ? 'script-users' : 'users'],
    queryFn: async (): Promise<User[]> => {
      try {
        if (forScript) {
          const people = await apiClient.get<(User & { has_account?: boolean })[]>('/api/sec-filings/script-users');
          return Array.isArray(people) ? people.filter((p) => p.has_account !== false) : [];
        }
        const res = await apiClient.get<User[]>('/api/configuration/users');
        if (Array.isArray(res) && res.length > 0) return res;
      } catch {
        // Directory unavailable (offline or no permission).
      }
      return [];
    },
    staleTime: 60_000,
  });
}
