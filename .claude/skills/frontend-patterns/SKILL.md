---
name: frontend-patterns
description: React/Next.js frontend coding patterns for Receptify. Use when writing or modifying TypeScript frontend code — components, Next.js page views, styles, icons, and layout parameters.
effort: high
---

# Receptify Frontend Patterns

Use this skill when writing or modifying Next.js (App Router) TypeScript code. For naming decisions, use the `naming-conventions` skill.

## Technology Stack

- **Framework:** Next.js 15 App Router (using TypeScript `.tsx` and `.ts` files, never `.js` or `.jsx`).
- **Styling:** Tailwind CSS + Plus Jakarta Sans font. Premium glassmorphism UI with clean gradients and blue brand palette.
- **Validation:** Zod (for type-safe schema definitions and client/server validation, never Formik or Yup).
- **Icons:** Lucide React (`lucide-react`).
- **Charts:** Recharts (`recharts`).
- **Toasts:** Sonner (`sonner` via `toast(...)`).
- **Database (Server side in Next.js API routes):** TypeORM.

## Component Structure

- **App Router Routing:** Feature pages live in directories under `/src/app/(app)/` (e.g., `src/app/(app)/campaigns/page.tsx`, `src/app/(app)/calls/page.tsx`).
- **Next.js API Routes:** Serverless API endpoints live under `/src/app/api/` (e.g., `src/app/api/calls/route.ts`).
- **Reusable UI Components:** Extracted visual components live flat in `src/components/ui/` (e.g., `KpiCard.tsx`, `EmptyState.tsx`, `Sidebar.tsx`, `StatusBadge.tsx`).
- **All components are functional components.** Use standard React hooks.
- **State declarations at the top** of the component, in a block before any logic or side effects.

## State Management — When to Use What

| Type | Use for | Why |
|---|---|---|
| URL search params | Filter states, query strings, active tabs | Survives browser refresh and remains shareable (e.g., `?status=completed&outcome=no_answer`). |
| Local `useState` | Component-specific UI state | Loading spinners, modal open/close, multi-step wizards, current input value. |
| React Context | Session, user, and subscription status | Authenticated business owner profile (`ProfileContext` / auth handlers in `/src/lib/auth.ts`). |

- Do NOT propose or import complex state management libraries like Redux or React Query (they are not present in Receptify).
- Use local hooks (`useEffect`, `useState`) and standard Next.js routing patterns.

## Form Patterns & Validation with Zod

- Use **Zod** for schema validation. Define schemas clearly:
  ```typescript
  import { z } from 'zod';
  
  const campaignFormSchema = z.object({
    name: z.string().min(1, 'Campaign name is required'),
    purpose: z.string(),
    language: z.string().default('en'),
    voiceType: z.string(),
  });
  ```
- Trigger client-side validation on form submission and map Zod formatted issues to local state for display.

## Premium Glassmorphism UI & Styles

To maintain Receptify's high visual impact:
- **Card Backgrounds:** Use translucent gradients with high background blur and subtle borders:
  `bg-white/10 backdrop-blur-md border border-white/20 shadow-lg`
- **Text & Colors:** Utilize a blue brand palette, dark deep slate background shades, and clear text hierarchies using `clsx` and `tailwind-merge` (`cn` helper in `src/lib/utils.ts`).
- **Interactive States:** Apply smooth transitions (`transition-all duration-300`) on hover, focus, and click.

## Service & Fetch Layer

- Fetch data from Next.js serverless API routes using standard fetch requests:
  ```typescript
  const response = await fetch('/api/calls');
  const data = await response.json();
  ```
- Always parse and handle success or error cases gracefully.

## Toasts & Feedback in UI

- Standardized on **Sonner**:
  ```typescript
  import { toast } from 'sonner';
  
  toast.success('Campaign launched successfully');
  toast.error('Failed to validate phone number');
  ```
- Use loading states and disabled buttons while actions are in-flight.

IMPORTANT: Follow existing patterns exactly. Do not introduce new third-party dependencies unprompted. Use TypeScript strictly, maintaining type safety across components and schemas.
