import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

const Chamados = ({ user: userProp }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const fileInputCameraRef = useRef(null);
  const fileInputGaleriaRef = useRef(null);

  const [chamados, setChamados] = useState([]);
  const [setores, setSetores] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);

  const [agora, setAgora] = useState(new Date());

  const [user] = useState(() => {
    if (userProp) return userProp;
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [modalAberta, setModalAberta] = useState(false);
  const [modalObsAberta, setModalObsAberta] = useState(false);
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false);
  const [modalEditarAberta, setModalEditarAberta] = useState(false);

  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null);

  const [fotoAbertura, setFotoAbertura] = useState(null);

  const [form, setForm] = useState({
    setor_id: '',
    equipamento_id: '',
    titulo: '',
    descricao_problema: '',
    prioridade: 'Média',
    categoria: 'Manutenção'
  });

  const [formEdicao, setFormEdicao] = useState({
    id: null,
    setor_id: '',
    equipamento_id: '',
    titulo: '',
    descricao_problema: '',
    prioridade: 'Média',
    categoria: 'Manutenção'
  });

  const [textoObs, setTextoObs] = useState('');

  const API_URL = '/api';
  const BASE_URL = '';

  const [documentoSelecionado, setDocumentoSelecionado] = useState(null);
  const [listaDocumentos, setListaDocumentos] = useState([]);

  const obterNivelUsuario = () => user?.nivel || '';
  const isAdminOuCoord = ['admin', 'coordenador'].includes(user?.nivel?.toLowerCase().trim());

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const calcularTempoSLA = (dataInicioStr, dataFimStr, prioridade = 'Média') => {
    if (!dataInicioStr) {
      return { texto: '---', horasDecorridas: 0, percentual: 0, atrasado: false, metaHoras: 24 };
    }

    const metasHoras = { Urgente: 2, Alta: 6, 'Média': 24, Baixa: 48 };
    const metaHoras = metasHoras[prioridade] || 24;

    const inicio = new Date(dataInicioStr);
    const fim = dataFimStr ? new Date(dataFimStr) : agora;

    const diffMs = fim - inicio;
    const minutosTotais = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const horasDecorridas = minutosTotais / 60;
    const dias = Math.floor(minutosTotais / 1440);
    const horas = Math.floor((minutosTotais % 1440) / 60);
    const minutos = minutosTotais % 60;

    let texto = '';
    if (dias > 0) texto = `${dias}d ${horas}h ${minutos}m`;
    else if (horas > 0) texto = `${horas}h ${minutos}m`;
    else texto = `${minutos}m`;

    const percentual = Math.min(100, Math.round((horasDecorridas / metaHoras) * 100));
    const atrasado = horasDecorridas > metaHoras;

    return { texto, horasDecorridas, percentual, atrasado, metaHoras };
  };

  const carregarDados = () => {
    const headers = {
      'Content-Type': 'application/json',
      'x-usuario-nivel': obterNivelUsuario()
    };

    fetch(`${API_URL}/chamados`, { headers }).then(res => res.json()).then(setChamados).catch(err => console.error(err));
    fetch(`${API_URL}/setores`, { headers }).then(res => res.json()).then(setSetores).catch(err => console.error(err));
    fetch(`${API_URL}/equipamentos`, { headers }).then(res => res.json()).then(setEquipamentos).catch(err => console.error(err));
  };

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if (location.state?.buscaId) {
      setBusca(String(location.state.buscaId));
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    if (location.state?.pre_configurado) {
      setForm(prev => ({
        ...prev,
        setor_id: location.state.setor_id || '',
        equipamento_id: location.state.equipamento_id || ''
      }));
      setModalAberta(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

  const abrirDetalhes = (id) => {
    const headers = {
      'Content-Type': 'application/json',
      'x-usuario-nivel': obterNivelUsuario()
    };

    fetch(`${API_URL}/chamados/${id}`, { method: 'GET', headers })
      .then(res => res.json())
      .then(data => {
        setChamadoSelecionado(data);
        setModalDetalhesAberta(true);

        fetch(`${API_URL}/documentos?chamado_id=${id}`, { method: 'GET', headers })
          .then(res => res.json())
          .then(setListaDocumentos)
          .catch(err => console.error("Erro ao buscar documentos:", err));
      })
      .catch(err => console.error("Erro ao buscar detalhes:", err));
  };

  const abrirModalEdicao = (c) => {
    setFormEdicao({
      id: c.id,
      setor_id: c.setor_id || '',
      equipamento_id: c.equipamento_id || '',
      titulo: c.titulo || '',
      descricao_problema: c.descricao_problema || '',
      prioridade: c.prioridade || 'Média',
      categoria: c.categoria || 'Manutenção'
    });
    setModalEditarAberta(true);
  };

  const salvarEdicaoChamado = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/chamados/${formEdicao.id}/editar-dados`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': obterNivelUsuario()
        },
        body: JSON.stringify({
          ...formEdicao,
          usuario_nome: user?.nome || 'Administrador'
        })
      });

      if (res.ok) {
        alert("Chamado atualizado com sucesso! ✏️✅");
        setModalEditarAberta(false);
        carregarDados();
        if (modalDetalhesAberta && chamadoSelecionado?.id === formEdicao.id) {
          abrirDetalhes(formEdicao.id);
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Erro ao salvar alterações.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de conexão ao atualizar chamado.");
    }
  };

  const enviarChamado = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('setor_id', form.setor_id);
    formData.append('equipamento_id', form.equipamento_id);
    formData.append('titulo', form.titulo);
    formData.append('descricao_problema', form.descricao_problema);
    formData.append('prioridade', form.prioridade);
    formData.append('categoria', form.categoria);
    formData.append('usuario_id', user?.id || '');
    if (fotoAbertura) formData.append('foto', fotoAbertura);

    fetch(`${API_URL}/chamados`, {
      method: 'POST',
      headers: {
        'x-usuario-nivel': obterNivelUsuario()
      },
      body: formData
    }).then(() => {
      setModalAberta(false);
      setFotoAbertura(null);
      setForm({ setor_id: '', equipamento_id: '', titulo: '', descricao_problema: '', prioridade: 'Média', categoria: 'Manutenção' });
      carregarDados();
    }).catch(err => console.error("Erro ao abrir chamado:", err));
  };

  const handleReabrirChamado = (id) => {
    const motivo = prompt("Informe a justificativa/motivo para reabrir esta Ordem de Serviço:");
    if (motivo === null) return;
    if (!motivo.trim()) return alert("É obrigatório informar uma justificativa.");

    fetch(`${API_URL}/chamados/${id}/reabrir`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-usuario-nivel': obterNivelUsuario()
      },
      body: JSON.stringify({
        motivo_reabertura: motivo.trim(),
        usuario_nome: user?.nome || 'Administrador'
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
      } else {
        alert("Chamado reaberto com sucesso! 🔄");
        carregarDados();
        if (modalDetalhesAberta) abrirDetalhes(id);
      }
    })
    .catch(err => console.error("Erro ao reabrir chamado:", err));
  };

  const handleUploadDocumento = (e) => {
    e.preventDefault();
    if (!documentoSelecionado) return alert("Selecione um arquivo PDF ou Imagem!");

    const formData = new FormData();
    formData.append('arquivo', documentoSelecionado);
    formData.append('chamado_id', chamadoSelecionado.id);
    formData.append('usuario_id', user?.id || 1);
    formData.append('setor_id', chamadoSelecionado.setor_id || '');
    formData.append('equipamento_id', chamadoSelecionado.equipamento_id || '');

    fetch(`${API_URL}/documentos`, {
      method: 'POST',
      headers: {
        'x-usuario-nivel': obterNivelUsuario()
      },
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
      } else {
        alert("Documento anexado com sucesso para fins de auditoria! ✅");
        setDocumentoSelecionado(null);
        abrirDetalhes(chamadoSelecionado.id);
        carregarDados();
      }
    })
    .catch(err => console.error("Erro no upload do documento:", err));
  };

  const salvarObs = (e) => {
    e.preventDefault();
    if (!isAdminOuCoord) {
      alert("Acesso negado.");
      return;
    }

    fetch(`${API_URL}/chamados/${chamadoSelecionado.id}/observacao`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'x-usuario-nivel': obterNivelUsuario()
      },
      body: JSON.stringify({
        nova_obs: textoObs,
        usuario_nome: user.nome,
        usuario_nivel: user.nivel
      })
    })
    .then(res => {
      if (res.ok) {
        setModalObsAberta(false);
        setTextoObs('');
        carregarDados();
        if (modalDetalhesAberta) abrirDetalhes(chamadoSelecionado.id);
      } else {
        alert("Erro nas permissões.");
      }
    }).catch(err => console.error("Erro ao salvar observação:", err));
  };

  // Funções visuais de suporte aos cards e status
  const isManutencaoExterna = (c) => {
    return c.status === 'Aguardando Externa' || Number(c.em_manutencao_externa) === 1;
  };

  const obterEstiloCard = (c) => {
    if (isManutencaoExterna(c)) {
      return 'bg-purple-50/60 border-purple-200 border-l-purple-600 shadow-purple-50';
    }
    if (c.status === 'Aberto') {
      return 'bg-red-50/40 border-red-200 border-l-red-500 shadow-red-50';
    }
    if (c.status === 'Em Atendimento') {
      return 'bg-amber-50/40 border-amber-200 border-l-amber-500 shadow-amber-50';
    }
    return 'bg-emerald-50/30 border-emerald-200 border-l-emerald-500 shadow-emerald-50';
  };

  const obterBadgeStatus = (c) => {
    if (isManutencaoExterna(c)) {
      return 'bg-purple-600 text-white shadow-sm shadow-purple-200';
    }
    if (c.status === 'Aberto') {
      return 'bg-red-500 text-white shadow-sm shadow-red-200';
    }
    if (c.status === 'Em Atendimento') {
      return 'bg-amber-500 text-white shadow-sm shadow-amber-200';
    }
    return 'bg-emerald-600 text-white shadow-sm shadow-emerald-200';
  };

  // Totalizadores para as abas
  const totalExternos = chamados.filter(c => isManutencaoExterna(c)).length;
  const totalAbertos = chamados.filter(c => c.status === 'Aberto').length;
  const totalAtendimento = chamados.filter(c => c.status === 'Em Atendimento').length;
  const totalConcluidos = chamados.filter(c => c.status === 'Concluído').length;

  const filtrados = chamados.filter(c => {
    const isUsuarioComum = user?.nivel?.toLowerCase() === 'usuario';
    if (isUsuarioComum) {
      const pertenceAoUsuario = String(c.usuario_abertura_id) === String(user?.id);
      if (!pertenceAoUsuario) return false;
    }

    let bateStatus = false;
    if (filtroStatus === 'Todos') {
      bateStatus = true;
    } else if (filtroStatus === 'Aguardando Externa') {
      bateStatus = isManutencaoExterna(c);
    } else {
      bateStatus = c.status === filtroStatus;
    }

    const bateBusca = c.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
                      c.id?.toString().includes(busca) ||
                      c.setor_nome?.toLowerCase().includes(busca.toLowerCase()) ||
                      c.equip_nome?.toLowerCase().includes(busca.toLowerCase()) ||
                      c.equip_pat?.toLowerCase().includes(busca.toLowerCase());

    return bateStatus && bateBusca;
  });

  return (
    <div className="p-4 bg-slate-50 min-h-screen font-sans text-dark">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <span className="bg-amber-100 p-2 rounded-xl text-amber-600">🎫</span>
          CHAMADOS / OS
        </h1>
        <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
          <input 
            type="text" 
            placeholder="Buscar por OS, ativo, setor..." 
            value={busca}
            className="border-2 border-slate-100 rounded-xl p-2.5 w-full md:w-64 outline-none font-bold text-slate-800 focus:border-blue-500 transition-colors" 
            onChange={(e) => setBusca(e.target.value)} 
          />

          {user?.nivel?.toLowerCase().trim() !== 'usuario' && (
            <Link
              to="/painel-chamados"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 active:scale-95"
              title="Abrir Painel de TV em tempo real"
            >
              <span>📺</span> PAINEL TV
            </Link>
          )}

          <button 
            onClick={() => { 
              setForm({ setor_id: '', equipamento_id: '', titulo: '', descricao_problema: '', prioridade: 'Média', categoria: 'Manutenção' }); 
              setModalAberta(true); 
            }} 
            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-black shadow-lg shadow-amber-100 transition-all active:scale-95"
          >
            + NOVO CHAMADO
          </button>
        </div>
      </div>

      {/* 🧭 BARRA DE ABAS / FILTROS VISUAIS RÁPIDOS */}
      <div className="flex flex-wrap items-center gap-2 mb-6 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
        <button
          type="button"
          onClick={() => setFiltroStatus('Todos')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
            filtroStatus === 'Todos'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-200'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <span>📋</span> Todos ({chamados.length})
        </button>

        <button
          type="button"
          onClick={() => setFiltroStatus('Aberto')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
            filtroStatus === 'Aberto'
              ? 'bg-red-500 text-white shadow-md shadow-red-100'
              : 'bg-red-50 text-red-700 hover:bg-red-100'
          }`}
        >
          <span>🔴</span> Abertos ({totalAbertos})
        </button>

        <button
          type="button"
          onClick={() => setFiltroStatus('Em Atendimento')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
            filtroStatus === 'Em Atendimento'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-100'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <span>🟡</span> Em Atendimento ({totalAtendimento})
        </button>

        {/* 🚚 NOVA ABA ROXA DE MANUTENÇÃO EXTERNA */}
        <button
          type="button"
          onClick={() => setFiltroStatus('Aguardando Externa')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
            filtroStatus === 'Aguardando Externa'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
              : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/50'
          }`}
        >
          <span>🚚</span> Manutenção Externa ({totalExternos})
        </button>

        <button
          type="button"
          onClick={() => setFiltroStatus('Concluído')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
            filtroStatus === 'Concluído'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          <span>🟢</span> Concluídos ({totalConcluidos})
        </button>
      </div>

      {/* GRID DE CARDS COLORIDOS COM FUNDO SUAVE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtrados.map(c => {
          const sla = calcularTempoSLA(c.data_abertura, c.data_conclusao, c.prioridade);
          const isConcluido = c.status === 'Concluído';
          const isAdmin = user?.nivel?.toLowerCase() === 'admin';
          const emExterna = isManutencaoExterna(c);

          return (
            <div 
              key={c.id} 
              className={`rounded-3xl border-2 border-l-[10px] flex flex-col justify-between overflow-hidden transition-all hover:shadow-xl hover:-translate-y-0.5 ${obterEstiloCard(c)}`}
            >
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="bg-white/80 text-slate-800 font-black text-[10px] px-2 py-0.5 rounded-md border border-slate-200/60 shadow-xs">
                          #{c.id}
                        </span>
                        <h3 className="font-black text-slate-800 text-base uppercase truncate" title={c.titulo}>
                          {c.titulo}
                        </h3>
                      </div>
                      <div className="text-[11px] text-slate-500 font-bold uppercase mt-0.5 flex items-center gap-2">
                        <span>📍 {c.setor_nome || 'Setor Geral'}</span>
                        <span>•</span>
                        <span>📅 {c.data_abertura ? new Date(c.data_abertura).toLocaleDateString('pt-BR') : '---'}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${obterBadgeStatus(c)}`}>
                        {emExterna ? '🚚 Aguardando Externa' : c.status}
                      </span>
                      <span className={`text-[9px] font-black uppercase ${
                        c.prioridade === 'Urgente' ? 'text-red-600' : c.prioridade === 'Alta' ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        Prioridade: {c.prioridade || 'Média'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white/70 p-2 rounded-xl border border-slate-200/50 mb-3 flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-1.5 font-black text-slate-600">
                      <span>⏱️ SLA:</span>
                      <span className={sla.atrasado ? 'text-red-600' : 'text-slate-800'}>{sla.texto}</span>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">
                      Meta: {sla.metaHoras}h {sla.atrasado && <strong className="text-red-500">⚠️ (Estourado)</strong>}
                    </div>
                  </div>

                  {c.equip_nome && (
                    <div className="mb-3 p-2 bg-white/80 border border-slate-200/60 rounded-xl flex items-center gap-2 text-xs">
                      <span className={emExterna ? 'text-purple-600' : 'text-blue-600'}>
                        {emExterna ? '🚚' : '🤖'}
                      </span>
                      <span className="font-bold text-slate-700 truncate">
                        [{c.equip_pat || 'S/P'}] {c.equip_nome}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-3 bg-white/80 p-3 rounded-2xl border border-slate-200/60 mb-3">
                    {c.foto_abertura ? (
                      <img 
                        src={`${BASE_URL}${c.foto_abertura}`} 
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                        onClick={() => window.open(`${BASE_URL}${c.foto_abertura}`)} 
                        alt="Miniatura Abertura" 
                        title="Clique para ampliar a foto"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl border border-dashed border-slate-200 bg-white flex flex-col items-center justify-center text-[8px] font-bold text-slate-300 uppercase shrink-0">
                        <span>📷</span>
                        <span>Sem foto</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Relato do Solicitante:</span>
                      <p className="text-xs font-medium text-slate-600 line-clamp-3 leading-relaxed">
                        {c.descricao_problema || "Sem descrição detalhada informada."}
                      </p>
                    </div>
                  </div>

                  {c.observacao_coordenador && (
                    <div className="mb-3 p-2.5 bg-cyan-50 border border-cyan-100 rounded-xl text-xs flex items-start gap-2">
                      <span className="text-cyan-600 text-sm">💬</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-black text-cyan-700 uppercase block">Nota da Gestão:</span>
                        <p className="text-slate-600 font-medium line-clamp-1 italic text-[11px]">
                          {c.observacao_coordenador}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/60 mt-2">
                  <div className="text-[10px] text-slate-500 font-bold">
                    👤 Por: <strong className="text-slate-700">{c.solicitante_nome || 'Usuário'}</strong>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button 
                      onClick={() => abrirDetalhes(c.id)} 
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase transition-all shadow-xs"
                    >
                      Detalhes
                    </button>

                    {isAdminOuCoord && !isConcluido && (
                      <button
                        onClick={() => abrirModalEdicao(c)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-[10px] font-black uppercase transition-all"
                        title="Editar setor, equipamento ou detalhes da solicitação"
                      >
                        ✏️ Editar
                      </button>
                    )}

                    {c.status !== 'Concluído' && user?.nivel?.toLowerCase() !== 'usuario' && (
                      <button
                        onClick={() => navigate(`/chamados/${c.id}/tratar`)}
                        className={`px-3 py-1.5 text-white rounded-xl text-[10px] font-black uppercase shadow-sm transition-all active:scale-95 ${
                          emExterna 
                            ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-100' 
                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                        }`}
                      >
                        {emExterna ? '🚚 Atender / Externa' : 'Atender'}
                      </button>
                    )}

                    {isConcluido && isAdmin && (
                      <button
                        onClick={() => handleReabrirChamado(c.id)}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all active:scale-95"
                        title="Reabrir esta OS"
                      >
                        🔄 Reabrir
                      </button>
                    )}

                    {user?.nivel?.toLowerCase() !== 'usuario' && (
                      <Link
                        to={`/chamados/${c.id}/imprimir`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center shadow-xs"
                      >
                        🖨️
                      </Link>
                    )}

                    {isAdminOuCoord && (
                      <button 
                        onClick={() => { setChamadoSelecionado(c); setTextoObs(''); setModalObsAberta(true); }} 
                        className="px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-xl text-[10px] font-black uppercase transition-all"
                        title="Adicionar nota de coordenação"
                      >
                        💬 Obs
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: DETALHES DO CHAMADO */}
      {modalDetalhesAberta && chamadoSelecionado && (() => {
        const slaModal = calcularTempoSLA(chamadoSelecionado.data_abertura, chamadoSelecionado.data_conclusao, chamadoSelecionado.prioridade);
        const custoPecas = chamadoSelecionado.itens_vinculados?.reduce((acc, item) => acc + (Number(item.quantidade || 0) * Number(item.valor_unitario || 0)), 0) || 0;
        const custoServico = Number(chamadoSelecionado.custo_servico || 0) + Number(chamadoSelecionado.valor_servico_externo || 0);
        const custoTotalOS = custoServico + custoPecas;
        
        const isAberto = chamadoSelecionado.status === 'Aberto';
        const isEmAtendimento = chamadoSelecionado.status === 'Em Atendimento';
        const isExternaModal = isManutencaoExterna(chamadoSelecionado);
        const isConcluido = chamadoSelecionado.status === 'Concluído';

        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white w-full max-w-6xl h-[92vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200 border border-slate-100">
              
              <div className="bg-slate-900 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setModalDetalhesAberta(false)} 
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all text-white text-xs font-black uppercase flex items-center gap-1 active:scale-95"
                  >
                    <span>←</span> Voltar
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                        OS #{chamadoSelecionado.id}
                      </span>
                      <h2 className="font-black text-white text-base sm:text-lg uppercase tracking-tight truncate max-w-md sm:max-w-xl">
                        {chamadoSelecionado.titulo}
                      </h2>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                      📍 {chamadoSelecionado.setor_nome || 'Setor Não Definido'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-800/90 px-4 py-1.5 rounded-2xl border border-slate-700">
                  <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${isAberto ? 'text-red-400' : 'text-slate-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${isAberto ? 'bg-red-500 animate-ping' : 'bg-slate-600'}`}></span>
                    <span>Aberto</span>
                  </div>

                  <span className="text-slate-600 text-xs">➔</span>

                  <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${isEmAtendimento ? 'text-amber-400' : isConcluido ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${isEmAtendimento ? 'bg-amber-400 animate-ping' : isConcluido ? 'bg-amber-500/50' : 'bg-slate-600'}`}></span>
                    <span>Em Atendimento</span>
                  </div>

                  <span className="text-slate-600 text-xs">➔</span>

                  <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${isExternaModal ? 'text-purple-400' : 'text-slate-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${isExternaModal ? 'bg-purple-500 animate-ping' : 'bg-slate-600'}`}></span>
                    <span>Externa</span>
                  </div>

                  <span className="text-slate-600 text-xs">➔</span>

                  <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${isConcluido ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${isConcluido ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                    <span>Concluído</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-100/70 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-slate-200 shrink-0">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200/60">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Solicitante:</span>
                  <p className="font-bold text-xs text-slate-800 truncate mt-0.5">{chamadoSelecionado.solicitante_nome || 'Não identificado'}</p>
                </div>

                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200/60">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Técnico Responsável:</span>
                  <p className="font-bold text-xs text-blue-600 truncate mt-0.5">{chamadoSelecionado.tecnico_responsavel || 'Aguardando Atribuição'}</p>
                </div>

                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200/60">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">SLA & Prazos:</span>
                  <p className={`font-black text-xs mt-0.5 ${slaModal.atrasado ? 'text-red-600' : 'text-slate-800'}`}>
                    ⏱️ {slaModal.texto} <span className="text-[9px] font-bold text-slate-400">({slaModal.metaHoras}h meta)</span>
                  </p>
                </div>

                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200/60">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Custo Acumulado:</span>
                  <p className="font-black text-xs text-emerald-600 mt-0.5">
                    R$ {custoTotalOS.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* COLUNA ESQUERDA */}
                  <div className="lg:col-span-5 space-y-4">
                    
                    <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-200/70 space-y-3">
                      <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <span>🤖</span> Equipamento / Ativo
                      </h4>
                      {chamadoSelecionado.equipamento_id ? (
                        <div className="space-y-1 text-xs">
                          <p className="font-black text-slate-800 uppercase">{chamadoSelecionado.eq_nome}</p>
                          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 font-bold">
                            <span>PAT: <strong className="text-slate-700">{chamadoSelecionado.patrimonio || 'S/P'}</strong></span>
                            <span>S/N: <strong className="text-slate-700">{chamadoSelecionado.num_serie || 'N/A'}</strong></span>
                            <span>Modelo: <strong className="text-slate-700">{chamadoSelecionado.modelo || 'S/M'}</strong></span>
                            <span>Marca: <strong className="text-slate-700">{chamadoSelecionado.fabricante || 'S/M'}</strong></span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-xl text-center">
                          <p className="text-xs font-bold text-slate-500 uppercase">Infraestrutura Predial</p>
                          <span className="text-[9px] text-slate-400 font-medium italic">Nenhum equipamento específico associado</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-200/70 space-y-3">
                      <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <span>📷</span> Evidências Fotográficas
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Abertura:</label>
                          {chamadoSelecionado.foto_abertura ? (
                            <img 
                              src={`${BASE_URL}${chamadoSelecionado.foto_abertura}`} 
                              className="rounded-xl border border-slate-200 w-full h-28 object-cover cursor-pointer hover:opacity-80 transition-opacity shadow-sm" 
                              onClick={() => window.open(`${BASE_URL}${chamadoSelecionado.foto_abertura}`)} 
                              alt="Foto Abertura" 
                            />
                          ) : (
                            <div className="w-full h-28 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase italic text-center p-2">
                              Sem foto na abertura
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Conclusão:</label>
                          {chamadoSelecionado.foto_conclusao ? (
                            <img 
                              src={`${BASE_URL}${chamadoSelecionado.foto_conclusao}`} 
                              className="rounded-xl border border-slate-200 w-full h-28 object-cover cursor-pointer hover:opacity-80 transition-opacity shadow-sm" 
                              onClick={() => window.open(`${BASE_URL}${chamadoSelecionado.foto_conclusao}`)} 
                              alt="Foto Conclusão" 
                            />
                          ) : (
                            <div className="w-full h-28 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase italic text-center p-2">
                              Sem foto de conclusão
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-200/70 space-y-3">
                      <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <span>📎</span> Laudos & Arquivos ({listaDocumentos.length})
                      </h4>
                      
                      <form onSubmit={handleUploadDocumento} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                        <input 
                          type="file" 
                          accept="image/*,application/pdf" 
                          className="text-xs w-full block file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300" 
                          onChange={(e) => setDocumentoSelecionado(e.target.files[0])} 
                        />
                        <button type="submit" className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-sm active:scale-95">
                          + Enviar Laudo / Documento
                        </button>
                      </form>

                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {listaDocumentos.map((doc) => (
                          <div key={doc.id} className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700 truncate max-w-[180px]" title={doc.nome_original}>
                              {doc.tipo_mimetype.includes('pdf') ? '📄' : '📷'} {doc.nome_original}
                            </span>
                            <a 
                              href={`${BASE_URL}${doc.url_arquivo}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-600 hover:text-blue-800 font-black text-[10px] uppercase bg-blue-50 px-2 py-1 rounded-md border border-blue-100"
                            >
                              Abrir ↗
                            </a>
                          </div>
                        ))}
                        {listaDocumentos.length === 0 && (
                          <p className="text-[10px] text-slate-400 italic text-center py-1">Nenhum laudo anexado.</p>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* COLUNA DIREITA */}
                  <div className="lg:col-span-7 space-y-4">
                    
                    <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-200/70 space-y-1.5">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-wider block">🚨 Problema Reportado na Abertura:</span>
                      <div className="p-3 bg-red-50/50 rounded-xl text-xs font-medium text-slate-700 border border-red-100 leading-relaxed whitespace-pre-wrap">
                        {chamadoSelecionado.descricao_problema}
                      </div>
                    </div>

                    {chamadoSelecionado.itens_vinculados?.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-200/70 space-y-2.5">
                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                          <span>📦</span> Peças e Insumos Deduzidos do Almoxarifado
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
                                <th className="p-2">Item</th>
                                <th className="p-2 text-center">Qtd</th>
                                <th className="p-2 text-right">Valor Unit.</th>
                                <th className="p-2 text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {chamadoSelecionado.itens_vinculados.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/60">
                                  <td className="p-2 font-bold text-slate-700">{item.nome}</td>
                                  <td className="p-2 text-center font-bold text-slate-600">{item.quantidade} un.</td>
                                  <td className="p-2 text-right font-mono text-slate-500">R$ {Number(item.valor_unitario || 0).toFixed(2)}</td>
                                  <td className="p-2 text-right font-mono font-black text-slate-800">
                                    R$ {(Number(item.quantidade || 0) * Number(item.valor_unitario || 0)).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-200/70 space-y-3">
                      <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <span>🕒</span> Linha do Tempo & Histórico da Intervenção
                      </h4>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {chamadoSelecionado.historico?.map((h, i) => (
                          <div key={i} className="flex gap-3 text-xs">
                            <div className={`w-2 rounded-full shrink-0 mt-1 ${h.texto_historico?.includes('MANUTENÇÃO EXTERNA') ? 'bg-purple-600' : 'bg-blue-500'}`}></div>
                            <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 mb-1">
                                <span className="text-slate-700 font-black">{h.tecnico_nome}</span>
                                <span>{new Date(h.data_registro).toLocaleString('pt-BR')}</span>
                              </div>
                              <p className="text-slate-600 font-medium whitespace-pre-wrap">{h.texto_historico}</p>
                            </div>
                          </div>
                        ))}
                        {(!chamadoSelecionado.historico || chamadoSelecionado.historico.length === 0) && (
                          <p className="text-xs font-bold text-slate-400 italic text-center py-4">Nenhum evento registrado ainda.</p>
                        )}
                      </div>
                    </div>

                    {isConcluido && (chamadoSelecionado.assinatura_tecnico || chamadoSelecionado.assinatura_setor) && (
                      <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-200/70 space-y-3">
                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                          <span>✍️</span> Assinaturas Digitais Coletadas
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Técnico Executante</span>
                            {chamadoSelecionado.assinatura_tecnico ? (
                              <img src={chamadoSelecionado.assinatura_tecnico} className="h-14 mx-auto object-contain" alt="Assinatura Técnico" />
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Não coletada</span>
                            )}
                            <p className="text-[10px] font-bold text-slate-700 mt-1">{chamadoSelecionado.nome_tecnico || chamadoSelecionado.tecnico_responsavel}</p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Recebido no Setor</span>
                            {chamadoSelecionado.assinatura_setor ? (
                              <img src={chamadoSelecionado.assinatura_setor} className="h-14 mx-auto object-contain" alt="Assinatura Setor" />
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Não coletada</span>
                            )}
                            <p className="text-[10px] font-bold text-slate-700 mt-1">{chamadoSelecionado.nome_setor || 'Responsável'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              </div>

              <div className="bg-white px-6 py-3 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
                <div className="text-[11px] font-bold text-slate-500">
                  Status Atual: <strong className="text-slate-800 uppercase">{chamadoSelecionado.status}</strong>
                </div>

                <div className="flex gap-2">
                  {isAdminOuCoord && !isConcluido && (
                    <button 
                      onClick={() => abrirModalEdicao(chamadoSelecionado)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase transition-all shadow-sm active:scale-95 flex items-center gap-1"
                    >
                      <span>✏️</span> Editar OS
                    </button>
                  )}

                  {isAdminOuCoord && (
                    <button 
                      onClick={() => { setTextoObs(''); setModalObsAberta(true); }} 
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-black uppercase transition-all shadow-sm active:scale-95"
                    >
                      + Obs Coordenação
                    </button>
                  )}

                  {!isConcluido && user?.nivel?.toLowerCase() !== 'usuario' && (
                    <button
                      onClick={() => {
                        setModalDetalhesAberta(false);
                        navigate(`/chamados/${chamadoSelecionado.id}/tratar`);
                      }}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                      <span>🛠️</span> Atender Chamado
                    </button>
                  )}

                  <Link
                    to={`/chamados/${chamadoSelecionado.id}/imprimir`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <span>🖨️</span> Imprimir OS
                  </Link>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL: EDITAR CHAMADO */}
      {modalEditarAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-dark">
          <form onSubmit={salvarEdicaoChamado} className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-slate-900 p-5 text-white font-black flex justify-between items-center text-base uppercase">
              <span>✏️ Editar Ordem de Serviço #{formEdicao.id}</span>
              <button type="button" onClick={() => setModalEditarAberta(false)} className="text-xl">✕</button>
            </div>
            
            <div className="p-6 sm:p-8 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Setor / Quarto *</label>
                <select 
                  required 
                  className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white text-sm outline-none focus:border-blue-500" 
                  value={formEdicao.setor_id} 
                  onChange={e => setFormEdicao({ ...formEdicao, setor_id: e.target.value })}
                >
                  <option value="">-- Selecione o Setor --</option>
                  {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Equipamento Vinculado</label>
                  <select 
                    className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white text-sm outline-none focus:border-blue-500" 
                    value={formEdicao.equipamento_id} 
                    onChange={e => setFormEdicao({ ...formEdicao, equipamento_id: e.target.value })}
                  >
                    <option value="">Sem ativo específico</option>
                    {equipamentos
                      .filter(eq => !formEdicao.setor_id || String(eq.setor_id) === String(formEdicao.setor_id))
                      .map(eq => (
                        <option key={eq.id} value={eq.id}>[{eq.patrimonio || 'S/P'}] {eq.nome}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Prioridade</label>
                  <select 
                    className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white text-sm outline-none focus:border-blue-500" 
                    value={formEdicao.prioridade} 
                    onChange={e => setFormEdicao({ ...formEdicao, prioridade: e.target.value })}
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Assunto do Chamado *</label>
                <input 
                  type="text" 
                  className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500" 
                  required 
                  value={formEdicao.titulo} 
                  onChange={e => setFormEdicao({ ...formEdicao, titulo: e.target.value })} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Relato Descritivo do Problema *</label>
                <textarea 
                  className="w-full border-2 border-slate-100 p-3 rounded-xl h-28 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 resize-none" 
                  required 
                  value={formEdicao.descricao_problema} 
                  onChange={e => setFormEdicao({ ...formEdicao, descricao_problema: e.target.value })} 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setModalEditarAberta(false)} 
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 py-3.5 rounded-2xl font-black text-xs uppercase transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-100 transition-all active:scale-[0.98]"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: OBSERVAÇÃO COORDENADOR */}
      {modalObsAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-dark">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-cyan-500 p-5 text-white font-black flex justify-between items-center text-lg uppercase">
              <span>Histórico da Coordenação</span>
              <button type="button" onClick={() => setModalObsAberta(false)} className="text-2xl">✕</button>
            </div>
            <form onSubmit={salvarObs} className="p-8">
              <div className="mb-6">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Histórico Anterior:</label>
                <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 h-48 overflow-y-auto text-sm text-slate-600 whitespace-pre-wrap font-medium shadow-inner">
                  {chamadoSelecionado?.observacao_coordenador || "Sem registros anteriores."}
                </div>
              </div>
              <div className="mb-6">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Nova Anotação:</label>
                <textarea required className="w-full border-2 border-slate-100 rounded-2xl p-4 h-32 focus:border-cyan-400 outline-none transition-all resize-none text-sm font-medium text-dark" placeholder="Escreva a nota..." value={textoObs} onChange={e => setTextoObs(e.target.value)} />
              </div>
              <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl uppercase tracking-widest transition-all">ADICIONAR NOTA</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO CHAMADO */}
      {modalAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-dark">
          <form onSubmit={enviarChamado} className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="bg-amber-500 p-5 text-white font-black flex justify-between items-center text-lg uppercase">
              <span>📣 Nova Solicitação</span>
              <button type="button" onClick={() => { setModalAberta(false); setFotoAbertura(null); }} className="text-xl text-white">✕</button>
            </div>
            <div className="p-6 sm:p-8 space-y-4 max-h-[85vh] overflow-y-auto">
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Setor Solicitante</label>
                <select 
                  required 
                  className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white text-sm outline-none focus:border-amber-400" 
                  value={form.setor_id} 
                  onChange={e => setForm({...form, setor_id: e.target.value, equipamento_id: ''})}
                >
                  <option value="">-- Selecione o Setor --</option>
                  {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Equipamento (Opcional)</label>
                <select 
                  className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white text-sm outline-none focus:border-amber-400" 
                  value={form.equipamento_id} 
                  onChange={e => setForm({...form, equipamento_id: e.target.value})}
                >
                  <option value="">Sem equipamento específico</option>
                  {equipamentos.filter(eq => String(eq.setor_id) === String(form.setor_id)).map(eq => (
                    <option key={eq.id} value={eq.id}>[{eq.patrimonio || 'S/P'}] {eq.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Assunto do Chamado</label>
                <input 
                  type="text" 
                  placeholder="Ex: Vazamento no ar-condicionado, Computador não liga..." 
                  className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-amber-400" 
                  required 
                  value={form.titulo} 
                  onChange={e => setForm({...form, titulo: e.target.value})} 
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Foto ou Evidência do Problema
                </label>

                <input 
                  ref={fileInputCameraRef}
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFotoAbertura(e.target.files[0]);
                    }
                  }} 
                />
                <input 
                  ref={fileInputGaleriaRef}
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFotoAbertura(e.target.files[0]);
                    }
                  }} 
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputCameraRef.current?.click()}
                    className="flex items-center justify-center gap-2 p-3 bg-white border-2 border-slate-200 hover:border-amber-400 rounded-xl text-xs font-black uppercase text-slate-700 shadow-sm active:scale-95 transition-all"
                  >
                    <span className="text-base">📸</span> Tirar Foto
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputGaleriaRef.current?.click()}
                    className="flex items-center justify-center gap-2 p-3 bg-white border-2 border-slate-200 hover:border-amber-400 rounded-xl text-xs font-black uppercase text-slate-700 shadow-sm active:scale-95 transition-all"
                  >
                    <span className="text-base">📁</span> Galeria/Arquivo
                  </button>
                </div>

                {fotoAbertura && (
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <img 
                        src={URL.createObjectURL(fotoAbertura)} 
                        alt="Preview" 
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" 
                      />
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[180px]">
                        {fotoAbertura.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFotoAbertura(null)}
                      className="text-xs text-rose-500 font-black hover:text-rose-700 px-2 py-1"
                    >
                      Remover ✕
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Descrição do Problema</label>
                <textarea 
                  placeholder="Descreva com detalhes o que aconteceu..." 
                  className="w-full border-2 border-slate-100 p-3 rounded-xl h-24 text-sm font-medium text-slate-700 outline-none focus:border-amber-400 resize-none" 
                  required 
                  value={form.descricao_problema} 
                  onChange={e => setForm({...form, descricao_problema: e.target.value})} 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setModalAberta(false); setFotoAbertura(null); }} 
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 py-3.5 rounded-2xl font-black text-xs uppercase transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-amber-100 uppercase tracking-wider transition-all active:scale-[0.98]"
                >
                  Abrir Chamado
                </button>
              </div>

            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Chamados;