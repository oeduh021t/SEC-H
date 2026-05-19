import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ user, onLogout }) => {
  // Estados de Controle de Menu
  const [menuEquipAberto, setMenuEquipAberto] = useState(false);
  const [menuRelatAberto, setMenuRelatAberto] = useState(false);
  const [modalConfigAberta, setModalConfigAberta] = useState(false);

  // Estados para troca de senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');

  const location = useLocation();
  const API_URL = 'http://192.168.5.101:3000/api';

  const isActive = (path) => location.pathname === path;
  
  // Verifica se o grupo está ativo para manter aberto visualmente
  const isEquipActive = location.pathname.includes('equipamentos') || location.pathname.includes('preventivas');
  const isRelatActive = location.pathname.includes('relatorios');

  const handleMudarSenha = async (e) => {
    e.preventDefault();

    if (novaSenha !== confirmaSenha) {
      alert("❌ As novas senhas não coincidem!");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/usuarios/alterar-senha`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          senhaAtual: senhaAtual,
          novaSenha: novaSenha
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert("✅ " + data.message);
        setModalConfigAberta(false);
        setSenhaAtual('');
        setNovaSenha('');
        setConfirmaSenha('');
      } else {
        alert("❌ " + (data.error || "Erro ao mudar senha"));
      }
    } catch (err) {
      alert("❌ Erro de conexão.");
    }
  };

  return (
    <>
      <div className="w-64 bg-slate-900 h-screen text-slate-300 p-4 flex flex-col shrink-0 border-r border-slate-800 fixed left-0 top-0 z-50">
        
        {/* LOGO */}
        <div className="mb-10 p-2 text-center shrink-0">
          <h2 className="text-2xl font-black text-white tracking-tighter italic">SEC-H</h2>
          <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.2em]">Engenharia Clínica</p>
        </div>

        {/* NAVEGAÇÃO PRINCIPAL */}
        <nav className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* DASHBOARD */}
          <Link to="/" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
            🏠 Dashboard
          </Link>

          {/* MENU EQUIPAMENTOS */}
          <div>
            <button
              onClick={() => setMenuEquipAberto(!menuEquipAberto)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all font-bold text-sm hover:bg-slate-800 ${isEquipActive ? 'text-blue-400' : ''}`}
            >
              <div className="flex items-center gap-3">🛠️ Equipamentos</div>
              <span className={`text-[10px] transition-transform duration-300 ${menuEquipAberto || isEquipActive ? 'rotate-180' : ''}`}>▼</span>
            </button>

            <div className={`ml-4 mt-2 space-y-1 overflow-hidden transition-all duration-300 ${menuEquipAberto || isEquipActive ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
              <Link to="/equipamentos" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/equipamentos') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive('/equipamentos') ? 'bg-blue-500' : 'bg-slate-600'}`}></span>
                Listar Ativos
              </Link>

              <Link to="/preventivas" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/preventivas') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive('/preventivas') ? 'bg-green-500' : 'bg-slate-600'}`}></span>
                Preventivas / PMOC
              </Link>

              <Link to="/equipamentos/novo" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/equipamentos/novo') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive('/equipamentos/novo') ? 'bg-amber-500' : 'bg-slate-600'}`}></span>
                Novo Cadastro
              </Link>
            </div>
          </div>

          {/* CHAMADOS */}
          <Link to="/chamados" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/chamados') ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/50' : 'hover:bg-slate-800'}`}>
            🎫 Chamados / OS
          </Link>

          {/* MENU RELATÓRIOS */}
          <div>
            <button
              onClick={() => setMenuRelatAberto(!menuRelatAberto)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all font-bold text-sm hover:bg-slate-800 ${isRelatActive ? 'text-blue-400' : ''}`}
            >
              <div className="flex items-center gap-3">📊 Relatórios</div>
              <span className={`text-[10px] transition-transform duration-300 ${menuRelatAberto || isRelatActive ? 'rotate-180' : ''}`}>▼</span>
            </button>

            <div className={`ml-4 mt-2 space-y-1 overflow-hidden transition-all duration-300 ${menuRelatAberto || isRelatActive ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
              <Link to="/relatorios/inventario" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/relatorios/inventario') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive('/relatorios/inventario') ? 'bg-blue-500' : 'bg-slate-600'}`}></span>
                Inventário Geral
              </Link>
            </div>
          </div>

          {/* USUÁRIOS (Admin) */}
          {user?.nivel === 'admin' && (
            <Link to="/usuarios" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/usuarios') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'hover:bg-slate-800'}`}>
              👥 Usuários
            </Link>
          )}
        </nav>

        {/* RODAPÉ DO OPERADOR */}
        <div className="mt-auto pt-6 shrink-0">
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800/50">
            <div className="text-center">
              <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Operador Logado</p>
              <p className="text-xs font-bold text-white truncate px-2">{user?.nome}</p>
              <span className="text-[8px] font-black bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded uppercase mt-1 inline-block border border-blue-500/20">{user?.nivel}</span>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-around items-center">
              <button
                onClick={() => setModalConfigAberta(true)}
                title="Configurações"
                className="text-slate-500 hover:text-blue-400 transition-colors text-lg hover:rotate-90 duration-500"
              >⚙️</button>
              <button onClick={onLogout} className="text-[10px] font-black text-red-400 hover:text-red-300 uppercase tracking-tighter transition-all">SAIR 🚀</button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIGURAÇÕES */}
      {modalConfigAberta && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-slate-800">
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-slate-800 p-5 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-sm">⚙️ Perfil e Segurança</h3>
              <button onClick={() => setModalConfigAberta(false)} className="text-xl hover:text-red-400">✕</button>
            </div>

            <form onSubmit={handleMudarSenha} className="p-8 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Senha Atual</label>
                <input
                  type="password"
                  className="w-full border-2 border-slate-100 p-2.5 rounded-xl outline-none focus:border-blue-400 font-bold"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-slate-50">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nova Senha</label>
                  <input
                    type="password"
                    className="w-full border-2 border-slate-100 p-2.5 rounded-xl outline-none focus:border-blue-400 font-bold"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    className="w-full border-2 border-slate-100 p-2.5 rounded-xl outline-none focus:border-blue-400 font-bold"
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 mt-2">
                <p className="text-[9px] text-amber-700 font-bold leading-tight uppercase">
                  ⚠️ Atenção: Você será desconectado após a alteração.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalConfigAberta(false)}
                  className="flex-1 bg-slate-100 text-slate-400 py-3 rounded-xl font-black text-xs uppercase"
                >Cancelar</button>
                <button
                  type="submit"
                  className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-sm uppercase shadow-lg shadow-blue-200 active:scale-95 transition-all"
                >Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
