import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// --- IMPORTAÇÃO DAS PÁGINAS ---
import Login from './pages/Login';
import Equipamentos from './pages/Equipamentos';
import { TiposEquipamentos } from './pages/TiposEquipamentos';
import Chamados from './pages/Chamados';
import PainelChamados from './pages/PainelChamados';
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
import ProntuarioSetor from './pages/ProntuarioSetor';
import ControleEpi from './pages/ControleEpi';
import ManutencaoPlanejada from './pages/ManutencaoPlanejada';

function AppRoutes() {
  const { user, permissions } = useAuth();
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
      config.headers['x-usuario-id'] = user.id || '';

      return originalFetch(resource, config);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  if (!user) {
    return <Login onLogin={() => window.location.reload()} />;
  }

  const podeVerDashboard = permissions.canViewExecutiveDashboard;

  return (
    <Routes>
      {/* 📺 MONITORAMENTO / PAINEL TV */}
      <Route 
        path="/painel-chamados" 
        element={
          <ProtectedRoute allowedRoles={['admin', 'coordenador']}>
            <PainelChamados />
          </ProtectedRoute>
        } 
      />

      {/* 🏢 LAYOUT COM SIDEBAR */}
      <Route
        path="/*"
        element={
          <div className="min-h-screen bg-slate-50 flex overflow-x-hidden w-full">
            <Sidebar 
              user={user} 
              onLogout={handleLogout} 
              sidebarAberta={sidebarAberta} 
              setSidebarAberta={setSidebarAberta} 
            />

            <main 
              className={`flex-1 p-3 sm:p-4 md:p-6 transition-all duration-300 ease-in-out min-w-0 w-full overflow-x-hidden print:overflow-visible print:p-0 print:m-0 ${
                sidebarAberta ? 'ml-0 lg:ml-64' : 'ml-0 lg:ml-16'
              }`}
            >
              <div className="w-full max-w-[1600px] mx-auto overflow-x-hidden">
                <Routes>
                  {/* 1. DASHBOARD (Apenas Admin e Coordenador. Técnico/Solicitante vão para /chamados) */}
                  <Route 
                    path="/" 
                    element={
                      podeVerDashboard 
                        ? <Dashboard user={user} /> 
                        : <Navigate to="/chamados" replace />
                    } 
                  />

                  {/* 2. EQUIPAMENTOS & PREVENTIVAS */}
                  <Route path="/equipamentos" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><Equipamentos /></ProtectedRoute>} />
                  <Route path="/tipos-equipamentos" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><TiposEquipamentos /></ProtectedRoute>} />
                  <Route path="/preventivas" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><Preventivas /></ProtectedRoute>} />
                  <Route path="/equipamentos/novo" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><NovoEquipamento /></ProtectedRoute>} />
                  
                  {/* 🔍 PRONTUÁRIO: Técnico mantém acesso para leitura do ativo/QR */}
                  <Route path="/prontuario/:id" element={<ProtectedRoute allowedRoles={['admin', 'coordenador', 'tecnico']}><Prontuario /></ProtectedRoute>} />

                  {/* 3. CHAMADOS / OS */}
                  <Route path="/chamados" element={<ProtectedRoute><Chamados user={user} /></ProtectedRoute>} />
                  <Route path="/chamados/:id/imprimir" element={<ProtectedRoute><ImprimirOS /></ProtectedRoute>} />
                  <Route path="/chamados/:id/tratar" element={<ProtectedRoute allowedRoles={['admin', 'coordenador', 'tecnico']}><TratarChamado /></ProtectedRoute>} />

                  {/* 4. MANUTENÇÃO PLANEJADA & JANELAS */}
                  <Route path="/manutencoes-planejadas" element={<ProtectedRoute allowedRoles={['admin', 'coordenador', 'tecnico']}><ManutencaoPlanejada user={user} /></ProtectedRoute>} />

                  {/* 5. DOCUMENTOS AUDITÁVEIS */}
                  <Route path="/documentos" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><Documentos /></ProtectedRoute>} />

                  {/* 6. LOGÍSTICA & ALMOXARIFADO (Bloqueado para Técnico) */}
                  <Route path="/solicitacoes-compra" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><SolicitacaoCompras /></ProtectedRoute>} />
                  <Route path="/fornecedores" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><Fornecedores /></ProtectedRoute>} />
                  <Route path="/notas-fiscais" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><NotasFiscais /></ProtectedRoute>} />
                  <Route path="/estoque" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><GestaoEstoque /></ProtectedRoute>} />
                  <Route path="/setores" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><GestaoSetores /></ProtectedRoute>} />
                  <Route path="/setores/:id/prontuario" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><ProntuarioSetor /></ProtectedRoute>} />
                  <Route path="/locais-estoque" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><GestaoLocais /></ProtectedRoute>} />

                  {/* 7. UTILIDADES & SST / GASES (Bloqueado para Técnico) */}
                  <Route path="/controle-epi" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><ControleEpi /></ProtectedRoute>} />
                  <Route path="/filtros" element={<ProtectedRoute allowedRoles={['admin']}><ControleFiltros /></ProtectedRoute>} />
                  <Route path="/relatorio-filtros" element={<ProtectedRoute allowedRoles={['admin']}><RelatorioFiltros /></ProtectedRoute>} />
                  <Route path="/gases" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><Gases /></ProtectedRoute>} />

                  {/* 8. RELATÓRIOS GERENCIAIS (Bloqueado para Técnico) */}
                  <Route path="/relatorios/inventario" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><InventarioGeral /></ProtectedRoute>} />
                  <Route path="/relatorios/custos-setor" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><RelatorioCustosSetor /></ProtectedRoute>} />
                  <Route path="/relatorios/chamados-setor" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><RelatorioChamadosSetor /></ProtectedRoute>} />
                  <Route path="/relatorios/estoque-local" element={<ProtectedRoute allowedRoles={['admin', 'coordenador']}><RelatorioEstoqueLocal /></ProtectedRoute>} />

                  {/* 9. GERENCIAMENTO DE USUÁRIOS (Exclusivo Admin) */}
                  <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><Usuarios /></ProtectedRoute>} />

                  {/* FALLBACK REDIRECIONA PARA CHAMADOS */}
                  <Route path="*" element={<Navigate to="/chamados" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}