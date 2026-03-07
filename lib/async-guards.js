/**
 * lib/async-guards.js
 * Tiny utilities to prevent infinite fetch loops in React effects.
 */

/**
 * Returns a debounced version of fn that delays invocation by `ms` milliseconds.
 * Cancels any pending call when called again before the timer fires.
 */
export function debounce(fn, ms) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Returns true when JSON.stringify(obj) differs from ref.current, and
 * mutates ref.current to the new key.  Returns false (no-op) when the
 * serialised value is unchanged — use this as a guard before expensive
 * fetches that depend on an object or array parameter.
 *
 * Usage:
 *   const keyRef = useRef('');
 *   useEffect(() => {
 *     if (!changedKey(keyRef, { bbox, categories })) return;
 *     // safe to fetch — params really changed
 *   }, [bbox, categories]);
 */
export function changedKey(ref, obj) {
  const key = JSON.stringify(obj);
  if (key === ref.current) return false;
  ref.current = key;
  return true;
}
