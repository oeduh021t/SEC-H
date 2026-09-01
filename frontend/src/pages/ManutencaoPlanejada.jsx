import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export function ManutencaoPlanejada({ user: userProp }) {
  const navigate = useNavigate();

  const [user] = useState(() => {
    if (userProp) return userProp;
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [planejadas, setPlanejadas] = useState([]);
  const [alertasHoje, setAlertasHoje] = useState([]);
  const [setores, setSetores] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroSetor, setFiltroSetor] = useState('Todos');
  const [busca, setBusca] = useState('');

  // Modais
  const [modalNovoAberta, setModalNovoAberta] = useState(false);
  const [expandirAlertas, setExpandirAlertas] = useState(true);

  // Form State
  const [form, setForm] = useState({
    titulo: '',
    descricao_planejamento: '',
    tipo: 'Corretiva Programada',
    equipamento_id: '',
    setor_id: '',
    data_programada: '',
    hora_programada: '',
    motivo_janela: '',
    prioridade: 'Média',
    tipo_responsavel: 'Interno',
    tecnico_id: '',
    fornecedor_id: ''
  });

  const API_URL = 'http://192.168.5.101:3000/api';

  const obterHeaders = () => ({
    'Content-Type': 'application/json',
    'x-usuario-nivel': user?.nivel || ''
  });

  const carregarDados = async () => {
    try {
      const headers = obterHeaders();
      const [resPlan, resAlertas, resSetores, resEquips, resTecs, resForn] = await Promise.all([
        fetch(`${API_URL}/manutencoes-planejadas`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/manutencoes-planejadas/alertas-hoje`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/setores`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/equipamentos`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/tecnicos`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/fornecedores`, { headers }).then(r => r.json())
      ]);

      setPlanejadas(resPlan || []);
      setAlertasHoje(resAlertas || []);
      setSetores(resSetores || []);
      setEquipamentos(resEquips || []);
      setTecnicos(resTecs || []);
      setFornecedores(resForn || []);
    } catch (err) {
      console.error("Erro ao carregar dados do planejamento:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleSalvarPlanejamento = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      criado_por_nome: user?.nome || 'Operador'
    };

    try {
      const res = await fetch(`${API_URL}/manutencoes-planejadas`, {
        method: 'POST',
        headers: obterHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert("Manutenção planejada agendada com sucesso! 📅✅");
        setModalNovoAberta(false);
        setForm({
          titulo: '',
          descricao_planejamento: '',
          tipo: 'Corretiva Programada',
          equipamento_id: '',
          setor_id: '',
          data_programada: '',
          hora_programada: '',
          motivo_janela: '',
          prioridade: 'Média',
          tipo_responsavel: 'Interno',
          tecnico_id: '',
          fornecedor_id: ''
        });
        carregarDados();
      } else {
        const errData = await res.json();
        alert(errData.error || "Erro ao salvar agendamento.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de conexão ao salvar.");
    }
  };

  const handleGerarOS = async (id, titulo) => {
    const confirmar = window.confirm(`Deseja iniciar a execução de "${titulo}"? Uma Ordem de Serviço será gerada automaticamente.`);
    if (!confirmar) return;

    try {
      const res = await fetch(`${API_URL}/manutencoes-planejadas/${id}/gerar-os`, {
        method: 'POST',
        headers: obterHeaders(),
        body: JSON.stringify({ usuario_id: user?.id || 1 })
      });

      const data = await res.json();
      if (res.ok && data.chamado_id) {
        alert(`OS #${data.chamado_id} gerada com sucesso! Redirecionando para bancada... 🚀`);
        navigate(`/chamados/${data.chamado_id}/tratar`);
      } else {
        alert(data.error || "Erro ao converter planejamento em OS.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de conexão ao gerar OS.");
    }
  };

  const handleAlterarStatus = async (id, novoStatus) => {
    try {
      const res = await fetch(`${API_URL}/manutencoes-planejadas/${id}/status`, {
        method: 'PATCH',
        headers: obterHeaders(),
        body: JSON.stringify({ status: novoStatus })
      });

      if (res.ok) {
        carregarDados();
      } else {
        alert("Erro ao atualizar status.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtrados = planejadas.filter(p => {
    const bateStatus = filtroStatus === 'Todos' || p.status === filtroStatus;
    const bateSetor = filtroSetor === 'Todos' || String(p.setor_id) === String(filtroSetor);
    const termo = busca.toLowerCase();
    const bateBusca = !busca ||
      p.titulo?.toLowerCase().includes(termo) ||
      p.equipamento_nome?.toLowerCase().includes(termo) ||
      p.equipamento_patrimonio?.toLowerCase().includes(termo) ||
      p.setor_nome?.toLowerCase().includes(termo) ||
      p.motivo_janela?.toLowerCase().includes(termo);

    return bateStatus && bateSetor && bateBusca;
  });

  if (loading) {
    return (
      <div className="p-12 text-center font-black text-slate-400 uppercase text-xs animate-pulse">
        Carregando central de manutenções programadas...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* 🔔 BANNER DE AVISOS DO DIA (HOJE E ATRASADAS) */}
      {alertasHoje.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-5 rounded-3xl shadow-lg border border-amber-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-bounce">🔔</span>
              <div>
                <h4 className="font-black text-base uppercase tracking-wider">
                  {alertasHoje.length} {alertasHoje.length === 1 ? 'Manutenção Programada para Hoje / Pendente' : 'Manutenções Programadas para Hoje / Pendentes'}
                </h4>
                <p className="text-xs text-amber-100 font-medium">
                  Ativos aguardando liberação de leito, janela cirúrgica ou intervenção programada.
                </p>
              </div>
            </div>

            <button
              onClick={() => setExpandirAlertas(!expandirAlertas)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black uppercase transition-all active:scale-95"
            >
              {expandirAlertas ? 'Recolher ▲' : 'Ver Agendamentos ▼'}
            </button>
          </div>

          {expandirAlertas && (
            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {alertasHoje.map((alerta) => (
                <div key={alerta.id} className="bg-white text-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-black px-2 py-0.5 rounded-md uppercase">
                        📍 {alerta.setor_nome || 'Geral'}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {alerta.hora_programada ? `⏰ ${alerta.hora_programada.slice(0, 5)}` : '📅 Hoje'}
                      </span>
                    </div>
                    <h5 className="text-xs font-black uppercase text-slate-800 truncate">{alerta.titulo}</h5>
                    <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                      Ativo: <strong className="text-slate-700">{alerta.equipamento_nome || 'Estrutura'}</strong> (Pat: {alerta.equipamento_patrimonio || 'S/P'})
                    </p>
                    {alerta.motivo_janela && (
                      <p className="text-[10px] text-amber-700 italic mt-1 bg-amber-50 p-1.5 rounded-lg border border-amber-100">
                        📌 {alerta.motivo_janela}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleGerarOS(alerta.id, alerta.titulo)}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span>⚡</span> Iniciar / Gerar OS
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🧭 HEADER DA TELA COM FILTROS E AÇÕES */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2.5">
            <span className="bg-blue-100 text-blue-600 p-2 rounded-2xl text-xl">📅</span>
            Manutenção Planejada & Janelas
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase mt-1">
            Programação de paradas de leitos, preventivas e intervenções definitivas
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full md:w-auto items-center">
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold bg-slate-50 outline-none text-slate-700"
          >
            <option value="Todos">Todos Status</option>
            <option value="Agendado">🟡 Agendados</option>
            <option value="Em Andamento">🔵 Em Andamento</option>
            <option value="Concluído">🟢 Concluídos</option>
            <option value="Cancelado">⚪ Cancelados</option>
          </select>

          <select
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value)}
            className="border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold bg-slate-50 outline-none text-slate-700 max-w-[180px] truncate"
          >
            <option value="Todos">Todos Setores</option>
            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>

          <input
            type="text"
            placeholder="Buscar por ativo, motivo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="border-2 border-slate-100 rounded-xl p-2.5 text-xs font-bold bg-slate-50 outline-none text-slate-800 w-full sm:w-56"
          />

          <button
            onClick={() => setModalNovoAberta(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md shadow-blue-100 active:scale-95"
          >
            + Agendar Manutenção
          </button>
        </div>
      </div>

      {/* 📦 GRID DE CARDS DAS MANUTENÇÕES PLANEJADAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtrados.map((item) => {
          const isAgendado = item.status === 'Agendado';
          const isEmAndamento = item.status === 'Em Andamento';
          const isConcluido = item.status === 'Concluído';

          return (
            <div
              key={item.id}
              className={`bg-white rounded-3xl p-5 shadow-sm border border-slate-100 border-t-8 flex flex-col justify-between transition-all hover:shadow-md ${
                isAgendado ? 'border-t-amber-400' : isEmAndamento ? 'border-t-blue-500' : isConcluido ? 'border-t-green-500' : 'border-t-slate-300'
              }`}
            >
              <div className="space-y-3">
                {/* Header Card */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                      #{item.id} • {item.tipo}
                    </span>
                    <h3 className="text-sm font-black uppercase text-slate-800 truncate mt-1.5" title={item.titulo}>
                      {item.titulo}
                    </h3>
                  </div>

                  <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full text-white ${
                    isAgendado ? 'bg-amber-500' : isEmAndamento ? 'bg-blue-600' : isConcluido ? 'bg-green-600' : 'bg-slate-400'
                  }`}>
                    {item.status}
                  </span>
                </div>

                {/* Info Data e Setor */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600 font-bold text-[11px]">
                    <span>📅 Data: <strong className="text-slate-800">{new Date(item.data_programada).toLocaleDateString('pt-BR')}</strong></span>
                    <span>⏰ Hora: <strong className="text-slate-800">{item.hora_programada ? item.hora_programada.slice(0, 5) : 'A definir'}</strong></span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    📍 Setor: <strong className="text-slate-700">{item.setor_nome || 'Geral'}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    🤖 Ativo: <strong className="text-slate-700">{item.equipamento_nome || 'Infraestrutura'}</strong> (PAT: {item.equipamento_patrimonio || 'S/P'})
                  </p>
                </div>

                {/* Motivo da Janela */}
                {item.motivo_janela && (
                  <div className="p-2.5 bg-amber-50/70 border border-amber-100 rounded-xl text-xs text-amber-900">
                    <span className="text-[9px] font-black uppercase block text-amber-700">Janela / Restrição Operacional:</span>
                    <p className="text-[11px] font-medium leading-relaxed mt-0.5">{item.motivo_janela}</p>
                  </div>
                )}

                {/* Detalhes do Serviço */}
                <p className="text-xs text-slate-600 font-medium line-clamp-2 leading-relaxed whitespace-pre-wrap">
                  {item.descricao_planejamento}
                </p>

                {/* Responsável */}
                <div className="text-[10px] text-slate-400 font-bold">
                  👤 Responsável: <strong className="text-slate-600">
                    {item.tipo_responsavel === 'Externo' ? item.fornecedor_nome || 'Terceirizado' : item.tecnico_nome || 'Equipe Interna'}
                  </strong>
                </div>
              </div>

              {/* Ações do Rodapé */}
              <div className="pt-4 border-t border-slate-100 mt-4 flex flex-wrap gap-2 justify-between items-center">
                {item.chamado_execucao_id ? (
                  <Link
                    to={`/chamados/${item.chamado_execucao_id}/tratar`}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all"
                  >
                    Ver OS #{item.chamado_execucao_id} ↗
                  </Link>
                ) : (
                  isAgendado && (
                    <button
                      onClick={() => handleGerarOS(item.id, item.titulo)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95 flex items-center gap-1"
                    >
                      <span>⚡</span> Gerar OS
                    </button>
                  )
                )}

                {isAgendado && (
                  <button
                    onClick={() => handleAlterarStatus(item.id, 'Cancelado')}
                    className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 mt-4">
          <span className="text-4xl">🗓️</span>
          <h3 className="text-sm font-black uppercase text-slate-700 mt-2">Nenhuma manutenção planejada encontrada</h3>
          <p className="text-xs text-slate-400 mt-1">Crie um novo agendamento ou ajuste os filtros acima.</p>
        </div>
      )}

      {/* 🚀 MODAL: NOVO AGENDAMENTO DE MANUTENÇÃO PLANEJADA */}
      {modalNovoAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSalvarPlanejamento} className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-blue-600 p-5 text-white font-black flex justify-between items-center text-base uppercase shrink-0">
              <span>📅 Agendar Manutenção Planejada / Janela</span>
              <button type="button" onClick={() => setModalNovoAberta(false)} className="text-xl">✕</button>
            </div>

            <div className="p-6 sm:p-8 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Título do Planejamento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Troca de atuador da cama leito 202 pós-alta..."
                  className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-slate-50"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Tipo de Manutenção</label>
                  <select
                    className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-slate-50"
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  >
                    <option value="Corretiva Programada">Corretiva Programada</option>
                    <option value="Preventiva">Preventiva Periódica</option>
                    <option value="Calibração">Calibração / Ajuste</option>
                    <option value="Instalação">Instalação / Infra</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Prioridade</label>
                  <select
                    className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-slate-50"
                    value={form.prioridade}
                    onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Setor Hospitalar</label>
                  <select
                    className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-slate-50"
                    value={form.setor_id}
                    onChange={(e) => setForm({ ...form, setor_id: e.target.value, equipamento_id: '' })}
                  >
                    <option value="">-- Selecione o Setor --</option>
                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Ativo / Equipamento (Opcional)</label>
                  <select
                    className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-slate-50"
                    value={form.equipamento_id}
                    onChange={(e) => setForm({ ...form, equipamento_id: e.target.value })}
                  >
                    <option value="">Sem ativo específico</option>
                    {equipamentos
                      .filter(eq => !form.setor_id || String(eq.setor_id) === String(form.setor_id))
                      .map(eq => (
                        <option key={eq.id} value={eq.id}>[{eq.patrimonio || 'S/P'}] {eq.nome}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Data Programada *</label>
                  <input
                    type="date"
                    required
                    className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-slate-50"
                    value={form.data_programada}
                    onChange={(e) => setForm({ ...form, data_programada: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Horário Previsto (Opcional)</label>
                  <input
                    type="time"
                    className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-slate-50"
                    value={form.hora_programada}
                    onChange={(e) => setForm({ ...form, hora_programada: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Motivo da Janela Operacional (Ex: Desocupação de Leito, Alta, Liberação de Sala)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Paciente com previsão de alta na quinta-feira às 14h..."
                  className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-slate-50"
                  value={form.motivo_janela}
                  onChange={(e) => setForm({ ...form, motivo_janela: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Detalhamento do Serviço a Executar *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva o procedimento definitivo, peças reservadas no almoxarifado..."
                  className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500 bg-slate-50 resize-none"
                  value={form.descricao_planejamento}
                  onChange={(e) => setForm({ ...form, descricao_planejamento: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Tipo de Equipe</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      className={`flex-1 py-2 rounded-lg text-xs font-black uppercase ${form.tipo_responsavel === 'Interno' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                      onClick={() => setForm({ ...form, tipo_responsavel: 'Interno', fornecedor_id: '' })}
                    >
                      Interna
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2 rounded-lg text-xs font-black uppercase ${form.tipo_responsavel === 'Externo' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                      onClick={() => setForm({ ...form, tipo_responsavel: 'Externo', tecnico_id: '' })}
                    >
                      Terceirizada
                    </button>
                  </div>
                </div>

                <div>
                  {form.tipo_responsavel === 'Interno' ? (
                    <>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Técnico Designado</label>
                      <select
                        className="w-full border-2 border-slate-100 p-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-slate-50"
                        value={form.tecnico_id}
                        onChange={(e) => setForm({ ...form, tecnico_id: e.target.value })}
                      >
                        <option value="">A definir</option>
                        {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Empresa Prestadora</label>
                      <select
                        className="w-full border-2 border-slate-100 p-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-slate-50"
                        value={form.fornecedor_id}
                        onChange={(e) => setForm({ ...form, fornecedor_id: e.target.value })}
                      >
                        <option value="">A definir</option>
                        {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia}</option>)}
                      </select>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalNovoAberta(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 py-3.5 rounded-2xl font-black text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-100 active:scale-95"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default ManutencaoPlanejada;