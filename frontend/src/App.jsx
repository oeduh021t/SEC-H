import { useState } from 'react';
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
import Fornecedores from './pages/Fornecedores'; // ADICIONADO
import { ImprimirOS } from './pages/ImprimirOS'; // ADICIONADO
import { GestaoEstoque } from './pages/GestaoEstoque'; // ADICIONADO CIRURGICAMENTE
import { GestaoSetores } from './pages/GestaoSetores';
import ControleFiltros from './pages/ControleFiltros';
import RelatorioFiltros from './pages/RelatorioFiltros';

// --- COMPONENTE DE PROTEÇÃO DE ROTA ---
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

  // Função para sair do sistema
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
      <div className="flex min-h-screen bg-gray-100">
        {/* Passamos o usuário e a função de logout para a Sidebar */}
        <Sidebar user={user} onLogout={handleLogout} />

        {/* ALTERAÇÃO CIRÚRGICA: Inseridas as classes 'print:overflow-visible print:p-0 print:m-0' para que o container libere as páginas no papel sem restrições de rolagem */}
        <main className="flex-1 p-8 overflow-y-auto print:overflow-visible print:p-0 print:m-0">
          <div className="max-w-7xl mx-auto">
            <Routes>
              {/* Home / Dashboard */}
              <Route path="/" element={<Dashboard user={user} />} />

              {/* Módulo Equipamentos */}
              <Route path="/equipamentos" element={<Equipamentos />} />
              <Route path="/equipamentos/novo" element={<NovoEquipamento />} />
              <Route path="/prontuario/:id" element={<Prontuario />} />

              {/* Módulo Preventivas */}
              <Route path="/preventivas" element={<Preventivas />} />

              {/* Módulo Chamados / Atendimentos */}
              <Route path="/chamados" element={<Chamados user={user} />} />
              <Route
                path="/chamados/:id/tratar"
                element={<PrivateRoute user={user}><TratarChamado /></PrivateRoute>}
              />
              
              {/* ROTA DA FOLHA DE ASSINATURA CANVAS DA OS (ADICIONADA) */}
              <Route
                path="/chamados/:id/imprimir"
                element={<PrivateRoute user={user}><ImprimirOS /></PrivateRoute>}
              />

              {/* Módulo Fornecedores (ADICIONADO) */}
              <Route 
                path="/fornecedores" 
                element={<PrivateRoute user={user}><Fornecedores /></PrivateRoute>} 
              />

              {/* Módulo Estoque e Peças (ADICIONADO CIRURGICAMENTE) */}
              <Route 
                path="/estoque" 
                element={<PrivateRoute user={user}><GestaoEstoque /></PrivateRoute>} 
              />
               
               {/* Módulo Setores (ADICIONADO CIRURGICAMENTE) */}
              <Route 
                path="/setores" 
                element={<PrivateRoute user={user}><GestaoSetores /></PrivateRoute>} 
              />

              <Route path="/setores" element={<GestaoSetores />} /> {/* Cadastro de setores que já fizemos */}
              <Route path="/filtros" element={<ControleFiltros />} /> {/* Módulo de Filtros Adicionado */}

              {/* Relatórios */}
              <Route path="/relatorios/inventario" element={<InventarioGeral />} />
              <Route path="/relatorios/custos-setor" element={<PrivateRoute user={user}><RelatorioCustosSetor /></PrivateRoute>} />  
              
              <Route path="/relatorio-filtros" element={<RelatorioFiltros />} />


              {/* Módulo Usuarios - PROTEÇÃO: Só Admin entra */}
              <Route
                path="/usuarios"
                element={user.nivel === 'admin' ? <Usuarios /> : <Navigate to="/" />}
              />

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