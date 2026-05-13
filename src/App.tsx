import { BrowserRouter, Routes, Route, useLocation, useParams } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import PublicFeed from "./pages/PublicFeed";
import Ranking from "./pages/Ranking";
import PoliticianProfile from "./pages/PoliticianProfile";
import PromiseDetail from "./pages/PromiseDetail";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import Metodologia from "./pages/Metodologia";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Fontes from "./pages/Fontes";
import Correcoes from "./pages/Correcoes";
import QuemSomos from "./pages/QuemSomos";
import ComoFunciona from "./pages/ComoFunciona";
import ComparePage from "./pages/Compare";
import ElectionPage from "./pages/ElectionPage";
import StatePage from "./pages/StatePage";
import Reportar from "./pages/Reportar";
import Mapa from "./pages/Mapa";
import Transparencia from "./pages/Transparencia";
import Auditoria from "./pages/Auditoria";

import SEO from "./components/SEO";

function HomePage() {
  return (
    <>
      <SEO 
        title="Promessômetro — Acompanhe as promessas dos políticos brasileiros"
        description="Rastreie e valide o cumprimento das promessas feitas por políticos durante suas campanhas e mandatos. Transparência política para o Brasil."
        path="/"
      />
      <Landing />
    </>
  );
}

function PromessasPage() {
  return (
    <>
      <SEO 
        title="Todas as Promessas — Promessômetro"
        description="Veja todas as promessas rastreadas de políticos brasileiros com status, evidências e score de cumprimento."
        path="/promessas"
      />
      <PublicFeed />
    </>
  );
}

function RankingPage() {
  return (
    <>
      <SEO 
        title="Ranking de Políticos — Promessômetro"
        description="Veja o ranking de políticos brasileiros baseado no cumprimento de suas promessas de campanha."
        path="/ranking"
      />
      <Ranking />
    </>
  );
}

// PoliticoPage: SEO dinâmico é gerenciado DENTRO do PoliticianProfile (com dados reais).
// Não renderizamos SEO aqui para evitar dupla renderização com dados genéricos.
function PoliticoPage() {
  return <PoliticianProfile />;
}

// PromessaPage: idem — SEO gerenciado dentro do PromiseDetail.
function PromessaPage() {
  return <PromiseDetail />;
}

function MetodologiaPage() {
  return (
    <>
      <SEO 
        title="Metodologia — Promessômetro"
        description="Entenda como avaliamos o cumprimento das promessas políticas."
        path="/metodologia"
      />
      <Metodologia />
    </>
  );
}

function PrivacidadePage() {
  return (
    <>
      <SEO 
        title="Política de Privacidade — Promessômetro"
        description="Conheça nossa política de privacidade e como protegemos seus dados."
        path="/privacidade"
      />
      <Privacy />
    </>
  );
}

function TermosPage() {
  return (
    <>
      <SEO 
        title="Termos de Uso — Promessômetro"
        description="Leia os termos de uso do Promessômetro."
        path="/termos"
      />
      <Terms />
    </>
  );
}

function FontesPage() {
  return (
    <>
      <SEO 
        title="Fontes — Promessômetro"
        description="Conheça as fontes de notícias e dados utilizadas pelo Promessômetro."
        path="/fontes"
      />
      <Fontes />
    </>
  );
}

function CorrecoesPage() {
  return (
    <>
      <SEO 
        title="Correções — Promessômetro"
        description="Solicite correções em nossas avaliações de promessas."
        path="/correcoes"
      />
      <Correcoes />
    </>
  );
}

function QuemSomosPage() {
  return (
    <>
      <SEO 
        title="Quem Somos — Promessômetro"
        description="Conheça o projeto Promessômetro e nossa missão de transparência política."
        path="/quem-somos"
      />
      <QuemSomos />
    </>
  );
}

function ComoFuncionaPage() {
  return (
    <>
      <SEO 
        title="Como Funciona — Promessômetro"
        description="Entenda como o Promessômetro funciona e como avaliamos as promessas políticas."
        path="/como-funciona"
      />
      <ComoFunciona />
    </>
  );
}

function NotFoundPage() {
  return (
    <>
      <SEO 
        title="Página Não Encontrada — Promessômetro"
        description="A página que você procura não foi encontrada."
        path="/404"
        noindex
      />
      <NotFound />
    </>
  );
}

function AppRoutes() {
  const location = useLocation();
  return (
    <Routes key={location.pathname}>
      <Route path="/" element={<ErrorBoundary context="Landing"><HomePage /></ErrorBoundary>} />
      <Route path="/promessas" element={<ErrorBoundary context="PublicFeed"><PromessasPage /></ErrorBoundary>} />
      <Route path="/ranking" element={<ErrorBoundary context="Ranking"><RankingPage /></ErrorBoundary>} />
      <Route path="/politico/:id" element={<ErrorBoundary context="PoliticianProfile"><PoliticoPage /></ErrorBoundary>} />
      <Route path="/promessa/:slug" element={<ErrorBoundary context="PromiseDetail"><PromessaPage /></ErrorBoundary>} />
      <Route path="/comparar/:names" element={<ErrorBoundary context="Compare"><ComparePage /></ErrorBoundary>} />
      <Route path="/eleicao/:year" element={<ErrorBoundary context="Election"><ElectionPage /></ErrorBoundary>} />
      <Route path="/estado/:uf" element={<ErrorBoundary context="State"><StatePage /></ErrorBoundary>} />
      <Route path="/metodologia" element={<ErrorBoundary context="Metodologia"><MetodologiaPage /></ErrorBoundary>} />
      <Route path="/privacidade" element={<ErrorBoundary context="Privacy"><PrivacidadePage /></ErrorBoundary>} />
      <Route path="/termos" element={<ErrorBoundary context="Terms"><TermosPage /></ErrorBoundary>} />
      <Route path="/fontes" element={<ErrorBoundary context="Fontes"><FontesPage /></ErrorBoundary>} />
      <Route path="/correcoes" element={<ErrorBoundary context="Correcoes"><CorrecoesPage /></ErrorBoundary>} />
      <Route path="/quem-somos" element={<ErrorBoundary context="QuemSomos"><QuemSomosPage /></ErrorBoundary>} />
      <Route path="/como-funciona" element={<ErrorBoundary context="ComoFunciona"><ComoFuncionaPage /></ErrorBoundary>} />
      {/* Rotas que existiam como links mas faltavam aqui */}
      <Route path="/reportar" element={<ErrorBoundary context="Reportar"><Reportar /></ErrorBoundary>} />
      <Route path="/mapa" element={<ErrorBoundary context="Mapa"><Mapa /></ErrorBoundary>} />
      <Route path="/transparencia" element={<ErrorBoundary context="Transparencia"><Transparencia /></ErrorBoundary>} />
      <Route path="/auditoria" element={<ErrorBoundary context="Auditoria"><Auditoria /></ErrorBoundary>} />
      
      <Route path="/404" element={<ErrorBoundary context="NotFound"><NotFoundPage /></ErrorBoundary>} />
      <Route path="*" element={<ErrorBoundary context="NotFound"><NotFoundPage /></ErrorBoundary>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <ErrorBoundary context="root">
          <AppRoutes />
        </ErrorBoundary>
      </Layout>
    </BrowserRouter>
  );
}