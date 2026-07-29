import { AppRouter } from "./router/AppRouter";
import { ToastProvider } from "./context/ToastContext";
import { ToastStack } from "./components/shared/ToastStack";
import "./App.css";

function App() {
  return (
    <ToastProvider>
      <AppRouter />
      <ToastStack />
    </ToastProvider>
  );
}

export default App;