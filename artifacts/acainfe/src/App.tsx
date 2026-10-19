import { Route, Switch, Router } from 'wouter';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient();
export default function App() {
  return <QueryClientProvider client={queryClient}><Router base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Switch>
    <Route path="/" component={Landing} />
    <Route path="/app" component={Onboarding} />
    <Route><main style={{ padding: 60 }}><h1>Essa página não está por aqui.</h1><a href="/">Voltar ao início</a></main></Route>
  </Switch></Router></QueryClientProvider>;
}
