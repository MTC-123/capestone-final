# Contributing to RICER Platform

Thank you for your interest in contributing to the RICER (Resilient Infrastructures and Coordinated Emergency Response) Platform! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful, inclusive, and collaborative environment. We expect all contributors to:

- Be respectful and considerate in all interactions
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences
- Accept responsibility and apologize for mistakes

---

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please create an issue with the following information:

- **Clear title** describing the problem
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Environment details** (OS, Node version, browser)
- **Screenshots** if applicable
- **Error messages** or console logs

**Use the bug report template:** [Create Bug Report](https://github.com/MTC-123/FireDetectionPlatform/issues/new)

### Suggesting Enhancements

We welcome feature suggestions! Please create an issue with:

- **Clear description** of the proposed feature
- **Use case** explaining why this would be valuable
- **Alternative solutions** you've considered
- **Implementation ideas** (if you have any)

**Use the feature request template:** [Request Feature](https://github.com/MTC-123/FireDetectionPlatform/issues/new)

### Contributing Code

1. **Check existing issues** - Someone might already be working on it
2. **Create an issue** first for significant changes
3. **Fork the repository** and create a branch
4. **Make your changes** following our coding standards
5. **Write tests** for new functionality
6. **Update documentation** as needed
7. **Submit a pull request** with a clear description

---

## Development Setup

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- MongoDB Atlas account (for database)
- Git

### Local Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/FireDetectionPlatform.git
cd FireDetectionPlatform

# 2. Navigate to the web app
cd apps/web

# 3. Install dependencies
npm install

# 4. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your MongoDB URI and JWT secret

# 5. Initialize the database
npm run prisma:generate
npm run prisma:push
npm run prisma:seed

# 6. Start development server
npm run dev
```

### Project Structure

```
apps/web/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/              # Utilities and helpers
│   ├── types/            # TypeScript type definitions
│   └── middleware.ts     # Next.js middleware
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seeding script
├── public/               # Static assets
└── tests/                # Test files
```

---

## Coding Standards

### TypeScript

- **Use TypeScript** for all new code
- **Enable strict mode** - No `any` types without justification
- **Define interfaces** for all data structures
- **Use meaningful names** for variables and functions
- **Add JSDoc comments** for complex functions

**Example:**
```typescript
/**
 * Calculates the distance between two geographic coordinates
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Implementation
}
```

### React Components

- **Use functional components** with hooks
- **Follow naming conventions:**
  - Components: PascalCase (`FireMap.tsx`)
  - Hooks: camelCase starting with `use` (`useWeatherData.ts`)
  - Utilities: camelCase (`formatDate.ts`)
- **Keep components focused** - Single responsibility principle
- **Use TypeScript props interfaces**

**Example:**
```typescript
interface FireMapProps {
  incidents: Incident[];
  onMarkerClick: (id: string) => void;
  selectedIncidentId?: string;
}

export function FireMap({ incidents, onMarkerClick, selectedIncidentId }: FireMapProps) {
  // Component implementation
}
```

### Styling

- **Use Tailwind CSS** for styling
- **Follow RTL-first approach** for Arabic support
- **Use design tokens** from `tailwind.config.ts`
- **Keep inline styles minimal**

### API Routes

- **Use Next.js API routes** in `app/api/`
- **Implement proper error handling**
- **Validate input data** with Zod or similar
- **Return consistent response formats**
- **Add authentication checks** where needed

**Example:**
```typescript
export async function GET(request: NextRequest) {
  try {
    const data = await fetchData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
```

---

## Commit Message Guidelines

We follow **Conventional Commits** for clear git history and automated changelog generation.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, no logic change)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks (dependencies, build config)
- `perf` - Performance improvements

### Examples

```bash
feat(map): add truck deployment tracking

- Add real-time truck locations to map
- Implement truck status indicators
- Add filtering by deployment status

Closes #123
```

```bash
fix(auth): resolve JWT token expiration issue

Token was not being refreshed properly on page reload.
Now checks expiration and refreshes when needed.

Fixes #456
```

```bash
docs(readme): update installation instructions

Add troubleshooting section for MongoDB connection issues
```

---

## Pull Request Process

### Before Submitting

1. ✅ **Run tests:** `npm test`
2. ✅ **Run linter:** `npm run lint`
3. ✅ **Check formatting:** `npm run format`
4. ✅ **Update documentation** if needed
5. ✅ **Test manually** in the browser

### PR Template

When creating a pull request, include:

**Description:**
- What changes does this PR introduce?
- Why are these changes needed?

**Type of Change:**
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

**Testing:**
- How have you tested these changes?
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

**Screenshots:**
(If applicable, add screenshots or GIFs)

**Related Issues:**
Closes #123

### Review Process

1. **Automated checks** must pass (tests, linting)
2. **At least one maintainer** must approve
3. **Address feedback** promptly and professionally
4. **Squash commits** if needed before merge
5. **Maintainer will merge** once approved

---

## Testing Guidelines

### Writing Tests

- **Write tests** for all new features
- **Aim for 80%+ coverage** on new code
- **Test edge cases** and error conditions
- **Use descriptive test names**

### Test Structure

```typescript
describe('Component/Function Name', () => {
  it('should do something specific', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

### Test Categories

1. **Unit Tests** - Individual functions and components
2. **Integration Tests** - API routes and database interactions
3. **E2E Tests** - Complete user workflows

---

## Documentation

### When to Update Docs

- **New features** - Add to README.md and relevant docs
- **API changes** - Update JSDoc comments and API documentation
- **Breaking changes** - Clearly document in CHANGELOG.md
- **Setup changes** - Update INSTALLATION.md

### Documentation Style

- **Clear and concise** - No unnecessary jargon
- **Examples** - Show, don't just tell
- **Step-by-step** - Break complex tasks into steps
- **Screenshots** - Visual aids where helpful
- **Keep updated** - Outdated docs are worse than no docs

---

## Questions?

If you have questions about contributing:

1. **Check existing issues** - Your question might be answered
2. **Read the docs** - [Installation Guide](./apps/web/INSTALLATION.md), [Architecture](./apps/web/docs/ARCHITECTURE.md)
3. **Ask in an issue** - Create a question issue
4. **Contact maintainers** - Via GitHub

---

## Recognition

Contributors will be recognized in:

- **GitHub Contributors** page
- **CHANGELOG.md** for significant contributions
- **Project documentation** for major features

Thank you for helping improve the RICER Platform! 🔥🇲🇦
