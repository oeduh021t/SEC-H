import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ user, onLogout }) => {
  const [menuEquipAberto, setMenuEquipAberto] = useState(false);
  const location = useLocation();

  // Função para verificar se o link está ativo e aplicar o estilo
  const isActive = (path) => location.pathname === path;

  // Verifica se qualquer sub-rota de equipamentos está ativa para manter o menu destacado
  const isEquipActive = location.pathname.includes('equipamentos') || location.pathname.includes('preventivas');

  return (
    <div className="w-64 bg-slate-900 min-h-screen text-slate-300 p-4 flex flex-col shrink-0 border-r border-slate-800">
      {/* LOGO */}
      <div className="mb-10 p-2 text-center">
        <h2 className="text-2xl font-black text-white tracking-tighter italic">SEC-H</h2>
        <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.2em]">Engenharia Clínica</p>
      </div>

      <nav className="space-y-2 flex-1">
        {/* DASHBOARD */}
        <Link to="/" className={`flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm ${isActive('/') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
          <span className="text-lg">🏠</span> Dashboard
        </Link>

        {/* MENU EQUIPAMENTOS (DROPDOWN) */}
        <div>
          <button
            onClick={() => setMenuEquipAberto(!menuEquipAberto)}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all font-bold text-sm hover:bg-slate-800 ${isEquipActive ? 'text-blue-400' : ''}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🛠️</span> Equipamentos
            </div>
            <span className={`text-[10px] transition-transform duration-300 ${menuEquipAberto ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {/* SUBMENU */}
          <div className={`ml-4 mt-2 space-y-1 overflow-hidden transition-all duration-300 ${menuEquipAberto || isEquipActive ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
            <Link to="/equipamentos" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/equipamentos') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-blue-400'}`}>
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Listar Ativos
            </Link>

            <Link to="/preventivas" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/preventivas') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-green-400'}`}>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Preventivas / PMOC
            </Link>

            <Link to="/equipamentos/novo" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/equipamentos/novo') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-amber-400'}`}>
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              Novo Cadastro
            </Link>
          </div>
        </div>

        {/* CHAMADOS */}
        <Link to="/chamados" className={`flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm ${isActive('/chamados') ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/50' : 'hover:bg-slate-800'}`}>
          <span className="text-lg">🎫</span> Chamados / OS
        </Link>

        {/* GESTÃO DE USUÁRIOS - Visível apenas para Admin */}
        {user?.nivel === 'admin' && (
          <Link to="/usuarios" className={`flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm ${isActive('/usuarios') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'hover:bg-slate-800'}`}>
            <span className="text-lg">👥</span> Usuários
          </Link>
        )}
      </nav>

      {/* RODAPÉ DO SIDEBAR (PERFIL DINÂMICO) */}
      <div className="mt-auto p-4 bg-slate-800/40 rounded-2xl border border-slate-800/50">
        <div className="text-center">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Operador Logado</p>
            <p className="text-xs font-bold text-white truncate px-2">{user?.nome || 'Usuário'}</p>
            <span className="text-[8px] font-black bg-slate-700 text-slate-400 px-2 py-0.5 rounded uppercase mt-1 inline-block tracking-tighter">
                {user?.nivel || 'Nível'}
            </span>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-around items-center">
            <button title="Configurações" className="text-slate-500 hover:text-white transition-colors text-sm">⚙️</button>
            <button 
                onClick={onLogout}
                title="Sair do Sistema" 
                className="flex items-center gap-1 text-[10px] font-black text-red-900 hover:text-red-500 transition-all uppercase tracking-tighter"
            >
                SAIR 🚀
            </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
