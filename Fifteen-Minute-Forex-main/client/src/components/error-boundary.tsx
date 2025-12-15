import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="glass-panel border-rose-500/30 m-4" data-testid="error-boundary">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-rose-400 mb-2">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">
              A component encountered an error. Please try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="border-rose-500/30 text-rose-400"
              data-testid="button-retry"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
