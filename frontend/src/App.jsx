import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Equipamentos from './pages/Equipamentos';
import Chamados from './pages/Chamados'; // 1. Importe a nova página

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-100">
        {/* Lado Esquerdo: Sidebar fixa */}
        <Sidebar />

        {/* Lado Direito: Conteúdo que muda */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto"> {/* Container para centralizar e não esticar demais em telas grandes */}
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/equipamentos" element={<Equipamentos />} />
              
              {/* 2. Adicione a rota dos Chamados */}
              <Route path="/chamados" element={<Chamados />} />
              
              <Route path="*" element={<div className="p-10 text-center">Página em desenvolvimento...</div>} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

// Componente de Dashboard (Você pode futuramente colocar os cards de resumo aqui)
import { Link } from 'react-router-dom'; // Certifique-se de que o Link está importado

const Dashboard = () => (
  <div>
    <h1 className="text-2xl font-bold text-gray-800">Bem-vindo ao SEC-H</h1>
    <p className="text-gray-600 mb-8">Eduardo, selecione um módulo no menu ao lado ou nos atalhos abaixo.</p>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/equipamentos" className="bg-white p-8 rounded-2xl shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-all group">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Equipamentos</h3>
            <p className="text-2xl font-bold text-gray-700 group-hover:text-blue-600 transition-colors">Acessar Inventário</p>
        </Link>
        
        <Link to="/chamados" className="bg-white p-8 rounded-2xl shadow-sm border-l-4 border-amber-500 hover:shadow-md transition-all group">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Chamados</h3>
            <p className="text-2xl font-bold text-gray-700 group-hover:text-amber-600 transition-colors">Ver Ordens de Serviço</p>
        </Link>
    </div>
  </div>
);
export default App;
