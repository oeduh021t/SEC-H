import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';

// --- IMPORTAÇÃO DAS PÁGINAS ---
import Login from './pages/Login';
import Equipamentos from './pages/Equipamentos';
import Chamados from './pages/Chamados';
import Prontuario from './pages/Prontuario';
import NovoEquipamento from './pages/NovoEquipamento';
import Preventivas from './pages/Preventivas';
import Usuarios from './pages/Usuarios';
import Dashboard from './pages/Dashboard';
import InventarioGeral from './pages/InventarioGeral';
import { RelatorioCustosSetor } from './pages/RelatorioCustosSetor';
import { TratarChamado } from "./pages/TratarChamado";
import Fornecedores from './pages/Fornecedores'; 
import NotasFiscais from './pages/NotasFiscais'; 
import { ImprimirOS } from './pages/ImprimirOS'; 
import { GestaoEstoque } from './pages/GestaoEstoque'; 
import { GestaoSetores } from './pages/GestaoSetores';
import ControleFiltros from './pages/ControleFiltros';
import RelatorioFiltros from './pages/RelatorioFiltros';
import { RelatorioChamadosSetor } from './pages/RelatorioChamadosSetor';
import Documentos from './pages/Documentos'; 
import GestaoLocais from './pages/GestaoLocais';
import { RelatorioEstoqueLocal } from './pages/RelatorioEstoqueLocal';
import Gases from './pages/Gases';
import SolicitacaoCompras from './pages/SolicitacaoCompras';


// --- COMPONENTE DE PROTEÇÃO DE ROTA POR NÍVEL (RBAC) ---
function RotaProtegida({ children, user, niveisPermitidos }) {
  if (!user) return <Navigate to="/" />;
  
  const nivelLimpo = user.nivel?.toLowerCase().trim();
  if (!niveisPermitidos.includes(nivelLimpo)) {
    return <Navigate to="/" />;
  }
  return children;
}

function PrivateRoute({ children, user }) {
  return user ? children : <Navigate to="/" />;
}

// --- COMPONENTE PRINCIPAL ---
function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Estado global do menu para ajustar a margem do conteúdo dinamicamente
  const [sidebarAberta, setSidebarAberta] = useState(true);

  // INTERCEPTOR GLOBAL DE FETCH
  useEffect(() => {
    if (!user) return;

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      let [resource, config] = args;
      
      if (!config) config = {};
      if (!config.headers) config.headers = {};

      config.headers['x-usuario-nivel'] = user.nivel || '';

      return originalFetch(resource, config);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-100 flex overflow-x-hidden">
        {/* Passamos o estado e função de toggle para a Sidebar */}
        <Sidebar 
          user={user} 
          onLogout={handleLogout} 
          sidebarAberta={sidebarAberta} 
          setSidebarAberta={setSidebarAberta} 
        />

        {/* ÁREA PRINCIPAL: Ajusta a margem esquerda (ml) de acordo com o estado da Sidebar */}
        <main className={`flex-1 p-4 md:p-6 transition-all duration-300 ease-in-out min-w-0 overflow-y-auto print:overflow-visible print:p-0 print:m-0 ${sidebarAberta ? 'md:ml-64' : 'md:ml-16'}`}>
          <div className="w-full max-w-[1600px] mx-auto">
            <Routes>
              {/* --- 1. DASHBOARD --- */}
              <Route 
                path="/" 
                element={
                  user.nivel !== 'usuario' ? <Dashboard user={user} /> : <Navigate to="/chamados" />
                } 
              />

              {/* --- 2. MÓDULO EQUIPAMENTOS & PREVENTIVAS --- */}
              <Route path="/equipamentos" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}><Equipamentos /></RotaProtegida>} />
              <Route path="/prontuario/:id" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}><Prontuario /></RotaProtegida>} />
              <Route path="/preventivas" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}><Preventivas /></RotaProtegida>} />
              <Route path="/equipamentos/novo" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><NovoEquipamento /></RotaProtegida>} />

              {/* --- 3. MÓDULO CHAMADOS / OS --- */}
              <Route path="/chamados" element={<Chamados user={user} />} />
              <Route path="/chamados/:id/imprimir" element={<PrivateRoute user={user}><ImprimirOS /></PrivateRoute>} />
              <Route
                path="/chamados/:id/tratar"
                element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}><TratarChamado /></RotaProtegida>}
              />

              {/* --- REPOSITÓRIO DE DOCUMENTOS AUDITÁVEIS --- */}
              <Route 
                path="/documentos" 
                element={
                  <RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}>
                    <Documentos />
                  </RotaProtegida>
                } 
              />

              {/* --- 4. LOGÍSTICA / INFRAESTRUTURA / SUPRIMENTOS --- */}
              <Route path="/solicitacoes-compra" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}><SolicitacaoCompras /></RotaProtegida>} />
              <Route path="/fornecedores" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><Fornecedores /></RotaProtegida>} />
              <Route path="/notas-fiscais" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><NotasFiscais /></RotaProtegida>} />
              <Route path="/estoque" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><GestaoEstoque /></RotaProtegida>} />
              <Route path="/setores" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><GestaoSetores /></RotaProtegida>} />
              <Route path="/locais-estoque" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><GestaoLocais /></RotaProtegida>} />

              {/* --- 5. MÓDULO FILTROS DE ÁGUA --- */}
              <Route path="/filtros" element={<RotaProtegida user={user} niveisPermitidos={['admin']}><ControleFiltros /></RotaProtegida>} />
              <Route path="/relatorio-filtros" element={<RotaProtegida user={user} niveisPermitidos={['admin']}><RelatorioFiltros /></RotaProtegida>} />

              {/* --- 🧪 6. MÓDULO CONTROLE DE GASES MEDICINAIS --- */}
              <Route path="/gases" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}><Gases /></RotaProtegida>} />

              {/* --- 7. RELATÓRIOS GERENCIAIS --- */}
              <Route path="/relatorios/inventario" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><InventarioGeral /></RotaProtegida>} />
              <Route path="/relatorios/custos-setor" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><RelatorioCustosSetor /></RotaProtegida>} />
              <Route path="/relatorios/chamados-setor" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><RelatorioChamadosSetor /></RotaProtegida>} />
              <Route path="/relatorios/estoque-local" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><RelatorioEstoqueLocal /></RotaProtegida>} /> 

              {/* --- 8. GERENCIAMENTO DE USUÁRIOS --- */}
              <Route path="/usuarios" element={<RotaProtegida user={user} niveisPermitidos={['admin']}><Usuarios /></RotaProtegida>} />

              {/* Fallback */}
              <Route path="*" element={<div className="p-10 text-center text-slate-400 font-bold">Página não encontrada...</div>} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;