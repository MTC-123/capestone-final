import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Design Tokens Integration', () => {
  const globalsCSS = fs.readFileSync(
    path.join(__dirname, '../../src/app/globals.css'),
    'utf-8'
  );

  describe('CSS Variables', () => {
    describe('light mode tokens', () => {
      it('defines success-muted token', () => {
        expect(globalsCSS).toContain('--success-muted:');
      });

      it('defines warning-muted token', () => {
        expect(globalsCSS).toContain('--warning-muted:');
      });

      it('defines danger-muted token', () => {
        expect(globalsCSS).toContain('--danger-muted:');
      });

      it('defines success-foreground token', () => {
        expect(globalsCSS).toContain('--success-foreground:');
      });

      it('defines warning-foreground token', () => {
        expect(globalsCSS).toContain('--warning-foreground:');
      });

      it('defines danger-foreground token', () => {
        expect(globalsCSS).toContain('--danger-foreground:');
      });
    });

    describe('dark mode tokens', () => {
      it('defines dark mode section', () => {
        expect(globalsCSS).toContain('.dark {');
      });

      it('defines success-muted in dark mode', () => {
        const darkSection = globalsCSS.split('.dark {')[1];
        expect(darkSection).toContain('--success-muted:');
      });

      it('defines warning-muted in dark mode', () => {
        const darkSection = globalsCSS.split('.dark {')[1];
        expect(darkSection).toContain('--warning-muted:');
      });

      it('defines danger-muted in dark mode', () => {
        const darkSection = globalsCSS.split('.dark {')[1];
        expect(darkSection).toContain('--danger-muted:');
      });
    });

    describe('existing tokens', () => {
      it('preserves primary color token', () => {
        expect(globalsCSS).toContain('--primary:');
      });

      it('preserves background token', () => {
        expect(globalsCSS).toContain('--background:');
      });

      it('preserves foreground token', () => {
        expect(globalsCSS).toContain('--foreground:');
      });

      it('preserves surface tokens', () => {
        expect(globalsCSS).toContain('--surface:');
        expect(globalsCSS).toContain('--surface-2:');
      });

      it('preserves border token', () => {
        expect(globalsCSS).toContain('--border:');
      });
    });
  });

  describe('Hardcoded Color Elimination', () => {
    const filesToCheck = [
      'src/app/(protected)/analytics/page.tsx',
      'src/app/(protected)/report/page.tsx',
      'src/app/(protected)/reports-list/page.tsx',
      'src/app/(protected)/equipment/page.tsx',
    ];

    filesToCheck.forEach((filePath) => {
      describe(filePath, () => {
        const fullPath = path.join(__dirname, '../..', filePath);
        let fileContent: string;

        try {
          fileContent = fs.readFileSync(fullPath, 'utf-8');
        } catch (error) {
          fileContent = '';
        }

        if (fileContent) {
          it('does not use bg-white', () => {
            expect(fileContent).not.toContain('bg-white');
          });

          it('does not use bg-gray-* for backgrounds', () => {
            const grayBackgrounds = [
              'bg-gray-50',
              'bg-gray-100',
              'bg-gray-200',
              'bg-gray-300',
            ];
            grayBackgrounds.forEach((className) => {
              expect(fileContent).not.toContain(className);
            });
          });

          it('does not use text-gray-* for foreground', () => {
            const grayText = [
              'text-gray-600',
              'text-gray-700',
              'text-gray-800',
              'text-gray-900',
            ];
            grayText.forEach((className) => {
              expect(fileContent).not.toContain(className);
            });
          });

          it('does not use hardcoded red colors', () => {
            const redColors = ['bg-red-50', 'bg-red-100', 'text-red-600', 'text-red-800'];
            redColors.forEach((className) => {
              expect(fileContent).not.toContain(className);
            });
          });

          it('does not use hardcoded green colors', () => {
            const greenColors = [
              'bg-green-50',
              'bg-green-100',
              'text-green-600',
              'text-green-800',
            ];
            greenColors.forEach((className) => {
              expect(fileContent).not.toContain(className);
            });
          });

          it('does not use hardcoded orange colors', () => {
            const orangeColors = [
              'bg-orange-100',
              'bg-orange-200',
              'text-orange-700',
              'text-orange-800',
            ];
            orangeColors.forEach((className) => {
              expect(fileContent).not.toContain(className);
            });
          });

          it('does not use hardcoded yellow colors', () => {
            const yellowColors = [
              'bg-yellow-100',
              'bg-yellow-200',
              'text-yellow-800',
            ];
            yellowColors.forEach((className) => {
              expect(fileContent).not.toContain(className);
            });
          });

          it('does not use hardcoded blue colors', () => {
            const blueColors = ['bg-blue-50', 'bg-blue-100', 'text-blue-600'];
            blueColors.forEach((className) => {
              expect(fileContent).not.toContain(className);
            });
          });
        }
      });
    });
  });

  describe('Design Token Usage', () => {
    const filesToCheck = [
      'src/components/analytics/panels/OverviewPanel.tsx',
      'src/components/report/ConfirmationScreen.tsx',
      'src/app/(protected)/reports-list/page.tsx',
      'src/components/equipment/EquipmentSection.tsx',
    ];

    filesToCheck.forEach((filePath) => {
      describe(filePath, () => {
        const fullPath = path.join(__dirname, '../..', filePath);
        let fileContent: string;

        try {
          fileContent = fs.readFileSync(fullPath, 'utf-8');
        } catch (error) {
          fileContent = '';
        }

        if (fileContent) {
          it('uses design tokens (foreground/muted)', () => {
            const hasDesignTokens =
              fileContent.includes('text-foreground') ||
              fileContent.includes('text-muted-foreground') ||
              fileContent.includes('bg-muted');
            expect(hasDesignTokens).toBe(true);
          });

          it('uses semantic status colors', () => {
            const hasSemanticColors =
              fileContent.includes('danger-muted') ||
              fileContent.includes('warning-muted') ||
              fileContent.includes('success-muted') ||
              fileContent.includes('danger-foreground') ||
              fileContent.includes('warning-foreground') ||
              fileContent.includes('success-foreground') ||
              fileContent.includes('danger') ||
              fileContent.includes('warning') ||
              fileContent.includes('success');
            expect(hasSemanticColors).toBe(true);
          });

          it('uses Card component', () => {
            expect(fileContent).toContain('Card');
          });
        }
      });
    });
  });

  describe('Tailwind Config', () => {
    const tailwindConfig = fs.readFileSync(
      path.join(__dirname, '../../tailwind.config.ts'),
      'utf-8'
    );

    it('includes success-muted in config', () => {
      expect(tailwindConfig).toContain('success-muted');
    });

    it('includes warning-muted in config', () => {
      expect(tailwindConfig).toContain('warning-muted');
    });

    it('includes danger-muted in config', () => {
      expect(tailwindConfig).toContain('danger-muted');
    });

    it('includes success-foreground in config', () => {
      expect(tailwindConfig).toContain('success-foreground');
    });

    it('includes warning-foreground in config', () => {
      expect(tailwindConfig).toContain('warning-foreground');
    });

    it('includes danger-foreground in config', () => {
      expect(tailwindConfig).toContain('danger-foreground');
    });

    it('uses HSL variables for colors', () => {
      expect(tailwindConfig).toContain('hsl(var(--');
    });
  });
});
