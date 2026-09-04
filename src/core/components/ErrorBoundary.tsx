import { Component, type ErrorInfo, type ReactNode } from 'react';
import { i18n } from '@/core/i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** 工具级错误边界（技术设计 §7.1）：工具内部异常不扩散到应用外壳 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ToolPage] 工具运行出错', error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm dark:border-red-900 dark:bg-red-950"
        >
          <p className="font-medium text-red-700 dark:text-red-300">{i18n.t('tool.errorTitle')}</p>
          <p className="mt-1 break-all text-red-600/80 dark:text-red-400/80">{error.message}</p>
          <button
            type="button"
            onClick={this.retry}
            className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900"
          >
            {i18n.t('common.retry')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
