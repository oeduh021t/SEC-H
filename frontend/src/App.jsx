import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';

// --- IMPORTAÇÃO DAS PÁGINAS ---
import Login from './pages/Login';
import Equipamentos from './pages/Equipamentos';
import Chamados from './pages/Chamados';
import Prontuario from './pages/Prontuario';
import NovoEquipamento from './pages/NovoEquipamento';
import Preventivas from './pages/Preventivas';
import Usuarios from './pages/Usuarios';

// --- COMPONENTE DASHBOARD ---
const Dashboard = ({ user }) => (
  <div>
    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
        Bem-vindo, {user?.nome?.split(' ')[0] || 'Usuário'}!
    </h1>
    <p className="text-gray-600 mb-8">Selecione um módulo no menu ao lado ou nos atalhos abaixo.</p>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/equipamentos" className="bg-white p-8 rounded-2xl shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-all group">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Equipamentos</h3>
            <p className="text-2xl font-bold text-gray-700 group-hover:text-blue-600 transition-colors">Inventário</p>
        </Link>

        <Link to="/preventivas" className="bg-white p-8 rounded-2xl shadow-sm border-l-4 border-green-500 hover:shadow-md transition-all group">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Manutenção</h3>
            <p className="text-2xl font-bold text-gray-700 group-hover:text-green-600 transition-colors">Preventivas</p>
        </Link>

        <Link to="/chamados" className="bg-white p-8 rounded-2xl shadow-sm border-l-4 border-amber-500 hover:shadow-md transition-all group">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Chamados</h3>
            <p className="text-2xl font-bold text-gray-700 group-hover:text-amber-600 transition-colors">Ordens de Serviço</p>
        </Link>
    </div>
  </div>
);

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

              {/* Módulo Chamados */}
              <Route path="/chamados" element={<Chamados />} />

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
