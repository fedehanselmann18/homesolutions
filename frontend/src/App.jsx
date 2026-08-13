import { AppRouter } from "./router/AppRouter";
import { ToastProvider } from "./context/ToastContext";
import { ToastStack } from "./components/shared/ToastStack";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import "./App.css";

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppRouter />
        <ToastStack />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
