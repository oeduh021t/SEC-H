import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiTrash2 } from 'react-icons/fi'; // Importado o ícone de lixeira

const Sidebar = ({ user, onLogout }) => {
  // Estados de Controle de Menu
  const [menuEquipAberto, setMenuEquipAberto] = useState(false);
  const [menuRelatAberto, setMenuRelatAberto] = useState(false);
  const [modalConfigAberta, setModalConfigAberta] = useState(false);
  
  // 🆕 Estados para o Gerenciamento de Tipos de Equipamentos
  const [modalTipoEquipAberto, setModalTipoEquipAberto] = useState(false);
  const [tiposEquipamentos, setTiposEquipamentos] = useState([]);
  const [nomeNovoTipo, setNomeNovoTipo] = useState('');
  const [carregandoTipos, setCarregandoTipos] = useState(false);
  const [salvandoTipo, setSalvandoTipo] = useState(false);
  
  // Estado para abrir/fechar sidebar
  const [sidebarAberta, setSidebarAberta] = useState(true);

  // Estados para troca de senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');

  const location = useLocation();
  const API_URL = 'http://192.168.5.101:3000/api';

  const isActive = (path) => location.pathname === path;

  // Normalização do nível de privilégio atual para checagens seguras
  const nivelUsuario = user?.nivel?.toLowerCase().trim() || 'usuario';

  // Mapeamento dinâmico de visibilidade de módulos com base no cargo
  const podeVerDashboard = ['admin', 'coordenador', 'tecnico'].includes(nivelUsuario);
  const podeVerEquipamentos = ['admin', 'coordenador', 'tecnico'].includes(nivelUsuario);
  const podeVerDocumentos = ['admin', 'coordenador', 'tecnico'].includes(nivelUsuario);
  const podeSolicitarCompras = ['admin', 'coordenador', 'tecnico'].includes(nivelUsuario); // 🛒 Permissão para Solicitações de Compra
  const podeGerenciarInfraestoque = ['admin', 'coordenador'].includes(nivelUsuario);
  const podeVerFiltrosAgua = nivelUsuario === 'admin';
  const podeVerGases = ['admin', 'coordenador', 'tecnico'].includes(nivelUsuario); // 🟢 Permissão para o módulo de gases
  const podeVerRelatorios = ['admin', 'coordenador'].includes(nivelUsuario);
  const podeGerenciarUsuarios = nivelUsuario === 'admin';

  // Verifica se o grupo está ativo para manter aberto visualmente
  const isEquipActive = location.pathname.includes('equipamentos') || location.pathname.includes('preventivas');
  const isRelatActive = location.pathname.includes('relatorios') || location.pathname.includes('relatorio-filtros');

  // 🆕 Função para buscar os tipos já cadastrados no backend
  const carregarTiposEquipamentos = async () => {
    setCarregandoTipos(true);
    try {
      const response = await fetch(`${API_URL}/tipos-equipamentos`);
      if (response.ok) {
        const data = await response.json();
        setTiposEquipamentos(data);
      } else {
        console.error("Erro ao carregar tipos de equipamentos");
      }
    } catch (err) {
      console.error("Erro de conexão ao buscar tipos:", err);
    } finally {
      setCarregandoTipos(false);
    }
  };

  // Carrega os tipos sempre que o modal for aberto
  useEffect(() => {
    if (modalTipoEquipAberto) {
      carregarTiposEquipamentos();
    }
  }, [modalTipoEquipAberto]);

  // Mudar senha
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

  // 🆕 Função para cadastrar o novo tipo de equipamento no backend
  const handleCadastrarTipoEquipamento = async (e) => {
    e.preventDefault();
    if (!nomeNovoTipo.trim()) {
      alert("❌ Por favor, insira o nome do tipo.");
      return;
    }

    setSalvandoTipo(true);
    try {
      const response = await fetch(`${API_URL}/tipos-equipamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeNovoTipo })
      });

      const data = await response.json();

      if (response.ok) {
        alert("✅ Tipo de equipamento cadastrado com sucesso!");
        setNomeNovoTipo('');
        carregarTiposEquipamentos(); // Atualiza a lista imediatamente no modal
      } else {
        alert("❌ " + (data.error || "Erro ao cadastrar tipo."));
      }
    } catch (err) {
      alert("❌ Erro de conexão ao tentar salvar.");
    } finally {
      setSalvandoTipo(false);
    }
  };

  // 🆕 Função para deletar um tipo de equipamento
  const handleDeletarTipoEquipamento = async (id, nome) => {
    const confirmar = window.confirm(`⚠️ Tem certeza de que deseja excluir o tipo "${nome}"?\nIsso pode afetar equipamentos que utilizam este tipo.`);
    if (!confirmar) return;

    try {
      const response = await fetch(`${API_URL}/tipos-equipamentos/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert("✅ Tipo de equipamento excluído com sucesso!");
        carregarTiposEquipamentos(); // Recarrega a lista sem fechar o modal
      } else {
        const data = await response.json();
        alert("❌ " + (data.error || "Erro ao excluir tipo. Certifique-se de que não existem equipamentos vinculados a ele."));
      }
    } catch (err) {
      alert("❌ Erro de conexão ao tentar excluir.");
    }
  };

  return (
    <>
      {/* Botão Hambúrguer Mobile */}
      <button 
        onClick={() => setSidebarAberta(!sidebarAberta)}
        className="fixed top-4 left-4 z-[60] bg-slate-900 text-white p-2 rounded-lg shadow-lg lg:hidden"
      >
        {sidebarAberta ? <FiX size={20} /> : <FiMenu size={20} />}
      </button>

      {/* Overlay escuro no mobile */}
      {sidebarAberta && (
        <div 
          onClick={() => setSidebarAberta(false)} 
          className="fixed inset-0 bg-black/50 z-[40] lg:hidden"
        />
      )}

      {/* SIDEBAR */}
      <div className={`bg-slate-900 h-screen text-slate-300 p-4 flex flex-col shrink-0 border-r border-slate-800 fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out print:hidden ${sidebarAberta ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'}`}>

        {/* LOGO */}
        <div className={`mb-10 p-2 text-center shrink-0 transition-opacity ${sidebarAberta ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-2xl font-black text-white tracking-tighter italic">SEC-H</h2>
          <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.2em]">Engenharia Clínica</p>
        </div>

        {/* NAVEGAÇÃO PRINCIPAL */}
        <nav className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">

          {/* DASHBOARD */}
          {podeVerDashboard && (
            <Link to="/" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
              🏠 Dashboard
            </Link>
          )}

          {/* EQUIPAMENTOS */}
          {podeVerEquipamentos && (
            <div>
              <button
                onClick={() => setMenuEquipAberto(!menuEquipAberto)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all font-bold text-sm hover:bg-slate-800 ${isEquipActive ? 'text-blue-400' : ''}`}
              >
                <div className="flex items-center gap-3">🛠️ Equipamentos</div>
                <span className={`text-[10px] transition-transform duration-300 ${menuEquipAberto || isEquipActive ? 'rotate-180' : ''}`}>▼</span>
              </button>

              <div className={`ml-4 mt-2 space-y-1 overflow-hidden transition-all duration-300 ${menuEquipAberto || isEquipActive ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0'}`}>
                <Link to="/equipamentos" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/equipamentos') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive('/equipamentos') ? 'bg-blue-500' : 'bg-slate-600'}`}></span>
                  Listar Ativos
                </Link>
                <Link to="/preventivas" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/preventivas') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive('/preventivas') ? 'bg-green-500' : 'bg-slate-600'}`}></span>
                  Preventivas / PMOC
                </Link>
                {/* Cadastro restrito para Admin e Coordenador */}
                {['admin', 'coordenador'].includes(nivelUsuario) && (
                  <>
                    <Link to="/equipamentos/novo" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/equipamentos/novo') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive('/equipamentos/novo') ? 'bg-amber-500' : 'bg-slate-600'}`}></span>
                      Novo Cadastro
                    </Link>

                    {/* Botão/Link para abrir modal de gerenciar tipos */}
                    <button 
                      type="button"
                      onClick={() => setModalTipoEquipAberto(true)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider text-slate-500 hover:text-white hover:bg-slate-800/50 transition-all text-left"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      Gerenciar Tipos (Categorias)
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* CHAMADOS */}
          <Link to="/chamados" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/chamados') ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/50' : 'hover:bg-slate-800'}`}>
            🎫 Chamados / OS
          </Link>

          {/* DOCUMENTOS */}
          {podeVerDocumentos && (
            <Link to="/documentos" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/documentos') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
              📁 Documentos
            </Link>
          )}

          {/* 🛒 SOLICITAÇÃO DE COMPRAS */}
          {podeSolicitarCompras && (
            <Link to="/solicitacoes-compra" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/solicitacoes-compra') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
              🛒 Solicitação de Compras
            </Link>
          )}

          {/* LOGÍSTICA / INFRAESTRUTURA */}
          {podeGerenciarInfraestoque && (
            <>
              <Link to="/fornecedores" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/fornecedores') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
                🚚 Fornecedores
              </Link>

              <Link to="/notas-fiscais" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/notas-fiscais') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
                🧾 Notas Fiscais / Boletos
              </Link>

              <Link to="/estoque" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/estoque') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
                📦 Gestão de Estoque
              </Link>

              <Link to="/locais-estoque" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/locais-estoque') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
                🏢 Locais de Estoque / Escopos
              </Link>

              <Link to="/setores" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/setores') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
                🏢 Cadastro de Setores
              </Link>
            </>
          )}

          {/* FILTROS DE ÁGUA */}
          {podeVerFiltrosAgua && (
            <Link to="/filtros" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/filtros') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
              🚰 Controle de Filtros
            </Link>
          )}

          {/* 🟢 CONTROLE DE GASES MEDICINAIS */}
          {podeVerGases && (
            <Link to="/gases" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/gases') ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800'}`}>
              🧪 Controle de Gases
            </Link>
          )}

          {/* RELATÓRIOS GERAIS */}
          {podeVerRelatorios && (
            <div>
              <button
                onClick={() => setMenuRelatAberto(!menuRelatAberto)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all font-bold text-sm hover:bg-slate-800 ${isRelatActive ? 'text-blue-400' : ''}`}
              >
                <div className="flex items-center gap-3">📊 Relatórios</div>
                <span className={`text-[10px] transition-transform duration-300 ${menuRelatAberto || isRelatActive ? 'rotate-180' : ''}`}>▼</span>
              </button>
              <div className={`ml-4 mt-2 space-y-1 overflow-hidden transition-all duration-300 ${menuRelatAberto || isRelatActive ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0'}`}>
                <Link to="/relatorios/inventario" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/relatorios/inventario') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive('/relatorios/inventario') ? 'bg-blue-500' : 'bg-slate-600'}`}></span>
                  Inventário Geral
                </Link>
                
                <Link to="/relatorios/custos-setor" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/relatorios/custos-setor') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive('/relatorios/custos-setor') ? 'bg-red-500' : 'bg-slate-600'}`}></span>
                  Custos por Setor
                </Link>

                <Link to="/relatorios/estoque-local" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/relatorios/estoque-local') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive('/relatorios/estoque-local') ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                   Balanço de Estoque
                </Link>
                
                <Link
                  to="/relatorios/chamados-setor"
                  className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
                    isActive('/relatorios/chamados-setor')
                      ? 'text-white bg-slate-800'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive('/relatorios/chamados-setor')
                        ? 'bg-yellow-500'
                        : 'bg-slate-600'
                    }`}
                  ></span>
                  Chamados por Setor
                </Link>

                {nivelUsuario === 'admin' && (
                  <Link to="/relatorio-filtros" className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isActive('/relatorio-filtros') ? 'text-white bg-slate-800' : 'text-slate-500 hover:text-white'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive('/relatorio-filtros') ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                    Histórico de Filtros
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* GERENCIAMENTO DE OPERADORES */}
          {podeGerenciarUsuarios && (
            <Link to="/usuarios" className={`flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all ${isActive('/usuarios') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'hover:bg-slate-800'}`}>
              👥 Usuários
            </Link>
          )}
        </nav>

        {/* RODAPÉ */}
        <div className="mt-auto pt-6 shrink-0">
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800/50">
            <div className="text-center">
              <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Operador Logado</p>
              <p className="text-xs font-bold text-white truncate px-2">{user?.nome}</p>
              <span className="text-[8px] font-black bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded uppercase mt-1 inline-block border border-blue-500/20">{user?.nivel}</span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-around items-center">
              <button onClick={() => setModalConfigAberta(true)} title="Configurações" className="text-slate-500 hover:text-blue-400 transition-colors text-lg">⚙️</button>
              <button onClick={onLogout} className="text-[10px] font-black text-red-400 hover:text-red-300 uppercase tracking-tighter transition-all">SAIR 🚀</button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CONFIG */}
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

      {/* 🆕 MODAL DE GERENCIAMENTO DE TIPOS DE EQUIPAMENTOS */}
      {modalTipoEquipAberto && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-slate-800">
          <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            {/* Cabeçalho */}
            <div className="bg-slate-800 p-5 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black uppercase tracking-widest text-sm">🛠️ Gerenciar Tipos de Equipamento</h3>
              <button onClick={() => setModalTipoEquipAberto(false)} className="text-xl hover:text-red-400">✕</button>
            </div>
            
            {/* Formulário de Cadastro */}
            <div className="p-6 border-b border-slate-100 shrink-0">
              <form onSubmit={handleCadastrarTipoEquipamento} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Cadastrar Novo Tipo</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 border-2 border-slate-100 p-2.5 rounded-xl outline-none focus:border-indigo-400 font-bold text-sm" 
                      placeholder="Ex: Cardioversor, Compressor..."
                      value={nomeNovoTipo} 
                      onChange={(e) => setNomeNovoTipo(e.target.value)} 
                      required 
                    />
                    <button 
                      type="submit" 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 rounded-xl font-black text-xs uppercase shadow-md shadow-indigo-200 transition-all disabled:opacity-50 shrink-0"
                      disabled={salvandoTipo}
                    >
                      {salvandoTipo ? '...' : 'Cadastrar'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Listagem com Scroll */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar min-h-[250px]">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Tipos Cadastrados</h4>
              
              {carregandoTipos ? (
                <p className="text-sm text-center text-slate-400 py-4">Carregando tipos...</p>
              ) : tiposEquipamentos.length === 0 ? (
                <p className="text-sm text-center text-slate-400 py-4">Nenhum tipo cadastrado.</p>
              ) : (
                <div className="space-y-1.5">
                  {tiposEquipamentos.map((tipo) => (
                    <div 
                      key={tipo.id} 
                      className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-all border border-slate-100 group"
                    >
                      <span className="text-sm font-bold text-slate-700">
                        {tipo.nome}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeletarTipoEquipamento(tipo.id, tipo.nome)}
                        title="Excluir este tipo"
                        className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="bg-slate-50 p-4 flex justify-end shrink-0 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setModalTipoEquipAberto(false)} 
                className="bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 px-6 py-2.5 rounded-xl font-black text-xs uppercase"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;