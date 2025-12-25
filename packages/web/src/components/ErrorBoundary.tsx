import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, WifiOff, Bug } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: Array<string | number>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary component that catches React component errors
 * and displays a user-friendly error UI with recovery options.
 *
 * Features:
 * - Catches rendering errors in child components
 * - Displays user-friendly error messages
 * - Provides retry functionality
 * - Logs errors for debugging
 * - Maintains app state when possible
 * - Styled to match the dark theme (slate-900, blue accents)
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState;
  
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state if resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const prevKeys = prevProps.resetKeys || [];
      const currentKeys = this.props.resetKeys || [];

      if (prevKeys.length !== currentKeys.length ||
          prevKeys.some((key, index) => key !== currentKeys[index])) {
        this.handleReset();
      }
    }
  }

  handleReset = () => {
    // Call custom reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  getErrorMessage = (error: Error | null): { title: string; message: string; icon: ReactNode } => {
    if (!error) {
      return {
        title: 'Something went wrong',
        message: 'An unexpected error occurred. Please try again.',
        icon: <AlertTriangle className="w-16 h-16 text-red-400 mb-4" />,
      };
    }

    const errorMessage = error.message.toLowerCase();

    // Network errors
    if (errorMessage.includes('failed to fetch') ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection')) {
      return {
        title: 'Connection Error',
        message: 'Unable to connect to the service. Please check your internet connection and try again.',
        icon: <WifiOff className="w-16 h-16 text-red-400 mb-4" />,
      };
    }

    // Rate limiting errors
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return {
        title: 'Too Many Requests',
        message: 'We\'re receiving too many requests right now. Please wait a moment and try again.',
        icon: <AlertTriangle className="w-16 h-16 text-orange-400 mb-4" />,
      };
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return {
        title: 'Request Timeout',
        message: 'The request took too long to complete. The service might be slow. Please try again.',
        icon: <AlertTriangle className="w-16 h-16 text-yellow-400 mb-4" />,
      };
    }

    // Data/API errors
    if (errorMessage.includes('json') ||
        errorMessage.includes('parse') ||
        errorMessage.includes('invalid data')) {
      return {
        title: 'Data Error',
        message: 'We received invalid data from the service. Our team has been notified. Please try again later.',
        icon: <Bug className="w-16 h-16 text-purple-400 mb-4" />,
      };
    }

    // Component/Rendering errors
    if (errorMessage.includes('undefined') ||
        errorMessage.includes('null') ||
        errorMessage.includes('cannot read property')) {
      return {
        title: 'Display Error',
        message: 'We encountered an issue displaying this content. Please try refreshing or return to the dashboard.',
        icon: <AlertTriangle className="w-16 h-16 text-red-400 mb-4" />,
      };
    }

    // Default error
    return {
      title: 'Unexpected Error',
      message: error.message || 'Something went wrong. Please try again or return to the dashboard.',
      icon: <AlertTriangle className="w-16 h-16 text-red-400 mb-4" />,
    };
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback component if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      // Default error UI
      const { title, message, icon } = this.getErrorMessage(this.state.error);

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-slate-900 rounded-lg mx-4 my-8">
          {icon}

          <h2 className="text-2xl font-bold text-slate-100 mb-2 text-center">
            {title}
          </h2>

          <p className="text-slate-400 text-center mb-6 max-w-md">
            {message}
          </p>

          {/* Error details in development mode */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-6 w-full max-w-2xl">
              <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-400 mb-2">
                Error Details (Development Only)
              </summary>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-700 overflow-auto max-h-60">
                <pre className="text-xs text-red-300 whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            </details>
          )}

          <div className="flex gap-4 flex-wrap justify-center">
            <button
              onClick={this.handleReset}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-lg hover:shadow-xl"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>

            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors shadow-lg hover:shadow-xl"
            >
              Reload Page
            </button>

            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors shadow-lg hover:shadow-xl"
            >
              <Home className="w-4 h-4" />
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lightweight error boundary for inline use
 * Shows a more compact error UI suitable for smaller components
 */
export class InlineErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState;
  
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('InlineErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      return (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-200 text-sm font-medium mb-1">
              Something went wrong
            </p>
            <p className="text-red-300/80 text-xs mb-2">
              {this.state.error?.message || 'An error occurred while loading this component.'}
            </p>
            <button
              onClick={this.handleReset}
              className="text-xs text-red-300 hover:text-red-100 underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to reset error boundaries
export const useErrorBoundary = () => {
  const [, setError] = React.useState();

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
};
