import { useEffect, useRef, useState } from 'react';

/**
 * 延迟计算：输入停止 delay 毫秒后才执行重计算，避免大文本输入时阻塞（技术设计 §8.2）。
 * 首次挂载时同步计算一次，保证初始渲染有值。
 */
export function useDeferredCompute<TInput, TOutput>(
  input: TInput,
  compute: (input: TInput) => TOutput,
  delay = 150,
): TOutput {
  const [output, setOutput] = useState<TOutput>(() => compute(input));
  // compute 多为内联函数，用 ref 避免其身份变化触发重算
  const computeRef = useRef(compute);
  computeRef.current = compute;

  useEffect(() => {
    const timer = setTimeout(() => setOutput(computeRef.current(input)), delay);
    return () => clearTimeout(timer);
  }, [input, delay]);

  return output;
}
