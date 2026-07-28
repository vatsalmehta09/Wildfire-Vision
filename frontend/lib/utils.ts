import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind CSS class names, resolving conflicts with `tailwind-merge`
 * and handling conditional/array inputs with `clsx`.
 *
 * This is the canonical utility for combining class strings throughout the
 * application — it ensures that later Tailwind classes correctly override
 * earlier conflicting ones (e.g. `p-4` wins over `p-2` when both are present).
 *
 * @param inputs - One or more class values accepted by `clsx`: strings,
 *   arrays, objects with boolean values, `undefined`, or `null`.
 * @returns A single merged, conflict-resolved class name string.
 *
 * @example
 * ```typescript
 * cn('px-2 py-1', 'px-4')          // → 'py-1 px-4'
 * cn('text-red-500', isError && 'text-red-700') // → 'text-red-700' when isError
 * cn({ 'opacity-50': disabled })    // → 'opacity-50' when disabled is true
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
