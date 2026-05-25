import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100 p-6">
          <div className="max-w-md w-full bg-gray-900 border border-red-700/50 rounded-lg p-6">
            <h1 className="text-xl font-semibold mb-2">Something broke</h1>
            <p className="text-sm text-gray-300 mb-4">{this.state.error.message || String(this.state.error)}</p>
            <button onClick={() => this.setState({ error: null })} className="btn-primary text-sm">Try again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
