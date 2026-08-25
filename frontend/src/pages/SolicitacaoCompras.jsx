import { useEffect, useState } from 'react';

const SolicitacaoCompras = () => {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [setores, setSetores] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [itemExpandidoId, setItemExpandidoId] = useState(null);

  // Modal de Nova / Editar Solicitação
  const [modalNova, setModalNova] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [setorId, setSetorId] = useState('');
  const [fornecedorId, setFornecedorId] = useState(''); 
  const [equipamentoId, setEquipamentoId] = useState('');
  const [urgencia, setUrgencia] = useState('Média');
  const [motivo, setMotivo] = useState('');
  
  // Lista dinâmica de itens
  const [itens, setItens] = useState([{ descricao: '', quantidade: 1, valor_estimado: 0 }]);

  // Objeto para Impressão
  const [solicitacaoImpressao, setSolicitacaoImpressao] = useState(null);

  const API_URL = 'http://192.168.5.101:3000/api';

  const obterUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  };

  const carregarDados = async () => {
    try {
      const headers = { 'x-usuario-nivel': obterUsuario()?.nivel || '' };
      const [resSol, resSet, resEq, resForn] = await Promise.all([
        fetch(`${API_URL}/solicitacoes-compra`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/setores`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/equipamentos`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/fornecedores`, { headers }).then(r => r.json()) 
      ]);

      setSolicitacoes(resSol || []);
      setSetores(resSet || []);
      setEquipamentos(resEq || []);
      setFornecedores(resForn || []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarDados(); }, []);

  const handleAbrirNova = () => {
    setEditandoId(null);
    setSetorId('');
    setFornecedorId('');
    setEquipamentoId('');
    setUrgencia('Média');
    setMotivo('');
    setItens([{ descricao: '', quantidade: 1, valor_estimado: 0 }]);
    setModalNova(true);
  };

  const handleAbrirEdicao = async (solicitacao) => {
    try {
      const headers = { 'x-usuario-nivel': obterUsuario()?.nivel || '' };
      const res = await fetch(`${API_URL}/solicitacoes-compra/${solicitacao.id}`, { headers });
      const data = await res.json();

      setEditandoId(data.id);
      setSetorId(data.setor_id || '');
      setFornecedorId(data.fornecedor_id || '');
      setEquipamentoId(data.equipamento_id || '');
      setUrgencia(data.urgencia || 'Média');
      setMotivo(data.motivo || '');
      setItens(data.itens && data.itens.length > 0 ? data.itens : [{ descricao: '', quantidade: 1, valor_estimado: 0 }]);
      setModalNova(true);
    } catch (err) {
      alert("Erro ao carregar dados para edição.");
    }
  };

  const handleAdicionarItem = () => {
    setItens([...itens, { descricao: '', quantidade: 1, valor_estimado: 0 }]);
  };

  const handleRemoverItem = (index) => {
    if (itens.length === 1) return;
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const novosItens = [...itens];
    novosItens[index][field] = value;
    setItens(novosItens);
  };

  const handleSalvarSolicitacao = async (e) => {
    e.preventDefault();
    const user = obterUsuario();

    const payload = {
      solicitante_id: user?.id,
      setor_id: setorId || null,
      fornecedor_id: fornecedorId || null, 
      equipamento_id: equipamentoId || null,
      urgencia,
      motivo,
      itens
    };

    const url = editandoId 
      ? `${API_URL}/solicitacoes-compra/${editandoId}` 
      : `${API_URL}/solicitacoes-compra`;

    const method = editandoId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': user?.nivel || ''
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(editandoId ? "Solicitação atualizada com sucesso! 🛒✏️" : "Solicitação gerada com sucesso! 🛒📋");
        setModalNova(false);
        carregarDados();
      } else {
        const err = await res.json();
        alert("Erro: " + (err.error || "Falha ao salvar."));
      }
    } catch (err) {
      console.error(err);
      alert("Erro de conexão ao salvar solicitação.");
    }
  };

  const handleAlterarStatus = async (id, novoStatus) => {
    const user = obterUsuario();
    try {
      const res = await fetch(`${API_URL}/solicitacoes-compra/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': user?.nivel || ''
        },
        body: JSON.stringify({ status: novoStatus, usuario_id: user?.id })
      });

      if (res.ok) {
        carregarDados();
      } else {
        alert("Não foi possível alterar o status.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm("🚨 Deseja cancelar/excluir esta solicitação de compra permanentemente?")) return;

    try {
      const res = await fetch(`${API_URL}/solicitacoes-compra/${id}`, {
        method: 'DELETE',
        headers: { 'x-usuario-nivel': obterUsuario()?.nivel || '' }
      });

      if (res.ok) {
        alert("Solicitação removida com sucesso.");
        carregarDados();
      }
    } catch (err) {
      alert("Erro ao excluir solicitação.");
    }
  };

  const handleImprimir = async (id) => {
    const res = await fetch(`${API_URL}/solicitacoes-compra/${id}`, {
      headers: { 'x-usuario-nivel': obterUsuario()?.nivel || '' }
    });
    const data = await res.json();
    setSolicitacaoImpressao(data);
    setTimeout(() => window.print(), 300);
  };

  const solicitacoesFiltradas = solicitacoes.filter(s => {
    const t = busca.toLowerCase();
    const bateBusca = (
      (s.solicitante_nome && s.solicitante_nome.toLowerCase().includes(t)) ||
      (s.setor_nome && s.setor_nome.toLowerCase().includes(t)) ||
      (s.fornecedor_nome && s.fornecedor_nome.toLowerCase().includes(t)) ||
      (s.equipamento_nome && s.equipamento_nome.toLowerCase().includes(t)) ||
      (s.motivo && s.motivo.toLowerCase().includes(t)) ||
      String(s.id).includes(t)
    );
    const bateStatus = filtroStatus === 'Todos' || s.status === filtroStatus;
    return bateBusca && bateStatus;
  });

  const totalGeralEstimado = solicitacoes.reduce((acc, s) => acc + Number(s.valor_total_calculado || 0), 0);
  const totalPendentes = solicitacoes.filter(s => s.status === 'Pendente').length;
  const totalComprados = solicitacoes.filter(s => s.status === 'Comprado' || s.status === 'Entregue').length;

  // Cálculo dinâmico do subtotal no modal
  const subtotalModal = itens.reduce((acc, it) => acc + (Number(it.quantidade || 0) * Number(it.valor_estimado || 0)), 0);

  if (loading) return <div className="p-10 text-center font-bold text-slate-400">Carregando solicitações de compras...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">

      {/* ESTILO DE IMPRESSÃO DA REQUISIÇÃO A4 */}
      <style>{`
        @media print {
          body * { visibility: hidden; background: white !important; }
          #documento-impressao, #documento-impressao * { visibility: visible; }
          #documento-impressao { position: absolute; left: 0; top: 0; width: 100%; padding: 10px; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      {/* HEADER */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <span className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-md shadow-blue-200 text-base">🛒</span> 
            SOLICITAÇÃO & REQUISIÇÃO DE COMPRAS
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Clínica Materno Infantil Domingos Lourenço</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="🔍 Buscar solicitação, setor, fornecedor ou ativo..."
            className="p-3 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none bg-slate-50 w-full sm:w-80 focus:border-blue-500 focus:bg-white transition-all text-slate-800"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <button
            onClick={handleAbrirNova}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all text-xs uppercase flex items-center gap-2"
          >
            <span>+</span> Nova Solicitação
          </button>
        </div>
      </div>

      {/* PAINEL DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total de Pedidos</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-800">{solicitacoes.length}</span>
            <span className="text-xs font-bold text-slate-400">Pedidos registrados</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Pendentes de Aprovação</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-500">{totalPendentes}</span>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl">Aguardando</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Investimento Estimado</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">R$ {totalGeralEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl">{totalComprados} Concluídos</span>
          </div>
        </div>
      </div>

      {/* FILTROS RÁPIDOS POR STATUS */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {['Todos', 'Pendente', 'Aprovado', 'Comprado', 'Entregue', 'Negado'].map(st => (
          <button
            key={st}
            onClick={() => setFiltroStatus(st)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              filtroStatus === st 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-100'
            }`}
          >
            {st === 'Todos' ? '📂 Todos' : st === 'Pendente' ? '🟡 Pendentes' : st === 'Aprovado' ? '🔵 Aprovados' : st === 'Comprado' ? '📦 Comprados' : st === 'Entregue' ? '🟢 Entregues' : '🔴 Negados'}
          </button>
        ))}
      </div>

      {/* TABELA DE SOLICITAÇÕES */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="p-5">Nº / Data</th>
              <th className="p-5">Solicitante / Setor</th>
              <th className="p-5">Fornecedor Sugerido</th>
              <th className="p-5">Valor Estimado</th>
              <th className="p-5">Urgência</th>
              <th className="p-5">Status (Dar Baixa)</th>
              <th className="p-5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs">
            {solicitacoesFiltradas.map(s => (
              <>
                <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-5">
                    <span className="font-mono font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl">#{s.id}</span>
                    <div className="text-[10px] text-slate-400 font-bold mt-1.5">
                      {new Date(s.data_solicitacao).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="font-black text-slate-700 uppercase">{s.solicitante_nome}</div>
                    <div className="text-[10px] text-blue-600 font-bold uppercase mt-0.5">{s.setor_nome || 'Setor Geral'}</div>
                    {s.motivo && (
                      <p className="text-[10px] text-slate-400 italic line-clamp-1 mt-1 font-medium" title={s.motivo}>
                        📝 {s.motivo}
                      </p>
                    )}
                  </td>
                  <td className="p-5 font-bold text-slate-700">
                    {s.fornecedor_nome ? (
                      <span className="text-slate-800">🚚 {s.fornecedor_nome}</span>
                    ) : (
                      <span className="text-slate-400 font-normal italic">A definir / Cotação</span>
                    )}
                    {s.equipamento_nome && (
                      <div className="text-[10px] text-blue-600 font-bold mt-0.5">⚙️ {s.equipamento_nome}</div>
                    )}
                  </td>
                  <td className="p-5 font-black text-slate-800">
                    <div>R$ {Number(s.valor_total_calculado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <button 
                      onClick={() => setItemExpandidoId(itemExpandidoId === s.id ? null : s.id)}
                      className="text-[10px] text-blue-500 hover:text-blue-700 font-bold mt-1 flex items-center gap-1"
                    >
                      <span>{s.total_itens || 1} item(ns)</span>
                      <span>{itemExpandidoId === s.id ? '▲ fechar' : '▼ ver itens'}</span>
                    </button>
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      s.urgencia === 'Crítica' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                      s.urgencia === 'Alta' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {s.urgencia}
                    </span>
                  </td>
                  
                  {/* SELECT DINÂMICO PARA BAIXA E MUDANÇA DE STATUS */}
                  <td className="p-5">
                    <select
                      value={s.status}
                      onChange={e => handleAlterarStatus(s.id, e.target.value)}
                      className={`p-2 rounded-xl text-[10px] font-black uppercase outline-none border cursor-pointer transition-all shadow-sm ${
                        s.status === 'Entregue' || s.status === 'Comprado' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                        s.status === 'Aprovado' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                        s.status === 'Negado' ? 'bg-rose-50 text-rose-800 border-rose-300' : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      <option value="Pendente">🟡 Pendente</option>
                      <option value="Aprovado">🔵 Aprovado</option>
                      <option value="Comprado">📦 Comprado</option>
                      <option value="Entregue">🟢 Entregue / Baixado</option>
                      <option value="Negado">🔴 Negado / Cancelado</option>
                    </select>
                  </td>

                  <td className="p-5 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => handleAbrirEdicao(s)}
                        className="p-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-xl font-bold text-xs transition-all"
                        title="Editar Solicitação"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleImprimir(s.id)}
                        className="p-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-xl font-bold text-xs transition-all"
                        title="Imprimir Requisição"
                      >
                        🖨️
                      </button>
                      <button
                        onClick={() => handleExcluir(s.id)}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-all"
                        title="Excluir Solicitação"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>

                {/* ACCORDION EXPANSÍVEL: VISUALIZAÇÃO RÁPIDA DOS ITENS */}
                {itemExpandidoId === s.id && (
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <td colSpan="7" className="p-4 pl-14">
                      <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm max-w-3xl">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Detalhamento dos Itens da OS #{s.id}</span>
                        <div className="space-y-1.5">
                          {s.itens && s.itens.length > 0 ? (
                            s.itens.map((it, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                                <span className="font-bold text-slate-700">• {it.descricao}</span>
                                <div className="flex gap-4 font-mono">
                                  <span className="text-slate-500 font-bold">{it.quantidade}x</span>
                                  <span className="text-slate-800 font-black">R$ {Number(it.valor_estimado || 0).toFixed(2)}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">Nenhum item listado individualmente.</span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {solicitacoesFiltradas.length === 0 && (
              <tr>
                <td colSpan="7" className="p-10 text-center text-slate-400 font-bold italic">
                  Nenhuma solicitação localizada com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE NOVA / EDITAR SOLICITAÇÃO */}
      {modalNova && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150">
            <div className="bg-blue-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
              <span>{editandoId ? `✏️ Editar Solicitação #${editandoId}` : '🛒 Nova Solicitação de Compra'}</span>
              <button onClick={() => setModalNova(false)} className="text-lg">✕</button>
            </div>

            <form onSubmit={handleSalvarSolicitacao} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Setor Destino</label>
                  <select value={setorId} onChange={e => setSetorId(e.target.value)} className="w-full p-2.5 border-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-blue-500">
                    <option value="">Selecione o Setor...</option>
                    {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Fornecedor (Opcional)</label>
                  <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className="w-full p-2.5 border-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-blue-500">
                    <option value="">Nenhum / A definir</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>🚚 {f.nome_fantasia}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Equipamento (Opcional)</label>
                  <select value={equipamentoId} onChange={e => setEquipamentoId(e.target.value)} className="w-full p-2.5 border-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-blue-500">
                    <option value="">Nenhum ativo específico</option>
                    {equipamentos.map(eq => <option key={eq.id} value={eq.id}>{eq.nome} (PAT: {eq.patrimonio || 'S/P'})</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Urgência</label>
                  <select value={urgencia} onChange={e => setUrgencia(e.target.value)} className="w-full p-2.5 border-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-blue-500">
                    <option value="Baixa">🟢 Baixa</option>
                    <option value="Média">🟡 Média</option>
                    <option value="Alta">🟠 Alta</option>
                    <option value="Crítica">🔴 Crítica</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Justificativa / Motivo da Compra *</label>
                <textarea required rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full p-3 border-2 rounded-xl text-xs bg-slate-50 font-medium text-slate-800 outline-none focus:border-blue-500" placeholder="Ex: Detergente Zenit para higienização de ar-condicionado..." />
              </div>

              {/* LISTA DINÂMICA DE ITENS COM TOTAL AUTOMÁTICO */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Itens da Solicitação</span>
                  <button type="button" onClick={handleAdicionarItem} className="text-xs font-black text-blue-600 hover:underline">+ Adicionar Item</button>
                </div>

                {itens.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      required
                      placeholder="Descrição do item ou peça..."
                      className="flex-[3] p-2.5 border-2 rounded-xl text-xs font-bold bg-white text-slate-800 outline-none focus:border-blue-500"
                      value={item.descricao}
                      onChange={e => handleItemChange(index, 'descricao', e.target.value)}
                    />
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="Qtd"
                      className="w-20 p-2.5 border-2 rounded-xl text-xs font-bold text-center bg-white text-slate-800 outline-none focus:border-blue-500"
                      value={item.quantidade}
                      onChange={e => handleItemChange(index, 'quantidade', e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Val. Est. R$"
                      className="w-32 p-2.5 border-2 rounded-xl text-xs font-bold bg-white text-slate-800 outline-none focus:border-blue-500"
                      value={item.valor_estimado}
                      onChange={e => handleItemChange(index, 'valor_estimado', e.target.value)}
                    />
                    {itens.length > 1 && (
                      <button type="button" onClick={() => handleRemoverItem(index)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg font-black transition-all">✕</button>
                    )}
                  </div>
                ))}

                <div className="pt-2 border-t flex justify-between items-center text-xs font-black text-slate-700">
                  <span>Total Estimado do Pedido:</span>
                  <span className="text-sm font-black text-emerald-600 font-mono">
                    R$ {subtotalModal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalNova(false)} className="flex-1 bg-slate-100 py-3 rounded-2xl font-black text-xs uppercase text-slate-600 hover:bg-slate-200 transition-all">Cancelar</button>
                <button type="submit" className="flex-[2] bg-blue-600 text-white py-3 rounded-2xl font-black text-xs uppercase shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">
                  {editandoId ? 'Atualizar Solicitação' : 'Gerar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BLOCO PARA IMPRESSÃO A4 */}
      {solicitacaoImpressao && (
        <div id="documento-impressao" className="hidden print:block font-sans text-slate-900 bg-white p-4">
          <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-center">
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight">CLÍNICA MATERNO INFANTIL DOMINGOS LOURENÇO</h1>
              <p className="text-xs font-bold text-slate-600 uppercase">Setor de Engenharia Clínica & Infraestrutura — Requisição de Compras</p>
            </div>
            <div className="text-right">
              <span className="text-base font-mono font-black border border-slate-900 px-2 py-1 rounded">REQUISIÇÃO Nº #{solicitacaoImpressao.id}</span>
              <p className="text-xs font-bold text-slate-500 mt-1">{new Date(solicitacaoImpressao.data_solicitacao).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs mb-6 border-2 border-slate-200 p-4 rounded-xl bg-slate-50/50">
            <div><strong>Solicitante:</strong> {solicitacaoImpressao.solicitante_nome}</div>
            <div><strong>Setor Alvo:</strong> {solicitacaoImpressao.setor_nome || 'Geral'}</div>
            <div><strong>Fornecedor Sugerido:</strong> {solicitacaoImpressao.fornecedor_nome || 'A definir / Licitação'}</div>
            <div><strong>Urgência:</strong> <span className="uppercase font-bold">{solicitacaoImpressao.urgencia}</span></div>
            <div className="col-span-2"><strong>Ativo Vinculado:</strong> {solicitacaoImpressao.equipamento_nome ? `${solicitacaoImpressao.equipamento_nome} (PAT: ${solicitacaoImpressao.equipamento_patrimonio || 'S/P'})` : 'Nenhum'}</div>
            <div className="col-span-2 border-t pt-2 mt-1"><strong>Motivo / Justificativa:</strong> {solicitacaoImpressao.motivo}</div>
          </div>

          <h3 className="text-xs font-black uppercase mb-2">Itens Solicitados</h3>
          <table className="w-full text-xs border-collapse border border-slate-300 mb-8">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 p-2 text-left">Item / Descrição</th>
                <th className="border border-slate-300 p-2 text-center w-16">Qtd</th>
                <th className="border border-slate-300 p-2 text-right w-28">Val. Est. Un.</th>
                <th className="border border-slate-300 p-2 text-right w-28">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {solicitacaoImpressao.itens?.map((it, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-300 p-2 font-bold">{it.descricao}</td>
                  <td className="border border-slate-300 p-2 text-center">{it.quantidade}</td>
                  <td className="border border-slate-300 p-2 text-right">R$ {Number(it.valor_estimado).toFixed(2)}</td>
                  <td className="border border-slate-300 p-2 text-right font-bold">R$ {(it.quantidade * it.valor_estimado).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-12 text-center mt-24 pt-4 max-w-2xl mx-auto">
            <div>
              <p className="border-t-2 border-slate-800 pt-1 font-bold">_______________________</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Gestor da Área / Coordenação</p>
              <p className="text-[9px] text-slate-400">Visto de Aprovação</p>
            </div>
            <div>
              <p className="border-t-2 border-slate-800 pt-1 font-bold">_______________________</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Diretoria / Financeiro</p>
              <p className="text-[9px] text-slate-400">Autorização de Compra</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolicitacaoCompras;