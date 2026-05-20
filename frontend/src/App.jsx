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
import { TratarChamado } from "./pages/TratarChamado";
import Fornecedores from './pages/Fornecedores'; // ADICIONADO
import { ImprimirOS } from './pages/ImprimirOS'; // ADICIONADO

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

        <main className="flex-1 p-8 overflow-y-auto">
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

              {/* Relatórios */}
              <Route path="/relatorios/inventario" element={<InventarioGeral />} />

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
