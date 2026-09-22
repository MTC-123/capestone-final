import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhotoUpload } from '@/components/report/PhotoUpload';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

vi.mock('@/hooks/useBreakpoint', () => ({
  useIsMobile: () => false,
}));

describe('PhotoUpload', () => {
  it('renders add photos button when empty', () => {
    render(<PhotoUpload images={[]} onChange={() => {}} />);
    expect(screen.getByText('addPhotos')).toBeInTheDocument();
  });

  it('shows thumbnails for existing images', () => {
    const images = [
      'data:image/jpeg;base64,/9j/fake1',
      'data:image/jpeg;base64,/9j/fake2',
    ];
    render(<PhotoUpload images={images} onChange={() => {}} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(2);
  });

  it('shows remove button on each thumbnail', () => {
    const images = ['data:image/jpeg;base64,/9j/fake1'];
    render(<PhotoUpload images={images} onChange={() => {}} />);
    expect(screen.getByLabelText('removePhoto')).toBeInTheDocument();
  });

  it('calls onChange without the removed image when remove is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const images = [
      'data:image/jpeg;base64,/9j/fake1',
      'data:image/jpeg;base64,/9j/fake2',
    ];
    render(<PhotoUpload images={images} onChange={onChange} />);

    const removeButtons = screen.getAllByLabelText('removePhoto');
    await user.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith(['data:image/jpeg;base64,/9j/fake2']);
  });

  it('hides add button when max photos reached', () => {
    const images = [
      'data:image/jpeg;base64,/9j/fake1',
      'data:image/jpeg;base64,/9j/fake2',
      'data:image/jpeg;base64,/9j/fake3',
    ];
    render(<PhotoUpload images={images} onChange={() => {}} />);
    expect(screen.queryByText('addPhotos')).not.toBeInTheDocument();
    expect(screen.getByText('maxPhotos')).toBeInTheDocument();
  });

  it('has a hidden file input', () => {
    render(<PhotoUpload images={[]} onChange={() => {}} />);
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('accept', 'image/*');
  });
});
