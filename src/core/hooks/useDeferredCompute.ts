import { useEffect, useRef, useState } from 'react';

/**
 * Deferred compute: recompute only delay ms after input stops, so large text does not block (tech design §8.2).
 * Computes once synchronously on mount so the first render has a value.
 */
export function useDeferredCompute<TInput, TOutput>(
  input: TInput,
  compute: (input: TInput) => TOutput,
  delay = 150,
): TOutput {
  const [output, setOutput] = useState<TOutput>(() => compute(input));
  // compute is usually inline; a ref keeps a new identity from triggering recompute
  const computeRef = useRef(compute);
  computeRef.current = compute;

  useEffect(() => {
    const timer = setTimeout(() => setOutput(computeRef.current(input)), delay);
    return () => clearTimeout(timer);
  }, [input, delay]);

  return output;
}
