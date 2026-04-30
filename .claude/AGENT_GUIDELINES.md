# Agent Guidelines for LeadEngine Development

This document provides guidelines for the main Claude agent when working on different aspects of the LeadEngine project.

## Available Built-in Agents

Claude Code CLI provides these built-in agents:
- **Explore** - For codebase exploration and mapping
- **Plan** - For planning complex implementations
- **general-purpose** - General development tasks
- **claude-code-guide** - Help with Claude Code features

## Task-Specific Guidelines

### Frontend Development (React/Next.js/TypeScript)

**Focus Areas:**
- React 18+ with hooks and modern patterns
- Next.js 14+ (App Router, Server Components, Server Actions)
- TypeScript with strict type safety
- Tailwind CSS and responsive design
- Component architecture and reusability

**Key Principles:**
- Prefer Server Components over Client Components when possible
- Use TypeScript strict mode
- Follow project structure in `src/components` and `src/features`
- Implement responsive designs mobile-first
- Keep components focused and composable
- Use Tailwind utility classes consistently
- Test UI in browser before marking complete

**Important Files:**
- `src/components/` - Shared UI components
- `src/features/*/components/` - Feature-specific components
- `src/app/*/page.tsx` - Route pages

---

### Backend Development (Server Actions/Database)

**Focus Areas:**
- Next.js Server Actions and API Routes
- Database operations (Supabase, SQL)
- Data validation and sanitization
- Authentication and authorization
- Business logic implementation

**Key Principles:**
- Validate all inputs at system boundaries
- Use transactions for multi-step operations
- Optimize database queries (avoid N+1)
- Handle errors gracefully with proper status codes
- Follow action pattern in `src/app/actions`
- Use TypeScript for type-safe data handling
- Never expose sensitive data in responses

**Important Files:**
- `src/app/actions/` - Server Actions
- `src/utils/supabase/` - Database clients
- `supabase/migrations/` - Schema migrations

---

### Codebase Exploration

**When to Use Explore Agent:**
- Broad codebase exploration (>3 queries)
- Finding files across multiple directories
- Understanding architecture patterns
- Mapping dependencies

**Exploration Strategy:**
1. Start with high-level structure (package.json, docs)
2. Use Glob to find files by pattern
3. Use Grep to search for code patterns
4. Read key files to understand conventions
5. Trace imports and dependencies

**Key Documentation:**
- `docs/leadengine-system-overview.md` - System truth
- `README.md` - Basic setup
- `src/types/` - Domain models

---

### Code Review & Quality

**Review Checklist:**

**Security:**
- Input validation and sanitization
- SQL injection, XSS, CSRF prevention
- Authentication and authorization
- Sensitive data exposure

**Quality:**
- Code clarity and readability
- Proper error handling
- Edge case coverage
- Type safety
- Naming conventions

**Performance:**
- Database query optimization
- Unnecessary re-renders
- Bundle size impact
- Caching opportunities

**Best Practices:**
- Follows project conventions
- Proper separation of concerns
- Testability
- Accessibility compliance

---

### Testing & QA

**Test Categories:**

**Functional Testing:**
- Feature works as expected
- All user flows complete successfully
- Data is saved and retrieved correctly
- Validation works properly

**UI/UX Testing:**
- Layout is responsive
- Elements are accessible
- Loading states work
- Error messages are clear

**Error Handling:**
- Invalid inputs are rejected
- Error messages are helpful
- System recovers gracefully

**Performance:**
- Page loads quickly
- No unnecessary re-renders
- Queries are optimized

---

### Code Maintenance & Refactoring

**When to Refactor:**
- Code is duplicated 3+ times
- Function/component is too complex
- Code is hard to understand
- Performance is measurably poor
- Technical debt is blocking new work

**When NOT to Refactor:**
- Code works and is clear enough
- Change would break existing functionality
- Refactor is purely cosmetic
- Time is better spent elsewhere

**Maintenance Tasks:**
- Extract reusable components/functions
- Simplify complex logic
- Reduce code duplication
- Remove dead code and unused imports
- Optimize performance bottlenecks
- Improve documentation

---

## Project-Specific Context

### Domain Model
- **companies** (internal tenant) ≠ **client_companies** (CRM customers)
- **leads** - sales opportunities with pipeline stages
- **contacts** - linked to client companies
- **pipelines** - configurable with stages & transition rules

### Security Model
- Database is authority for access control (RLS)
- Server Actions for all write operations
- Company-scoped tenancy with holding company exception
- Role-based permissions with app modules

### Tech Stack
- Next.js 16 App Router
- React 19
- TypeScript
- Supabase (auth + database)
- Tailwind CSS v4
- shadcn/ui components

### Important Conventions
- Use Server Components by default
- Server Actions in `src/app/actions/`
- Feature modules in `src/features/`
- Shared components in `src/components/`
- Types in `src/types/`
- RLS is the security boundary

### Source of Truth Priority
1. `docs/leadengine-system-overview.md`
2. Latest migrations in `supabase/migrations/`
3. Implemented code in `src/`
4. TypeScript types in `src/types/`

Files in `reference/` are specs/proposals, not implemented features.

---

## Working with Built-in Agents

### Using Explore Agent
```
Delegate to Explore agent for:
- Mapping project structure
- Finding files across codebase
- Understanding architecture
- Tracing dependencies
```

### Using Plan Agent
```
Delegate to Plan agent for:
- Complex multi-step implementations
- Architecture decisions
- Breaking down large features
```

### Direct Tool Usage
For simple tasks, use tools directly:
- **Grep** - Search code patterns
- **Glob** - Find files by pattern
- **Read** - Read file contents
- **Edit** - Modify files
- **Bash** - Run commands

---

## Development Workflow

1. **Understand the task** - Read requirements carefully
2. **Explore if needed** - Use Explore agent for unfamiliar areas
3. **Plan complex work** - Use Plan agent for multi-step tasks
4. **Implement** - Write code following guidelines
5. **Test** - Verify functionality works
6. **Review** - Check quality and security
7. **Document** - Update docs if needed

---

## Common Patterns

### Creating a New Feature
1. Add types in `src/types/`
2. Create Server Actions in `src/app/actions/`
3. Build components in `src/features/[feature]/components/`
4. Create route page in `src/app/[route]/page.tsx`
5. Add migrations if schema changes needed

### Modifying Existing Feature
1. Find relevant files (use Explore if needed)
2. Read current implementation
3. Make minimal changes needed
4. Test in browser
5. Verify no regressions

### Debugging Issues
1. Check browser console for errors
2. Review Server Action responses
3. Check database queries and RLS
4. Verify TypeScript types
5. Test edge cases
