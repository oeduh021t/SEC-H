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
import NotasFiscais from './pages/NotasFiscais'; // 🧾 Lançamento de Notas Fiscais e Boletos
import { ImprimirOS } from './pages/ImprimirOS'; 
import { GestaoEstoque } from './pages/GestaoEstoque'; 
import { GestaoSetores } from './pages/GestaoSetores';
import ControleFiltros from './pages/ControleFiltros';
import RelatorioFiltros from './pages/RelatorioFiltros';
import { RelatorioChamadosSetor } from './pages/RelatorioChamadosSetor';
import Documentos from './pages/Documentos'; // 📄 Ajustado para o nome padrão do seu componente de página

// --- COMPONENTE DE PROTEÇÃO DE ROTA POR NÍVEL (RBAC) ---
function RotaProtegida({ children, user, niveisPermitidos }) {
  if (!user) return <Navigate to="/" />;
  
  const nivelLimpo = user.nivel?.toLowerCase().trim();
  if (!niveisPermitidos.includes(nivelLimpo)) {
    // Se o usuário tentar forçar a barra digitando a URL direta, joga de volta pro Dashboard
    return <Navigate to="/" />;
  }
  return children;
}

function PrivateRoute({ children, user }) {
  return user ? children : <Navigate to="/" />;
}

// --- COMPONENTE PRINCIPAL ---
function App() {
  // Busca o usuário salvo no navegador (localStorage)
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // INTERCEPTOR GLOBAL DE FETCH (Garante injetar x-usuario-nivel em todas as requisições automágico)
  useEffect(() => {
    if (!user) return;

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      let [resource, config] = args;
      
      // Se não houver configuração de objeto na requisição, inicializa uma
      if (!config) config = {};
      if (!config.headers) config.headers = {};

      // Injeta dinamicamente o nível do operador do localStorage no cabeçalho
      config.headers['x-usuario-nivel'] = user.nivel || '';

      return originalFetch(resource, config);
    };

    // Função de limpeza caso o usuário deslogue
    return () => {
      window.fetch = originalFetch;
    };
  }, [user]);

  // Função para sair do system
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  // Se não houver usuário logado, mostra apenas a tela de Login
  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Router>
      shadow-slate-900
      <div className="flex min-h-screen bg-gray-100">
        {/* Passamos o usuário e a função de logout para a Sidebar */}
        <Sidebar user={user} onLogout={handleLogout} />

        <main className="flex-1 p-8 overflow-y-auto print:overflow-visible print:p-0 print:m-0">
          <div className="max-w-7xl mx-auto">
            <Routes>
              {/* --- 1. DASHBOARD --- */}
              {/* Permitido apenas para quem gerencia ou atende (admin, coordenador, tecnico) */}
              <Route 
                path="/" 
                element={
                  user.nivel !== 'usuario' ? <Dashboard user={user} /> : <Navigate to="/chamados" />
                } 
              />

              {/* --- 2. MÓDULO EQUIPAMENTOS & PREVENTIVAS --- */}
              {/* Listagem e Prontuários liberados para Gestores e Técnicos */}
              <Route path="/equipamentos" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}><Equipamentos /></RotaProtegida>} />
              <Route path="/prontuario/:id" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}><Prontuario /></RotaProtegida>} />
              <Route path="/preventivas" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}><Preventivas /></RotaProtegida>} />
              
              {/* Cadastro de Novos Equipamentos restrito apenas para ADMIN e COORDENADOR */}
              <Route path="/equipamentos/novo" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><NovoEquipamento /></RotaProtegida>} />

              {/* --- 3. MÓDULO CHAMADOS / OS --- */}
              {/* Listagem e Abertura: Liberado para TODOS os níveis do hospital */}
              <Route path="/chamados" element={<Chamados user={user} />} />
              <Route path="/chamados/:id/imprimir" element={<PrivateRoute user={user}><ImprimirOS /></PrivateRoute>} />
              
              {/* Tratar Chamado: Restrito para ADMIN, COORDENADOR e TECNICO (O Solicitante/usuario não mexe) */}
              <Route
                path="/chamados/:id/tratar"
                element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}><TratarChamado /></RotaProtegida>}
              />

              {/* --- 🆕 NOVO MÓDULO: REPOSITÓRIO DE DOCUMENTOS AUDITÁVEIS --- */}
              <Route 
                path="/documentos" 
                element={
                  <RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador', 'tecnico']}>
                    <Documentos />
                  </RotaProtegida>
                } 
              />

              {/* --- 4. LOGÍSTICA / INFRAESTRUTURA --- */}
              {/* Fornecedores, Estoque e Setores: Apenas ADMIN e COORDENADOR acessam */}
              <Route path="/fornecedores" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><Fornecedores /></RotaProtegida>} />
              <Route path="/notas-fiscais" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><NotasFiscais /></RotaProtegida>} />
              <Route path="/estoque" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><GestaoEstoque /></RotaProtegida>} />
              <Route path="/setores" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><GestaoSetores /></RotaProtegida>} />

              {/* --- 5. MÓDULO FILTROS DE ÁGUA --- */}
              {/* Controle e Relatório Financeiro de Filtros: Exclusivo ADMIN */}
              <Route path="/filtros" element={<RotaProtegida user={user} niveisPermitidos={['admin']}><ControleFiltros /></RotaProtegida>} />
              <Route path="/relatorio-filtros" element={<RotaProtegida user={user} niveisPermitidos={['admin']}><RelatorioFiltros /></RotaProtegida>} />

              {/* --- 6. RELATÓRIOS GERENCIAIS --- */}
              {/* Inventário e Custos por Setor: Apenas ADMIN e COORDENADOR acessam */}
              <Route path="/relatorios/inventario" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><InventarioGeral /></RotaProtegida>} />
              <Route path="/relatorios/custos-setor" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><RelatorioCustosSetor /></RotaProtegida>} />
              <Route path="/relatorios/chamados-setor" element={<RotaProtegida user={user} niveisPermitidos={['admin', 'coordenador']}><RelatorioChamadosSetor /></RotaProtegida>} />

              {/* --- 7. GERENCIAMENTO DE USUÁRIOS --- */}
              {/* Criação e edição de operadores: Exclusivo ADMIN */}
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