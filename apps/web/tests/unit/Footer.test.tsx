import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

// Mock dependencies
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        brandTitle: 'RICER Ifrane',
        brandSubtitle: 'نظام الإبلاغ عن الحرائق',
        footerDescription:
          'Système de gestion et de signalement des incendies pour Ifrane, Maroc',
        footerNavigation: 'Navigation',
        footerFireMap: 'Carte des incendies',
        footerAnalytics: 'Analytique',
        footerReportFire: 'Signaler un incendie',
        footerEmergency: 'Urgences',
        footerCivilProtection: '15 - Protection Civile',
        footerWaterForests: '190 - Eaux et Forêts',
        footerInformation: 'Informations',
        footerErrorCodes: "Codes d'erreur",
        footerAllRightsReserved: 'Tous droits réservés',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/components/ui/Logo', () => ({
  Logo: ({ variant, size }: { variant?: string; size?: string }) => (
    <div data-testid="logo" data-variant={variant} data-size={size}>
      Logo
    </div>
  ),
}));

vi.mock('@/components/ui/Icon', () => ({
  Icon: ({ name, size }: { name: string; size?: number }) => (
    <span data-testid={`icon-${name}`} data-size={size}>
      {name}
    </span>
  ),
}));

describe('Footer Component', () => {
  const currentYear = new Date().getFullYear();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<Footer />);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('displays footer as a semantic footer element', () => {
      render(<Footer />);
      const footer = screen.getByRole('contentinfo');
      expect(footer.tagName).toBe('FOOTER');
    });
  });

  describe('branding section', () => {
    it('displays logo with correct props', () => {
      render(<Footer />);
      const logo = screen.getByTestId('logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('data-variant', 'badge');
      expect(logo).toHaveAttribute('data-size', 'md');
    });

    it('displays brand title', () => {
      render(<Footer />);
      expect(screen.getByText('RICER Ifrane')).toBeInTheDocument();
    });

    it('displays brand subtitle', () => {
      render(<Footer />);
      expect(screen.getByText('نظام الإبلاغ عن الحرائق')).toBeInTheDocument();
    });

    it('displays French description', () => {
      render(<Footer />);
      expect(
        screen.getByText('Système de gestion et de signalement des incendies pour Ifrane, Maroc')
      ).toBeInTheDocument();
    });
  });

  describe('navigation links', () => {
    it('displays Navigation heading', () => {
      render(<Footer />);
      expect(screen.getByText('Navigation')).toBeInTheDocument();
    });

    it('displays all navigation links', () => {
      render(<Footer />);
      expect(screen.getByText('Carte des incendies')).toBeInTheDocument();
      expect(screen.getByText('Analytique')).toBeInTheDocument();
      expect(screen.getByText('Signaler un incendie')).toBeInTheDocument();
    });

    it('navigation links have correct hrefs', () => {
      render(<Footer />);
      const mapLink = screen.getByText('Carte des incendies').closest('a');
      const analyticsLink = screen.getByText('Analytique').closest('a');
      const reportLink = screen.getByText('Signaler un incendie').closest('a');

      expect(mapLink).toHaveAttribute('href', '/map');
      expect(analyticsLink).toHaveAttribute('href', '/analytics');
      expect(reportLink).toHaveAttribute('href', '/report');
    });
  });

  describe('emergency contacts', () => {
    it('displays Urgences heading', () => {
      render(<Footer />);
      expect(screen.getByText('Urgences')).toBeInTheDocument();
    });

    it('displays Protection Civile contact', () => {
      render(<Footer />);
      expect(screen.getByText('15 - Protection Civile')).toBeInTheDocument();
    });

    it('displays Eaux et Forêts contact', () => {
      render(<Footer />);
      expect(screen.getByText('190 - Eaux et Forêts')).toBeInTheDocument();
    });

    it('displays phone icons for emergency contacts', () => {
      render(<Footer />);
      const phoneIcons = screen.getAllByTestId('icon-phone');
      expect(phoneIcons).toHaveLength(2);
      phoneIcons.forEach((icon) => {
        expect(icon).toHaveAttribute('data-size', '14');
      });
    });
  });


  describe('copyright section', () => {
    it('displays current year', () => {
      render(<Footer />);
      expect(screen.getByText(new RegExp(currentYear.toString()))).toBeInTheDocument();
    });

    it('displays copyright text', () => {
      render(<Footer />);
      expect(
        screen.getByText(`© ${currentYear} RICER Ifrane. Tous droits réservés.`)
      ).toBeInTheDocument();
    });
  });

  describe('layout and styling', () => {
    it('has border-t class for top border', () => {
      render(<Footer />);
      const footer = screen.getByRole('contentinfo');
      expect(footer).toHaveClass('border-t');
    });

    it('has bg-surface-2/50 class for background', () => {
      render(<Footer />);
      const footer = screen.getByRole('contentinfo');
      expect(footer).toHaveClass('bg-surface-2/50');
    });

    it('has mt-auto class for sticky footer', () => {
      render(<Footer />);
      const footer = screen.getByRole('contentinfo');
      expect(footer).toHaveClass('mt-auto');
    });
  });

  describe('responsive behavior', () => {
    it('uses responsive grid classes', () => {
      const { container } = render(<Footer />);
      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-1');
      expect(grid).toHaveClass('sm:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
    });
  });

  describe('accessibility', () => {
    it('all links have proper hover states', () => {
      render(<Footer />);
      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        // Check if link has transition or hover classes
        const hasHoverClass =
          link.className.includes('hover:') || link.className.includes('transition');
        expect(hasHoverClass).toBe(true);
      });
    });

    it('has semantic HTML structure', () => {
      const { container } = render(<Footer />);
      const footer = container.querySelector('footer');
      expect(footer).toBeInTheDocument();

      // Check for proper heading hierarchy
      const headings = container.querySelectorAll('h3');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('emergency contacts are in a list', () => {
      const { container } = render(<Footer />);
      const emergencySection = screen.getByText('Urgences').closest('div');
      const list = emergencySection?.querySelector('ul');
      expect(list).toBeInTheDocument();
    });
  });

  describe('all sections present', () => {
    it('contains all three main sections', () => {
      render(<Footer />);

      // Branding
      expect(screen.getByText('RICER Ifrane')).toBeInTheDocument();

      // Navigation
      expect(screen.getByText('Navigation')).toBeInTheDocument();

      // Emergency
      expect(screen.getByText('Urgences')).toBeInTheDocument();

      // Copyright
      expect(screen.getByText(new RegExp(currentYear.toString()))).toBeInTheDocument();
    });
  });
});
