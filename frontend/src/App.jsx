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
import Dashboard from './pages/Dashboard';

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
