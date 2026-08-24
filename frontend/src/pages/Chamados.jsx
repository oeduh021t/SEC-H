import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

const Chamados = ({ user: userProp }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [chamados, setChamados] = useState([]);
  const [setores, setSetores] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);

  // Gatilho de tempo para atualizar os cronômetros a cada minuto em tempo real
  const [agora, setAgora] = useState(new Date());

  // --- RESGATE DE USUÁRIO ---
  const [user] = useState(() => {
    if (userProp) return userProp;
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  // Modais
  const [modalAberta, setModalAberta] = useState(false);
  const [modalObsAberta, setModalObsAberta] = useState(false);
  const [modalDetalhesAberta, setModalDetalhesAberta] = useState(false);

  // Filtros e Seleção
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null);

  // Estados para Fotos
  const [fotoAbertura, setFotoAbertura] = useState(null);

  const [form, setForm] = useState({
    setor_id: '', equipamento_id: '', titulo: '',
    descricao_problema: '', prioridade: 'Média', categoria: 'Manutenção'
  });

  const [textoObs, setTextoObs] = useState('');

  const API_URL = 'http://192.168.5.101:3000/api';
  const BASE_URL = 'http://192.168.5.101:3000';

  // Estados para o módulo de Documentos/Auditoria
  const [documentoSelecionado, setDocumentoSelecionado] = useState(null);
  const [listaDocumentos, setListaDocumentos] = useState([]);

  const obterNivelUsuario = () => user?.nivel || '';

  // Atualiza o relógio interno para o cronômetro contar minuto a minuto na tela
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // ⏱️ CÁLCULO DINÂMICO DE TEMPO DECORRIDO / SLA
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

  // Carrega os dados do backend
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

  // 🎯 CAPTURA O ID DA OS VINDO DE OUTRAS TELAS
  useEffect(() => {
    if (location.state?.buscaId) {
      setBusca(String(location.state.buscaId));
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

  // --- LOGICA DE CAPTURA DE CONTEXTO DO PRONTUÁRIO ---
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

  // 🔄 FUNÇÃO DE REABERTURA EXCLUSIVA PARA ADMIN
  const handleReabrirChamado = (id) => {
    const motivo = prompt("Informe a justificativa/motivo para reabrir esta Ordem de Serviço:");
    if (motivo === null) return; // Cancelado
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
    const nivel = user?.nivel?.toLowerCase();
    if (nivel !== 'admin' && nivel !== 'coordenador') {
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
        } else {
            alert("Erro nas permissões.");
        }
    }).catch(err => console.error("Erro ao salvar observação:", err));
  };

  // 🔍 FILTRAGEM
  const filtrados = chamados.filter(c => {
    const isUsuarioComum = user?.nivel?.toLowerCase() === 'usuario';
    if (isUsuarioComum) {
      const pertenceAoUsuario = String(c.usuario_abertura_id) === String(user?.id);
      if (!pertenceAoUsuario) return false;
    }

    const bateStatus = filtroStatus === 'Todos' || c.status === filtroStatus;
    const bateBusca = c.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
                      c.id?.toString().includes(busca) ||
                      c.setor_nome?.toLowerCase().includes(busca.toLowerCase());
    return bateStatus && bateBusca;
  });

  return (
    <div className="p-4 bg-slate-50 min-h-screen font-sans text-dark">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-2xl shadow-sm">
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <span className="bg-amber-100 p-2 rounded-xl text-amber-600">🎫</span>
          CHAMADOS / OS
        </h1>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <select className="border-2 border-slate-100 rounded-xl p-2.5 text-sm font-bold bg-white outline-none" onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="Todos">Todos Status</option>
            <option value="Aberto">🔴 Abertos</option>
            <option value="Em Atendimento">🟡 Em Atendimento</option>
            <option value="Concluído">🟢 Concluídos</option>
          </select>
          
          <input 
            type="text" 
            placeholder="Buscar..." 
            value={busca}
            className="border-2 border-slate-100 rounded-xl p-2.5 w-full md:w-64 outline-none font-bold text-slate-800" 
            onChange={(e) => setBusca(e.target.value)} 
          />

          <button onClick={() => { setForm({ setor_id: '', equipamento_id: '', titulo: '', descricao_problema: '', prioridade: 'Média', categoria: 'Manutenção' }); setModalAberta(true); }} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-black shadow-lg shadow-amber-100 transition-all">+ NOVO CHAMADO</button>
        </div>
      </div>

      {/* GRID CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filtrados.map(c => {
          const sla = calcularTempoSLA(c.data_abertura, c.data_conclusao, c.prioridade);
          const isConcluido = c.status === 'Concluído';
          const isAdmin = user?.nivel?.toLowerCase() === 'admin';

          return (
            <div key={c.id} className={`bg-white rounded-3xl shadow-sm border-l-[12px] flex flex-col h-[520px] overflow-hidden transition-all hover:shadow-xl ${c.status === 'Aberto' ? 'border-red-500' : c.status === 'Em Atendimento' ? 'border-amber-400' : 'border-green-500'}`}>
              <div className="p-6 flex-1 flex flex-col overflow-hidden text-dark">
                
                {/* CABEÇALHO DO CARD COM STATUS, DATAS E SLA */}
                <div className="flex justify-between items-start mb-3">
                  <div className="w-7/12">
                    <h3 className="font-black text-slate-800 text-lg uppercase truncate" title={c.titulo}>{c.titulo}</h3>
                    <div className="text-[11px] text-slate-400 font-black mt-0.5">#{c.id} • {c.setor_nome?.toUpperCase()}</div>
                    <div className="text-[10px] text-slate-500 font-bold mt-1">
                      📅 Aberto: {c.data_abertura ? new Date(c.data_abertura).toLocaleString('pt-BR') : '---'}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 w-5/12">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white uppercase ${c.status === 'Aberto' ? 'bg-red-500' : c.status === 'Em Atendimento' ? 'bg-amber-400' : 'bg-green-500'}`}>
                      {c.status}
                    </span>

                    {/* CONTADOR / CRONÔMETRO DE SLA */}
                    <div className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex flex-col items-end border w-full text-right ${
                      isConcluido
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : sla.atrasado
                          ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      <div className="flex items-center gap-1 justify-end">
                        <span>⏱️</span>
                        <span>{isConcluido ? `Resolvido em: ${sla.texto}` : `Tempo decorrido: ${sla.texto}`}</span>
                      </div>
                      <div className="text-[9px] font-medium opacity-80 mt-0.5">
                        Meta ({c.prioridade || 'Média'}): {sla.metaHoras}h {sla.atrasado ? '⚠️ (Estourou SLA)' : ''}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BARRA DE PROGRESSO DO SLA */}
                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isConcluido 
                        ? 'bg-emerald-500' 
                        : sla.atrasado 
                          ? 'bg-red-500' 
                          : sla.percentual > 75 
                            ? 'bg-amber-500' 
                            : 'bg-blue-500'
                    }`}
                    style={{ width: `${sla.percentual}%` }}
                  />
                </div>

                {c.equip_nome && (
                  <div className="mb-3 p-2 bg-blue-50 rounded-lg border-l-4 border-blue-400 shrink-0">
                    <span className="text-[10px] font-black text-blue-600 uppercase block">Equipamento:</span>
                    <span className="text-xs font-bold text-slate-700">[{c.equip_pat}] {c.equip_nome}</span>
                  </div>
                )}

                {/* BARRA DE AÇÕES DOS CARDS */}
                <div className="flex flex-wrap gap-2 mb-4 shrink-0">
                  <button onClick={() => abrirDetalhes(c.id)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[11px] font-black hover:bg-slate-200">DETALHES</button>

                  {c.status !== 'Concluído' && user?.nivel?.toLowerCase() !== 'usuario' && (
                    <button
                      onClick={() => navigate(`/chamados/${c.id}/tratar`)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[11px] font-black shadow-md transition-transform active:scale-95"
                    >
                      ATENDER
                    </button>
                  )}

                  {/* BOTÃO REABRIR OS: Exclusivo para ADMIN em chamados Concluídos */}
                  {isConcluido && isAdmin && (
                    <button
                      onClick={() => handleReabrirChamado(c.id)}
                      className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[11px] font-black shadow-sm hover:bg-rose-600 hover:text-white transition-all active:scale-95 flex items-center gap-1"
                      title="Reabrir este chamado encerrado"
                    >
                      🔄 REABRIR OS
                    </button>
                  )}

                  {user?.nivel?.toLowerCase() !== 'usuario' && (
                    <Link
                      to={`/chamados/${c.id}/imprimir`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[11px] font-black shadow-md hover:bg-slate-950 transition-all active:scale-95 flex items-center justify-center"
                    >
                      🖨️ IMPRIMIR OS
                    </Link>
                  )}

                  {(user?.nivel === 'admin' || user?.nivel === 'coordenador') && (
                    <button onClick={() => { setChamadoSelecionado(c); setTextoObs(''); setModalObsAberta(true); }} className="px-4 py-2 bg-cyan-500 text-white rounded-xl text-[11px] font-black shadow-md italic">OBS. COORDENAÇÃO</button>
                  )}
                </div>

                <div className="bg-slate-50 rounded-2xl border-2 border-slate-100 flex flex-col shadow-inner overflow-hidden flex-1">
                  <div className="bg-slate-200/50 px-4 py-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b shrink-0">Histórico da Coordenação:</div>
                  <div className="p-4 text-xs font-medium text-slate-600 overflow-y-auto italic whitespace-pre-wrap leading-relaxed flex-1">
                      {c.observacao_coordenador || "Nenhuma observação registrada."}
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: DETALHES COM RASTREABILIDADE TEMPORAL */}
      {modalDetalhesAberta && chamadoSelecionado && (() => {
        const slaModal = calcularTempoSLA(chamadoSelecionado.data_abertura, chamadoSelecionado.data_conclusao, chamadoSelecionado.prioridade);
        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
              <div className="bg-slate-50 p-5 border-b flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <button onClick={() => setModalDetalhesAberta(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600 text-xs font-black uppercase">← Voltar</button>
                  <h2 className="font-black text-slate-800 text-lg uppercase tracking-tight">Detalhes do Chamado #{chamadoSelecionado.id}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Duração / SLA:</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 font-black text-xs rounded-lg border border-blue-200">
                    ⏱️ {slaModal.texto} (Meta: {slaModal.metaHoras}h)
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-4 space-y-4 text-dark">
                    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
                        <div><label className="text-[10px] font-black text-slate-400 uppercase block">Equipamento</label><p className="font-bold text-slate-700">{chamadoSelecionado.eq_nome || 'N/A'}</p></div>
                        
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase block">Data Abertura:</span>
                            <span className="font-bold text-slate-700">{chamadoSelecionado.data_abertura ? new Date(chamadoSelecionado.data_abertura).toLocaleString('pt-BR') : '---'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase block">Data Fechamento:</span>
                            <span className="font-bold text-slate-700">{chamadoSelecionado.data_conclusao ? new Date(chamadoSelecionado.data_conclusao).toLocaleString('pt-BR') : 'Em Aberto'}</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t space-y-4">
                            {chamadoSelecionado.foto_abertura && (
                                <div>
                                    <label className="text-[10px] font-black text-blue-500 uppercase block mb-1">Foto Abertura:</label>
                                    <img src={`${BASE_URL}${chamadoSelecionado.foto_abertura}`} className="rounded-xl border w-full h-32 object-cover cursor-pointer hover:opacity-80" onClick={() => window.open(`${BASE_URL}${chamadoSelecionado.foto_abertura}`)} alt="Foto Abertura" />
                                </div>
                            )}
                            {chamadoSelecionado.foto_conclusao && (
                                <div>
                                    <label className="text-[10px] font-black text-green-500 uppercase block mb-1">Foto Conclusão:</label>
                                    <img src={`${BASE_URL}${chamadoSelecionado.foto_conclusao}`} className="rounded-xl border w-full h-32 object-cover cursor-pointer hover:opacity-80" onClick={() => window.open(`${BASE_URL}${chamadoSelecionado.foto_conclusao}`)} alt="Foto Conclusão" />
                                </div>
                            )}

                            {/* BLOCO DE DOCUMENTOS E AUDITORIA */}
                            <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100 space-y-4">
                              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <span>📎</span> Arquivos e Laudos (Auditoria)
                              </h4>
                              
                              <form onSubmit={handleUploadDocumento} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                                <label className="block text-[9px] font-black text-slate-400 uppercase">Anexar Novo Documento (PDF/Imagem)</label>
                                <input 
                                  type="file" 
                                  accept="image/*,application/pdf" 
                                  className="text-xs w-full block file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300" 
                                  onChange={(e) => setDocumentoSelecionado(e.target.files[0])} 
                                />
                                <button type="submit" className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase transition-all">
                                  Firmar Anexo no Histórico
                                </button>
                              </form>

                              <div className="space-y-2 max-h-48 overflow-y-auto pt-2">
                                <label className="block text-[9px] font-black text-slate-400 uppercase border-b pb-1">Documentos Arquivados:</label>
                                {listaDocumentos.map((doc) => (
                                  <div key={doc.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1 text-[11px]">
                                    <div className="flex justify-between items-start gap-1">
                                      <span className="font-bold text-slate-700 truncate block max-w-[180px]" title={doc.nome_original}>
                                        {doc.tipo_mimetype.includes('pdf') ? '📄' : '📷'} {doc.nome_original}
                                      </span>
                                      <a 
                                        href={`${BASE_URL}${doc.url_arquivo}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-blue-600 font-black hover:underline shrink-0 text-[10px]"
                                      >
                                        ABRIR
                                      </a>
                                    </div>
                                    <div className="text-[9px] text-slate-400 leading-tight">
                                      Enviado em: <strong>{new Date(doc.data_upload).toLocaleString('pt-BR')}</strong> <br />
                                      Por: <strong>{doc.usuario_nome}</strong>
                                    </div>
                                  </div>
                                ))}
                                {listaDocumentos.length === 0 && (
                                  <p className="text-[11px] text-slate-400 italic text-center py-2">Nenhum laudo ou documento anexado.</p>
                                )}
                              </div>
                            </div>
                            
                        </div>
                    </div>
                  </div>
                  <div className="lg:col-span-8 space-y-4">
                      <div className="bg-white rounded-2xl shadow-sm p-6">
                          <h6 className="text-blue-600 font-black text-xs uppercase mb-3">Problema Reportado:</h6>
                          <div className="bg-slate-50 border rounded-2xl p-4 text-slate-700 mb-6">{chamadoSelecionado.descricao_problema}</div>
                          <h6 className="font-black text-slate-400 text-[10px] uppercase border-b pb-2 mb-4">Histórico</h6>
                          <div className="space-y-4">
                              {chamadoSelecionado.historico?.map((h, i) => (
                                  <div key={i} className="border-b last:border-0 pb-4">
                                      <div className="flex justify-between text-[10px] mb-1 font-black uppercase text-slate-400">
                                          <span>{h.tecnico_nome}</span>
                                          <span>{new Date(h.data_registro).toLocaleString()}</span>
                                      </div>
                                      <p className="text-xs text-slate-600 italic">{h.texto_historico}</p>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
          <form onSubmit={enviarChamado} className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
            <div className="bg-amber-500 p-5 text-white font-black flex justify-between items-center text-lg uppercase">
              <span>📣 Nova Solicitação</span>
              <button type="button" onClick={() => setModalAberta(false)} className="text-xl text-white">✕</button>
            </div>
            <div className="p-8 space-y-4">
              <select required className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white" value={form.setor_id} onChange={e => setForm({...form, setor_id: e.target.value, equipamento_id: ''})}>
                <option value="">-- Selecione o Setor --</option>
                {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              <select className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white" value={form.equipamento_id} onChange={e => setForm({...form, equipamento_id: e.target.value})}>
                <option value="">Equipamento (Opcional)</option>
                {equipamentos.filter(eq => String(eq.setor_id) === String(form.setor_id)).map(eq => (
                  <option key={eq.id} value={eq.id}>[{eq.patrimonio}] {eq.nome}</option>
                ))}
              </select>
              <input type="text" placeholder="Assunto" className="w-full border-2 border-slate-100 p-3 rounded-xl" required value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} />
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Anexar Foto do Problema</label>
                  <input type="file" accept="image/*" className="text-xs w-full" onChange={(e) => setFotoAbertura(e.target.files[0])} />
              </div>
              <textarea placeholder="Relato do problema..." className="w-full border-2 border-slate-100 p-3 rounded-xl h-24" required value={form.descricao_problema} onChange={e => setForm({...form, descricao_problema: e.target.value})} />
              <div className="flex gap-3">
                <button type="button" onClick={() => {setModalAberta(false); setFotoAbertura(null);}} className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black text-xs uppercase">Cancelar</button>
                <button type="submit" className="flex-[2] bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl uppercase transition-all">ABRIR CHAMADO</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Chamados;