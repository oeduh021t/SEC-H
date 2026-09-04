import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiChevronLeft, FiChevronDown } from 'react-icons/fi';

const Sidebar = ({ user, onLogout, sidebarAberta, setSidebarAberta }) => {
  // Estados de Controle de Submenus
  const [menuAtivosAberto, setMenuAtivosAberto] = useState(false);
  const [menuSuprimentosAberto, setMenuSuprimentosAberto] = useState(false);
  const [menuUtilidadesAberto, setMenuUtilidadesAberto] = useState(false);
  const [menuRelatAberto, setMenuRelatAberto] = useState(false);

  // Contador de Notificações de Manutenções Planejadas do Dia
  const [totalAlertasPlanejadas, setTotalAlertasPlanejadas] = useState(0);

  // Modal de Configurações / Senha
  const [modalConfigAberta, setModalConfigAberta] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');

  const location = useLocation();
  const API_URL = '/api';

  const isActive = (path) => location.pathname === path;
  const nivelUsuario = user?.nivel?.toLowerCase().trim() || 'usuario';

  // Definição de Perfis
  const isAdmin = nivelUsuario === 'admin';
  const isTecnico = nivelUsuario === 'tecnico';
  const isGestao = ['admin', 'coordenador'].includes(nivelUsuario);

  // Permissões Específicas
  const podeVerDashboard = isGestao;
  const podeVerPlanejadas = isGestao || isTecnico;
  const podeVerEquipamentos = isGestao;
  const podeGerenciarEstrutura = isAdmin; // 👈 Exclusivo para admin: Tipos, Setores e Repositório Global
  const podeVerSuprimentos = isGestao;
  const podeVerUtilidades = isGestao;
  const podeVerFiltrosAgua = isAdmin;
  const podeVerRelatorios = isGestao;
  const podeGerenciarUsuarios = isAdmin;

  // Verificadores de submenus ativos (incluindo 'orcamentos-externos')
  const isAtivosActive = location.pathname.includes('equipamentos') || 
                        location.pathname.includes('tipos-equipamentos') || 
                        location.pathname.includes('preventivas') || 
                        location.pathname.includes('setores') || 
                        location.pathname.includes('documentos') ||
                        location.pathname.includes('orcamentos-externos');
                        
  const isSuprimentosActive = location.pathname.includes('estoque') || 
                             location.pathname.includes('compras') || 
                             location.pathname.includes('fornecedores') || 
                             location.pathname.includes('notas-fiscais') || 
                             location.pathname.includes('locais-estoque');
                             
  const isUtilidadesActive = location.pathname.includes('filtros') || 
                            location.pathname.includes('gases') || 
                            location.pathname.includes('controle-epi');
                            
  const isRelatActive = location.pathname.includes('relatorios') || 
                        location.pathname.includes('relatorio-filtros');

  // Buscar alertas de manutenções programadas para o dia
  useEffect(() => {
    if (nivelUsuario === 'usuario') return;

    const carregarContadorAlertas = async () => {
      try {
        const res = await fetch(`${API_URL}/manutencoes-planejadas/alertas-hoje`, {
          headers: { 'x-usuario-nivel': user?.nivel || '' }
        });
        if (res.ok) {
          const dados = await res.json();
          setTotalAlertasPlanejadas(Array.isArray(dados) ? dados.length : 0);
        }
      } catch (err) {
        console.error("Erro ao verificar alertas de manutenção:", err);
      }
    };

    carregarContadorAlertas();
    const interval = setInterval(carregarContadorAlertas, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, nivelUsuario]);

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
        body: JSON.stringify({ id: user.id, senhaAtual, novaSenha })
      });
      const data = await response.json();
      if (response.ok) {
        alert("✅ " + data.message);
        setModalConfigAberta(false);
        setSenhaAtual(''); setNovaSenha(''); setConfirmaSenha('');
      } else {
        alert("❌ " + (data.error || "Erro ao mudar senha"));
      }
    } catch (err) {
      alert("❌ Erro de conexão.");
    }
  };

  return (
    <>
      {!sidebarAberta && (
        <button
          onClick={() => setSidebarAberta(true)}
          className="lg:hidden fixed bottom-6 left-6 z-40 bg-slate-900 text-white p-3.5 rounded-full shadow-2xl border-2 border-slate-700 hover:bg-slate-800 transition-transform active:scale-95 flex items-center justify-center animate-in zoom-in duration-200"
          title="Abrir Menu de Navegação"
          aria-label="Abrir Menu"
        >
          <FiMenu size={22} className="text-amber-400" />
        </button>
      )}

      {sidebarAberta && (
        <div 
          onClick={() => setSidebarAberta(false)} 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs transition-opacity duration-300" 
        />
      )}

      <aside 
        className={`bg-slate-900 h-screen text-slate-300 p-3 flex flex-col shrink-0 border-r border-slate-800 fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out print:hidden ${
          sidebarAberta 
            ? 'w-64 translate-x-0 shadow-2xl lg:shadow-none' 
            : 'w-0 -translate-x-full lg:translate-x-0 lg:w-16 overflow-hidden'
        }`}
      >
        {/* LOGO & TOGGLE */}
        <div className="flex items-center justify-between mb-4 pt-2 shrink-0">
          {sidebarAberta ? (
            <div className="pl-2">
              <h2 className="text-xl font-black text-white tracking-tighter italic">SEC-H</h2>
              <p className="text-[9px] text-blue-500 font-black uppercase tracking-[0.2em]">Engenharia Clínica</p>
            </div>
          ) : (
            <div className="mx-auto">
              <h2 className="text-lg font-black text-blue-500 italic">S</h2>
            </div>
          )}

          <button 
            onClick={() => setSidebarAberta(!sidebarAberta)}
            className={`bg-slate-800 text-white p-2 rounded-xl hover:bg-slate-700 transition-all border border-slate-700 ${!sidebarAberta ? 'mx-auto' : ''}`}
            title={sidebarAberta ? "Recolher Menu" : "Expandir Menu"}
          >
            {sidebarAberta ? <FiChevronLeft size={18} /> : <FiMenu size={18} />}
          </button>
        </div>

        {/* LINKS PRINCIPAIS */}
        <nav className="space-y-1 flex-1 overflow-y-auto pr-1 custom-scrollbar overflow-x-hidden">

          {/* DASHBOARD (ADMIN & COORDENADOR) */}
          {podeVerDashboard && (
            <Link 
              to="/" 
              title="Dashboard" 
              onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
              className={`flex items-center gap-3 p-2.5 rounded-xl font-bold text-sm transition-all ${isActive('/') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}
            >
              <span className="text-base shrink-0">🏠</span>
              {sidebarAberta && <span className="truncate">Dashboard</span>}
            </Link>
          )}

          {/* CHAMADOS / OS (TODOS) */}
          <Link 
            to="/chamados" 
            title="Chamados / OS" 
            onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
            className={`flex items-center gap-3 p-2.5 rounded-xl font-bold text-sm transition-all ${isActive('/chamados') ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/50' : 'hover:bg-slate-800'}`}
          >
            <span className="text-base shrink-0">🎫</span>
            {sidebarAberta && <span className="truncate">Chamados / OS</span>}
          </Link>

          {/* MANUTENÇÃO PLANEJADA (ADMIN, COORDENADOR E TÉCNICO) */}
          {podeVerPlanejadas && (
            <Link 
              to="/manutencoes-planejadas" 
              title="Manutenções Planejadas & Janelas" 
              onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
              className={`flex items-center justify-between p-2.5 rounded-xl font-bold text-sm transition-all ${
                isActive('/manutencoes-planejadas') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-base shrink-0">📅</span>
                {sidebarAberta && <span className="truncate">Manutenção Planejada</span>}
              </div>
              
              {totalAlertasPlanejadas > 0 && (
                sidebarAberta ? (
                  <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                    {totalAlertasPlanejadas}
                  </span>
                ) : (
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping shrink-0" />
                )
              )}
            </Link>
          )}

          {/* MÓDULOS GERENCIAIS */}
          {isGestao && (
            <>
              {sidebarAberta && <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-3 pt-3 pb-1">Gestão Técnica</div>}

              {/* ATIVOS & INFRA */}
              {podeVerEquipamentos && (
                <div>
                  <button
                    onClick={() => {
                      if(!sidebarAberta) setSidebarAberta(true);
                      setMenuAtivosAberto(!menuAtivosAberto);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all font-bold text-sm hover:bg-slate-800 ${isAtivosActive ? 'text-blue-400' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base shrink-0">🛠️</span>
                      {sidebarAberta && <span className="truncate">Ativos & Infra</span>}
                    </div>
                    {sidebarAberta && <FiChevronDown className={`transition-transform duration-200 ${menuAtivosAberto || isAtivosActive ? 'rotate-180' : ''}`} size={14} />}
                  </button>

                  {sidebarAberta && (menuAtivosAberto || isAtivosActive) && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-800 pl-2">
                      <Link 
                        to="/equipamentos" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/equipamentos') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Listar Ativos</span>
                      </Link>

                      {/* 📑 NOVO: Orçamentos & Lotes Externos */}
                      <Link 
                        to="/orcamentos-externos" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/orcamentos-externos') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Orçamentos Externos</span>
                      </Link>

                      {/* 🔒 EXCLUSIVO ADMIN: Gerenciar Tipos */}
                      {podeGerenciarEstrutura && (
                        <Link 
                          to="/tipos-equipamentos" 
                          onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                          className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/tipos-equipamentos') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                        >
                          <span>• Gerenciar Tipos</span>
                        </Link>
                      )}

                      <Link 
                        to="/preventivas" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/preventivas') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Preventivas PMOC</span>
                      </Link>

                      {/* 🔒 EXCLUSIVO ADMIN: Setores e Áreas */}
                      {podeGerenciarEstrutura && (
                        <Link 
                          to="/setores" 
                          onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                          className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/setores') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                        >
                          <span>• Setores e Áreas</span>
                        </Link>
                      )}

                      {/* 🔒 EXCLUSIVO ADMIN: Repositório Global de Docs */}
                      {podeGerenciarEstrutura && (
                        <Link 
                          to="/documentos" 
                          onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                          className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/documentos') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                        >
                          <span>• Repositório Docs</span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}

              {sidebarAberta && <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-3 pt-3 pb-1">Suprimentos</div>}

              {/* ALMOXARIFADO & COMPRAS */}
              {podeVerSuprimentos && (
                <div>
                  <button
                    onClick={() => {
                      if(!sidebarAberta) setSidebarAberta(true);
                      setMenuSuprimentosAberto(!menuSuprimentosAberto);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all font-bold text-sm hover:bg-slate-800 ${isSuprimentosActive ? 'text-blue-400' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-1">
                      <span className="text-base shrink-0">📦</span>
                      {sidebarAberta && (
                        <span className="truncate text-xs font-black uppercase tracking-tight">
                          Almoxarifado / Compras
                        </span>
                      )}
                    </div>
                    {sidebarAberta && (
                      <FiChevronDown 
                        className={`shrink-0 transition-transform duration-200 ${menuSuprimentosAberto || isSuprimentosActive ? 'rotate-180' : ''}`} 
                        size={14} 
                      />
                    )}
                  </button>

                  {sidebarAberta && (menuSuprimentosAberto || isSuprimentosActive) && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-800 pl-2">
                      <Link 
                        to="/solicitacoes-compra" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/solicitacoes-compra') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Solicitações / Compras</span>
                      </Link>
                      <Link 
                        to="/estoque" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/estoque') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Estoque Insumos</span>
                      </Link>
                      <Link 
                        to="/locais-estoque" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/locais-estoque') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Locais de Estoque</span>
                      </Link>
                      <Link 
                        to="/notas-fiscais" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/notas-fiscais') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Notas & Boletos</span>
                      </Link>
                      <Link 
                        to="/fornecedores" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/fornecedores') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Fornecedores</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {sidebarAberta && <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-3 pt-3 pb-1">Segurança & Utilidades</div>}

              {/* UTILIDADES & SST */}
              {podeVerUtilidades && (
                <div>
                  <button
                    onClick={() => {
                      if(!sidebarAberta) setSidebarAberta(true);
                      setMenuUtilidadesAberto(!menuUtilidadesAberto);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all font-bold text-sm hover:bg-slate-800 ${isUtilidadesActive ? 'text-blue-400' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base shrink-0">🥽</span>
                      {sidebarAberta && <span className="truncate">Utilidades & SST</span>}
                    </div>
                    {sidebarAberta && <FiChevronDown className={`transition-transform duration-200 ${menuUtilidadesAberto || isUtilidadesActive ? 'rotate-180' : ''}`} size={14} />}
                  </button>

                  {sidebarAberta && (menuUtilidadesAberto || isUtilidadesActive) && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-800 pl-2">
                      <Link 
                        to="/controle-epi" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/controle-epi') ? 'text-white bg-emerald-600' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Entrega de EPIs</span>
                      </Link>
                      <Link 
                        to="/gases" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/gases') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Gases Medicinais</span>
                      </Link>
                      {podeVerFiltrosAgua && (
                        <Link 
                          to="/filtros" 
                          onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                          className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/filtros') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                        >
                          <span>• Filtros de Água</span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}

              {sidebarAberta && <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-3 pt-3 pb-1">Gerencial</div>}

              {/* RELATÓRIOS */}
              {podeVerRelatorios && (
                <div>
                  <button
                    onClick={() => {
                      if(!sidebarAberta) setSidebarAberta(true);
                      setMenuRelatAberto(!menuRelatAberto);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all font-bold text-sm hover:bg-slate-800 ${isRelatActive ? 'text-blue-400' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base shrink-0">📊</span>
                      {sidebarAberta && <span className="truncate">Relatórios</span>}
                    </div>
                    {sidebarAberta && <FiChevronDown className={`transition-transform duration-200 ${menuRelatAberto || isRelatActive ? 'rotate-180' : ''}`} size={14} />}
                  </button>

                  {sidebarAberta && (menuRelatAberto || isRelatActive) && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-800 pl-2">
                      <Link 
                        to="/relatorios/inventario" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/relatorios/inventario') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Inventário Geral</span>
                      </Link>
                      <Link 
                        to="/relatorios/custos-setor" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/relatorios/custos-setor') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Custos por Setor</span>
                      </Link>
                      <Link 
                        to="/relatorios/estoque-local" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/relatorios/estoque-local') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Balanço Estoque</span>
                      </Link>
                      <Link 
                        to="/relatorios/chamados-setor" 
                        onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-bold transition-colors ${isActive('/relatorios/chamados-setor') ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                      >
                        <span>• Chamados por Setor</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* USUÁRIOS (EXCLUSIVO ADMIN) */}
              {podeGerenciarUsuarios && (
                <Link 
                  to="/usuarios" 
                  title="Usuários" 
                  onClick={() => { if (window.innerWidth < 1024) setSidebarAberta(false); }}
                  className={`flex items-center gap-3 p-2.5 rounded-xl font-bold text-sm transition-all ${isActive('/usuarios') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'hover:bg-slate-800'}`}
                >
                  <span className="text-base shrink-0">👥</span>
                  {sidebarAberta && <span className="truncate">Usuários</span>}
                </Link>
              )}
            </>
          )}
        </nav>

        {/* RODAPÉ DO OPERADOR */}
        <div className="mt-auto pt-3 shrink-0 overflow-hidden border-t border-slate-800">
          <div className="bg-slate-800/40 p-2 rounded-2xl border border-slate-800/50">
            {sidebarAberta ? (
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-0.5 tracking-widest">Operador Logado</p>
                <p className="text-xs font-bold text-white truncate px-1">{user?.nome}</p>
                <span className="text-[8px] font-black bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded uppercase mt-0.5 inline-block border border-blue-500/20">{user?.nivel}</span>
              </div>
            ) : (
              <div className="text-center text-xs font-black text-blue-400 uppercase">
                {user?.nome?.charAt(0)}
              </div>
            )}
            
            <div className={`mt-2 pt-2 border-t border-slate-700/50 flex ${sidebarAberta ? 'justify-around' : 'flex-col gap-2'} items-center`}>
              <button onClick={() => setModalConfigAberta(true)} title="Configurações" className="text-slate-500 hover:text-blue-400 transition-colors text-base">⚙️</button>
              <button onClick={onLogout} title="Sair" className="text-[10px] font-black text-red-400 hover:text-red-300 uppercase tracking-tighter transition-all">
                {sidebarAberta ? 'SAIR 🚀' : '🚀'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MODAL CONFIGURAÇÕES / ALTERAR SENHA */}
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
                <input type="password" className="w-full border-2 border-slate-100 p-2.5 rounded-xl outline-none focus:border-blue-400 font-bold" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required />
              </div>
              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-slate-50">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nova Senha</label>
                  <input type="password" className="w-full border-2 border-slate-100 p-2.5 rounded-xl outline-none focus:border-blue-400 font-bold" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Confirmar Nova Senha</label>
                  <input type="password" className="w-full border-2 border-slate-100 p-2.5 rounded-xl outline-none focus:border-blue-400 font-bold" value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)} required />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setModalConfigAberta(false)} className="flex-1 bg-slate-100 text-slate-400 py-3 rounded-xl font-black text-xs uppercase">Cancelar</button>
                <button type="submit" className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-sm uppercase shadow-lg shadow-blue-200 active:scale-95 transition-all">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;