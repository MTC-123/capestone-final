import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo } from '@/components/ui/Logo';

describe('Logo Component', () => {
  describe('variants', () => {
    it('renders badge variant by default', () => {
      render(<Logo />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/logos/badge.png');
    });

    it('renders badge variant explicitly', () => {
      render(<Logo variant="badge" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveAttribute('src', '/logos/badge.png');
    });

    it('renders icon variant', () => {
      render(<Logo variant="icon" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveAttribute('src', '/logos/badge.png');
    });

    it('renders horizontal variant', () => {
      render(<Logo variant="horizontal" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveAttribute('src', '/logos/badge.png');
    });
  });

  describe('sizes', () => {
    it('renders medium size by default', () => {
      render(<Logo />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveAttribute('width', '40');
      expect(img).toHaveAttribute('height', '40');
    });

    it('renders xs size', () => {
      render(<Logo size="xs" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveAttribute('width', '24');
      expect(img).toHaveAttribute('height', '24');
    });

    it('renders sm size', () => {
      render(<Logo size="sm" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveAttribute('width', '32');
      expect(img).toHaveAttribute('height', '32');
    });

    it('renders lg size', () => {
      render(<Logo size="lg" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveAttribute('width', '56');
      expect(img).toHaveAttribute('height', '56');
    });

    it('renders xl size', () => {
      render(<Logo size="xl" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveAttribute('width', '80');
      expect(img).toHaveAttribute('height', '80');
    });
  });

  describe('className', () => {
    it('applies custom className', () => {
      render(<Logo className="custom-class" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveClass('custom-class');
    });

    it('preserves default classes with custom className', () => {
      render(<Logo className="custom-class" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveClass('object-contain');
      expect(img).toHaveClass('custom-class');
    });
  });

  describe('priority', () => {
    it('renders without priority by default', () => {
      render(<Logo />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toBeInTheDocument();
    });

    it('renders with priority when specified', () => {
      render(<Logo priority />);
      const img = screen.getByAltText('RICER Logo');
      // Priority is a Next.js optimization prop, not an HTML attribute
      expect(img).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper alt text', () => {
      render(<Logo />);
      expect(screen.getByAltText('RICER Logo')).toBeInTheDocument();
    });

    it('is accessible with all variants', () => {
      const variants = ['badge', 'icon', 'horizontal'] as const;
      variants.forEach((variant) => {
        const { unmount } = render(<Logo variant={variant} />);
        expect(screen.getByAltText('RICER Logo')).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('combination tests', () => {
    it('renders icon variant with xl size', () => {
      render(<Logo variant="icon" size="xl" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveAttribute('src', '/logos/badge.png');
      expect(img).toHaveAttribute('width', '80');
      expect(img).toHaveAttribute('height', '80');
    });

    it('renders horizontal variant with sm size and custom class', () => {
      render(<Logo variant="horizontal" size="sm" className="my-custom-logo" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveAttribute('src', '/logos/badge.png');
      expect(img).toHaveAttribute('width', '32');
      expect(img).toHaveAttribute('height', '32');
      expect(img).toHaveClass('w-8');
      expect(img).toHaveClass('my-custom-logo');
    });

    it('renders with priority and custom size', () => {
      render(<Logo size="lg" priority className="priority-logo" />);
      const img = screen.getByAltText('RICER Logo');
      expect(img).toHaveAttribute('width', '56');
      expect(img).toHaveClass('priority-logo');
    });
  });
});
