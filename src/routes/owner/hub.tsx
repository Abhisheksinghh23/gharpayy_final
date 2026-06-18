import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/owner/hub')({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === 'string' ? search.id : undefined,
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/owner', search });
  },
});
