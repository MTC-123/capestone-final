import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));

vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: 'OFFICIAL' } }),
}));

const addToast = vi.fn();
vi.mock('@/store/useToastStore', () => ({
  useToastStore: (selector: (state: { addToast: typeof addToast }) => unknown) => selector({ addToast }),
}));

const fetchWithAuth = vi.fn();
vi.mock('@/lib/api/fetchWithAuth', () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuth(...args),
}));

import AdminApprovalsPage from '@/app/(protected)/admin/approvals/page';

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

const sampleItems = [
  {
    id: 'req-1',
    department: 'Forestry',
    position: 'Warden',
    justification: 'I coordinate patrols in the Ifrane sector.',
    status: 'PENDING',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    user: {
      id: 'user-1',
      cin: 'AB123456',
      fullName: 'Youssef Amrani',
      phone: '+212600000001',
      email: 'youssef@example.com',
      role: 'CIVILIAN',
      createdAt: new Date().toISOString(),
    },
  },
];

describe('AdminApprovalsPage', () => {
  beforeEach(() => {
    fetchWithAuth.mockReset();
    addToast.mockReset();
  });

  it('renders the pending list from the API', async () => {
    fetchWithAuth.mockResolvedValueOnce(jsonResponse({ items: sampleItems, pending: 1 }));

    render(<AdminApprovalsPage />);

    await waitFor(() => expect(screen.getByText('Youssef Amrani')).toBeInTheDocument());
    expect(screen.getByText('AB123456')).toBeInTheDocument();
    expect(screen.getByText('Forestry')).toBeInTheDocument();
    expect(fetchWithAuth).toHaveBeenCalledWith('/api/admin/official-requests?status=PENDING');
  });

  it('shows an empty state when there are no requests', async () => {
    fetchWithAuth.mockResolvedValueOnce(jsonResponse({ items: [], pending: 0 }));

    render(<AdminApprovalsPage />);

    await waitFor(() => expect(screen.getByText('adminApprovalsEmptyTitle')).toBeInTheDocument());
  });

  it('opens a confirmation dialog when Approve is clicked', async () => {
    fetchWithAuth.mockResolvedValueOnce(jsonResponse({ items: sampleItems, pending: 1 }));

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(<AdminApprovalsPage />);

    await waitFor(() => expect(screen.getByText('Youssef Amrani')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'adminApprove' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
