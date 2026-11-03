import { Component, type ErrorInfo, type ReactNode } from 'react';
import { MaintenanceFallback } from './MaintenanceFallback';

interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FairShare application error:', error, errorInfo);
  }

  public render() {
    return this.state.hasError ? <MaintenanceFallback error={this.state.error} /> : this.props.children;
  }
}
