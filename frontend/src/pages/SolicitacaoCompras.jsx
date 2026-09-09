import { useEffect, useState, Fragment } from 'react';

const SolicitacaoCompras = () => {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [setores, setSetores] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]); 
  const [notasFiscais, setNotasFiscais] = useState([]); 
  const [catalogoInsumos, setCatalogoInsumos] = useState([]);
  const [orcamentosExternos, setOrcamentosExternos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [itemExpandidoId, setItemExpandidoId] = useState(null);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 10;

  // Modal de Nova / Editar Solicitação
  const [modalNova, setModalNova] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [setorId, setSetorId] = useState('');
  const [fornecedorId, setFornecedorId] = useState(''); 
  const [equipamentoId, setEquipamentoId] = useState('');
  const [notaFiscalId, setNotaFiscalId] = useState('');
  const [orcamentoExternoId, setOrcamentoExternoId] = useState('');
  const [urgencia, setUrgencia] = useState('Média');
  const [motivo, setMotivo] = useState('');
  const [arquivosCotacao, setArquivosCotacao] = useState([]);
  const [anexosExistentes, setAnexosExistentes] = useState([]);

  // Modal de Baixa / Fechamento de Compra
  const [modalBaixaAberta, setModalBaixaAberta] = useState(false);
  const [dadosBaixa, setDadosBaixa] = useState({
    id: null,
    status: '',
    valor_real: '',
    nota_fiscal_numero: '',
    alimentar_estoque: true
  });
  
  // Lista dinâmica de itens
  const [itens, setItens] = useState([{ insumo_id: '', descricao: '', quantidade: 1, valor_estimado: 0 }]);

  // Objeto para Impressão
  const [solicitacaoImpressao, setSolicitacaoImpressao] = useState(null);

  const API_URL = '/api';
  const BASE_URL = '';

  const obterUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  };

  const carregarDados = async () => {
    try {
      const headers = { 'x-usuario-nivel': obterUsuario()?.nivel || '' };
      const [resSol, resSet, resEq, resForn, resNf, resIns, resOrc] = await Promise.all([
        fetch(`${API_URL}/solicitacoes-compra`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/setores`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/equipamentos`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/fornecedores`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/notas-fiscais`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/itens-estoque`, { headers }).then(r => r.json()).catch(() => []),
        fetch(`${API_URL}/orcamentos-externos`, { headers }).then(r => r.json()).catch(() => [])
      ]);

      setSolicitacoes(Array.isArray(resSol) ? resSol : []);
      setSetores(Array.isArray(resSet) ? resSet : []);
      setEquipamentos(Array.isArray(resEq) ? resEq : []);
      setFornecedores(Array.isArray(resForn) ? resForn : []);
      setNotasFiscais(Array.isArray(resNf) ? resNf : []);
      setCatalogoInsumos(Array.isArray(resIns) ? resIns : []);
      setOrcamentosExternos(Array.isArray(resOrc) ? resOrc : []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarDados(); }, []);

  const carregarAnexosSolicitacao = async (solId) => {
    try {
      const headers = { 'x-usuario-nivel': obterUsuario()?.nivel || '' };
      const res = await fetch(`${API_URL}/solicitacoes-compra/${solId}/anexos`, { headers });
      if (res.ok) {
        const dados = await res.json();
        setAnexosExistentes(dados || []);
      }
    } catch (e) {
      console.error("Erro ao buscar anexos:", e);
    }
  };

  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const res = await fetch(`${API_URL}/relatorios/exportar/solicitacoes-compra`, {
        headers: { 'x-usuario-nivel': obterUsuario()?.nivel || '' }
      });

      if (!res.ok) throw new Error("Falha ao gerar arquivo Excel.");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `solicitacoes_compras_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert("Erro ao exportar Excel: " + err.message);
    } finally {
      setExportando(false);
    }
  };

  const handleAbrirNova = () => {
    setEditandoId(null);
    setSetorId('');
    setFornecedorId('');
    setEquipamentoId('');
    setNotaFiscalId('');
    setOrcamentoExternoId('');
    setUrgencia('Média');
    setMotivo('');
    setArquivosCotacao([]);
    setAnexosExistentes([]);
    setItens([{ insumo_id: '', descricao: '', quantidade: 1, valor_estimado: 0 }]);
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
      setNotaFiscalId(data.nota_fiscal_id || '');
      setOrcamentoExternoId(data.orcamento_externo_id || '');
      setUrgencia(data.urgencia || 'Média');
      setMotivo(data.motivo || '');
      setItens(data.itens && data.itens.length > 0 ? data.itens : [{ insumo_id: '', descricao: '', quantidade: 1, valor_estimado: 0 }]);
      setArquivosCotacao([]);
      carregarAnexosSolicitacao(data.id);
      setModalNova(true);
    } catch (err) {
      alert("Erro ao carregar dados para edição.");
    }
  };

  const handleAdicionarItem = () => {
    setItens([...itens, { insumo_id: '', descricao: '', quantidade: 1, valor_estimado: 0 }]);
  };

  const handleRemoverItem = (index) => {
    if (itens.length === 1) return;
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const novosItens = [...itens];
    novosItens[index][field] = value;
    
    if (field === 'insumo_id' && value) {
      const insumo = catalogoInsumos.find(i => String(i.id) === String(value));
      if (insumo) {
        novosItens[index].descricao = insumo.nome;
        novosItens[index].valor_estimado = Number(insumo.valor_unitario || 0);
      }
    }

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
      nota_fiscal_id: notaFiscalId || null,
      orcamento_externo_id: orcamentoExternoId || null,
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

      const dataRes = await res.json();

      if (res.ok) {
        const idFinal = editandoId || dataRes.id;

        if (arquivosCotacao.length > 0 && idFinal) {
          const formDataAnexos = new FormData();
          Array.from(arquivosCotacao).forEach(file => {
            formDataAnexos.append('arquivos', file);
          });

          await fetch(`${API_URL}/solicitacoes-compra/${idFinal}/anexos`, {
            method: 'POST',
            headers: { 'x-usuario-nivel': user?.nivel || '' },
            body: formDataAnexos
          });
        }

        alert(editandoId ? "Solicitação e cotações atualizadas com sucesso! 🛒✏️" : "Solicitação gerada com comprovantes anexados! 🛒📋");
        setModalNova(false);
        carregarDados();
      } else {
        alert("Erro: " + (dataRes.error || "Falha ao salvar."));
      }
    } catch (err) {
      console.error(err);
      alert("Erro de conexão ao salvar solicitação.");
    }
  };

  const handleExcluirAnexo = async (anexoId) => {
    if (!window.confirm("Deseja remover este anexo de cotação?")) return;
    try {
      const headers = { 'x-usuario-nivel': obterUsuario()?.nivel || '' };
      const res = await fetch(`${API_URL}/solicitacoes-compra/anexos/${anexoId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setAnexosExistentes(prev => prev.filter(a => a.id !== anexoId));
      }
    } catch (e) {
      alert("Erro ao excluir anexo.");
    }
  };

  const handleAlterarStatus = (id, novoStatus) => {
    if (novoStatus === 'Comprado' || novoStatus === 'Entregue') {
      const solicitacaoAtual = solicitacoes.find(s => s.id === id);
      setDadosBaixa({
        id,
        status: novoStatus,
        valor_real: solicitacaoAtual?.valor_real || solicitacaoAtual?.valor_total_calculado || '',
        nota_fiscal_numero: solicitacaoAtual?.nota_fiscal_numero || '',
        alimentar_estoque: true
      });
      setModalBaixaAberta(true);
      return;
    }

    executarAlteracaoStatus(id, novoStatus, {});
  };

  const executarAlteracaoStatus = async (id, status, extras = {}) => {
    const user = obterUsuario();
    try {
      const res = await fetch(`${API_URL}/solicitacoes-compra/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': user?.nivel || ''
        },
        body: JSON.stringify({ status, usuario_id: user?.id, ...extras })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) alert(data.message);
        setModalBaixaAberta(false);
        carregarDados();
      } else {
        alert("Não foi possível alterar o status.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de conexão.");
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

  const renderizarMotivoComLinks = (texto) => {
    if (!texto) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const partes = texto.split(urlRegex);

    return partes.map((parte, i) => {
      if (parte.match(urlRegex)) {
        return (
          <a
            key={i}
            href={parte}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 font-bold underline inline-flex items-center gap-0.5 ml-1"
            title={parte}
          >
            🔗 Abrir Link
          </a>
        );
      }
      return parte;
    });
  };

  const solicitacoesFiltradas = solicitacoes.filter(s => {
    const t = busca.toLowerCase();
    const bateBusca = (
      (s.solicitante_nome && s.solicitante_nome.toLowerCase().includes(t)) ||
      (s.setor_nome && s.setor_nome.toLowerCase().includes(t)) ||
      (s.fornecedor_nome && s.fornecedor_nome.toLowerCase().includes(t)) ||
      (s.equipamento_nome && s.equipamento_nome.toLowerCase().includes(t)) ||
      (s.motivo && s.motivo.toLowerCase().includes(t)) ||
      (s.nota_fiscal_numero && s.nota_fiscal_numero.toLowerCase().includes(t)) ||
      String(s.id).includes(t)
    );
    const bateStatus = filtroStatus === 'Todos' || s.status === filtroStatus;
    return bateBusca && bateStatus;
  });

  const totalGeralEstimado = solicitacoes.reduce((acc, s) => acc + Number(s.valor_total_calculado || 0), 0);
  const totalPendentes = solicitacoes.filter(s => s.status === 'Pendente').length;
  const totalComprados = solicitacoes.filter(s => s.status === 'Comprado' || s.status === 'Entregue').length;

  const subtotalModal = itens.reduce((acc, it) => acc + (Number(it.quantidade || 0) * Number(String(it.valor_estimado || 0).replace(',', '.'))), 0);

  const totalPaginas = Math.ceil(solicitacoesFiltradas.length / itensPorPagina) || 1;
  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const solicitacoesPaginadas = solicitacoesFiltradas.slice(indexInicio, indexInicio + itensPorPagina);

  if (loading) return <div className="p-10 text-center font-bold text-slate-400 uppercase text-xs animate-pulse">Carregando solicitações de compras...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #documento-impressao, #documento-impressao * { visibility: visible; }
          #documento-impressao { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            background: white !important;
          }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      {/* HEADER */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row justify-between md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5">
            <span className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-md shadow-blue-200 text-base">🛒</span> 
            SOLICITAÇÃO & REQUISIÇÃO DE COMPRAS
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Hospital Domingos Lourenço — Engenharia & Suprimentos</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="🔍 Buscar solicitação, setor, fornecedor, ativo ou NF..."
            className="p-3 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none bg-slate-50 w-full sm:w-80 focus:border-blue-500 focus:bg-white transition-all text-slate-800"
            value={busca}
            onChange={e => { setBusca(e.target.value); setPaginaAtual(1); }}
          />

          <button
            onClick={handleExportarExcel}
            disabled={exportando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50"
            title="Exportar requisições em planilha"
          >
            <span>📊</span> {exportando ? "..." : "Exportar Excel"}
          </button>

          <button
            onClick={handleAbrirNova}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all text-xs uppercase flex items-center gap-2"
          >
            <span>+</span> Nova Solicitação
          </button>
        </div>
      </div>

      {/* PAINEL DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 print:hidden">
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
      <div className="flex flex-wrap gap-2 mb-4 items-center print:hidden">
        {['Todos', 'Pendente', 'Aprovado', 'Comprado', 'Entregue', 'Negado'].map(st => (
          <button
            key={st}
            onClick={() => { setFiltroStatus(st); setPaginaAtual(1); }}
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
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="p-5">Nº / Data</th>
                <th className="p-5">Solicitante / Setor</th>
                <th className="p-5">Fornecedor / NF & Boletos</th>
                <th className="p-5">Valores (Est. vs Real)</th>
                <th className="p-5">Urgência</th>
                <th className="p-5">Status (Dar Baixa)</th>
                <th className="p-5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {solicitacoesPaginadas.map(s => (
                <Fragment key={s.id}>
                  <tr className={`hover:bg-slate-50/60 transition-colors ${itemExpandidoId === s.id ? 'bg-blue-50/30' : ''}`}>
                    {/* Coluna 1: Nº e Data */}
                    <td className="p-5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl">#{s.id}</span>
                        {s.chamado_id && (
                          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg" title="Gerado a partir de Ordem de Serviço">
                            OS #{s.chamado_id}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold mt-1.5">
                        {new Date(s.data_solicitacao).toLocaleDateString('pt-BR')}
                      </div>
                    </td>

                    {/* Coluna 2: Solicitante / Setor */}
                    <td className="p-5">
                      <div className="font-black text-slate-700 uppercase">{s.solicitante_nome}</div>
                      <div className="text-[10px] text-blue-600 font-bold uppercase mt-0.5">{s.setor_nome || 'Setor Geral'}</div>
                      {s.motivo && (
                        <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 font-medium" title={s.motivo}>
                          📝 {renderizarMotivoComLinks(s.motivo)}
                        </p>
                      )}
                    </td>

                    {/* Coluna 3: Fornecedor / NF & Boletos (FASE 3 ATUALIZADA) */}
                    <td className="p-5 font-bold text-slate-700">
                      {s.fornecedor_nome ? (
                        <span className="text-slate-800">🚚 {s.fornecedor_nome}</span>
                      ) : (
                        <span className="text-slate-400 font-normal italic">A definir / Cotação</span>
                      )}

                      {s.nota_fiscal_numero && (
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center gap-1 text-[11px] text-slate-700 font-bold">
                            <span>📄 NF #{s.nota_fiscal_numero}</span>
                            {s.nf_url_danfe && (
                              <a
                                href={`${BASE_URL}${s.nf_url_danfe}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-[10px]"
                                title="Abrir DANFE da Nota"
                              >
                                ↗
                              </a>
                            )}
                          </div>

                          {/* Indicador de Situação Financeira dos Boletos */}
                          {s.total_boletos > 0 ? (
                            s.boletos_atrasados > 0 ? (
                              <span className="inline-flex items-center text-[9px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md uppercase w-max border border-rose-200 animate-pulse">
                                🚨 Boleto Atrasado ({s.boletos_atrasados})
                              </span>
                            ) : s.boletos_vencendo_breve > 0 ? (
                              <span className="inline-flex items-center text-[9px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md uppercase w-max border border-amber-200">
                                ⏳ Vence em Breve ({s.proximo_vencimento_boleto ? new Date(s.proximo_vencimento_boleto).toLocaleDateString('pt-BR') : ''})
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md uppercase w-max border border-emerald-200">
                                ✓ Boletos em Dia / Quitado
                              </span>
                            )
                          ) : s.nota_fiscal_id ? (
                            <span className="text-[9px] text-slate-400 font-semibold italic">
                              Sem boletos vinculados
                            </span>
                          ) : null}
                        </div>
                      )}

                      {s.equipamento_nome && (
                        <div className="text-[10px] text-blue-600 font-bold mt-1">⚙️ {s.equipamento_nome}</div>
                      )}
                    </td>

                    {/* Coluna 4: Valores */}
                    <td className="p-5 font-black text-slate-800">
                      <div className="text-slate-700">Est: R$ {Number(s.valor_total_calculado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      {s.valor_real && Number(s.valor_real) > 0 && (
                        <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
                          Real: R$ {Number(s.valor_real).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          if (itemExpandidoId === s.id) {
                            setItemExpandidoId(null);
                          } else {
                            setItemExpandidoId(s.id);
                            carregarAnexosSolicitacao(s.id);
                          }
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold mt-1.5 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg"
                      >
                        <span>{s.total_itens || (s.itens?.length) || 1} item(ns)</span>
                        <span>{itemExpandidoId === s.id ? '▲ fechar' : '▼ detalhes & cotações'}</span>
                      </button>
                    </td>

                    {/* Coluna 5: Urgência */}
                    <td className="p-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        s.urgencia === 'Crítica' ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse' :
                        s.urgencia === 'Alta' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {s.urgencia}
                      </span>
                    </td>
                    
                    {/* Coluna 6: Select de Baixa */}
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

                    {/* Coluna 7: Ações */}
                    <td className="p-5 text-center">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => handleAbrirEdicao(s)}
                          className="p-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-xl font-bold text-xs transition-all"
                          title="Editar Solicitação / Ver Cotações"
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

                  {/* 🔽 ACORDEÃO EXPANSÍVEL: ITENS + COTAÇÕES + RESUMO FINANCEIRO (FASE 3) */}
                  {itemExpandidoId === s.id && (
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <td colSpan="7" className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          
                          {/* TABELA DE ITENS */}
                          <div className="lg:col-span-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-inner">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                📦 Itens da Solicitação #{s.id}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">
                                Total: {s.itens?.length || 0} linha(s)
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                                    <th className="py-2">Item / Peça</th>
                                    <th className="py-2 text-center">Tipo Almoxarifado</th>
                                    <th className="py-2 text-center">Qtd</th>
                                    <th className="py-2 text-right">Valor Est. Un.</th>
                                    <th className="py-2 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {s.itens && s.itens.length > 0 ? (
                                    s.itens.map((it, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        <td className="py-2 font-bold text-slate-800">{it.descricao}</td>
                                        <td className="py-2 text-center">
                                          {it.insumo_id ? (
                                            <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-md uppercase">
                                              ✓ Vinculado
                                            </span>
                                          ) : (
                                            <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase">
                                              Avulso
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 text-center font-black text-slate-700">{it.quantidade} un.</td>
                                        <td className="py-2 text-right font-mono text-slate-600">
                                          R$ {Number(it.valor_estimado || 0).toFixed(2)}
                                        </td>
                                        <td className="py-2 text-right font-mono font-bold text-slate-800">
                                          R$ {(Number(it.quantidade || 0) * Number(it.valor_estimado || 0)).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan="5" className="py-4 text-center text-slate-400 italic">
                                        Nenhum item discriminado.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* COLUNA LATERAL: COTAÇÕES + DADOS FINANCEIROS */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-inner flex flex-col justify-between space-y-4">
                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">
                                📎 Cotações & Propostas Anexadas
                              </span>

                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {anexosExistentes.map(anexo => (
                                  <div key={anexo.id} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-700 truncate max-w-[150px]" title={anexo.nome_original || anexo.arquivo_nome}>
                                      📄 {anexo.nome_original || 'Cotação'}
                                    </span>
                                    <a
                                      href={`${BASE_URL}${anexo.arquivo_nome}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all"
                                    >
                                      Abrir ↗
                                    </a>
                                  </div>
                                ))}

                                {anexosExistentes.length === 0 && (
                                  <p className="text-[11px] text-slate-400 italic py-2 text-center">
                                    Nenhum documento anexado.
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* RESUMO FINANCEIRO SE HOUVER NF VINCULADA (FASE 3) */}
                            {s.nota_fiscal_numero && (
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                                <span className="text-[10px] font-black uppercase text-slate-500 block border-b pb-1">
                                  💰 Posição Financeira da Compra
                                </span>
                                <div className="flex justify-between text-slate-700">
                                  <span>Faturado NF:</span>
                                  <strong className="font-mono text-emerald-700">
                                    R$ {Number(s.nf_valor_total || s.valor_real || 0).toFixed(2)}
                                  </strong>
                                </div>
                                <div className="flex justify-between text-slate-700">
                                  <span>Boletos Gerados:</span>
                                  <strong>{s.total_boletos || 0} parcela(s)</strong>
                                </div>
                                {s.proximo_vencimento_boleto && (
                                  <div className="flex justify-between text-slate-700">
                                    <span>Próximo Vencimento:</span>
                                    <strong className="text-amber-700">
                                      {new Date(s.proximo_vencimento_boleto).toLocaleDateString('pt-BR')}
                                    </strong>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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

        {/* PAGINAÇÃO */}
        {solicitacoesFiltradas.length > 0 && (
          <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-[11px] font-bold text-slate-400">
              Exibindo <strong>{solicitacoesPaginadas.length}</strong> de <strong>{solicitacoesFiltradas.length}</strong> requisições
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                disabled={paginaAtual === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs font-black text-slate-700 px-2">
                {paginaAtual} / {totalPaginas}
              </span>
              <button
                onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                disabled={paginaAtual === totalPaginas}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE NOVA / EDITAR SOLICITAÇÃO COM UPLOAD DE COTAÇÕES */}
      {modalNova && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
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
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Fornecedor Sugerido</label>
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
                <textarea required rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full p-3 border-2 rounded-xl text-xs bg-slate-50 font-medium text-slate-800 outline-none focus:border-blue-500" placeholder="Ex: Aquisição de peças para ar-condicionado dos leitos..." />
              </div>

              {/* VÍNCULOS OPCIONAIS: NOTA FISCAL OU ORÇAMENTO EXTERNO FORMAL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 border-2 rounded-2xl">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Vincular Orçamento Externo (Opcional)</label>
                  <select 
                    value={orcamentoExternoId} 
                    onChange={e => setOrcamentoExternoId(e.target.value)} 
                    className="w-full p-2.5 border-2 rounded-xl text-xs font-bold bg-white text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="">Nenhum orçamento vinculado</option>
                    {orcamentosExternos.map(orc => (
                      <option key={orc.id} value={orc.id}>
                        📑 {orc.codigo_orcamento} — R$ {Number(orc.valor_total || 0).toFixed(2)} ({orc.fornecedor_nome})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Vincular Nota Fiscal Existente (Opcional)</label>
                  <select 
                    value={notaFiscalId} 
                    onChange={e => setNotaFiscalId(e.target.value)} 
                    className="w-full p-2.5 border-2 rounded-xl text-xs font-bold bg-white text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="">Nenhuma nota vinculada</option>
                    {notasFiscais.map(nf => (
                      <option key={nf.id} value={nf.id}>
                        📄 NF #{nf.numero_nf} — R$ {Number(nf.valor_total || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* UPLOAD DE COTAÇÕES / ARQUIVOS (FASE 2) */}
              <div className="p-4 bg-slate-50 border-2 rounded-2xl space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase block">
                  📎 Anexar Cotações / Orçamentos / Fotos (PDF, Imagens)
                </label>
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  onChange={e => setArquivosCotacao(e.target.files)}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />

                {/* Lista de anexos que já foram salvos anteriormente */}
                {anexosExistentes.length > 0 && (
                  <div className="pt-2 border-t mt-2 space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Arquivos já salvos nesta solicitação:</span>
                    {anexosExistentes.map(anexo => (
                      <div key={anexo.id} className="flex justify-between items-center bg-white p-2 rounded-lg border text-xs">
                        <span className="font-bold text-slate-700 truncate max-w-[280px]">
                          📄 {anexo.nome_original || anexo.arquivo_nome}
                        </span>
                        <div className="flex gap-2">
                          <a href={`${BASE_URL}${anexo.arquivo_nome}`} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">Ver ↗</a>
                          <button type="button" onClick={() => handleExcluirAnexo(anexo.id)} className="text-rose-500 font-bold hover:underline">Excluir ✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* LISTA DINÂMICA DE ITENS COM BUSCA NO ALMOXARIFADO */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Itens da Solicitação</span>
                    <span className="text-[9px] text-slate-400">Selecione do Almoxarifado para auto-preencher ou digite manualmente</span>
                  </div>
                  <button type="button" onClick={handleAdicionarItem} className="text-xs font-black text-blue-600 hover:underline">+ Adicionar Item</button>
                </div>

                {itens.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-white p-3 rounded-xl border border-slate-200">
                    {catalogoInsumos.length > 0 && (
                      <select
                        value={item.insumo_id || ''}
                        onChange={e => handleItemChange(index, 'insumo_id', e.target.value)}
                        className="w-full sm:w-48 p-2 border rounded-lg text-[11px] font-bold bg-slate-50 text-slate-700 outline-none focus:border-blue-500"
                      >
                        <option value="">Item Avulso / Manual</option>
                        {catalogoInsumos.map(ins => (
                          <option key={ins.id} value={ins.id}>
                            📦 {ins.nome} (Saldo: {ins.quantidade || 0})
                          </option>
                        ))}
                      </select>
                    )}

                    <input
                      type="text"
                      required
                      placeholder="Descrição da peça ou insumo..."
                      className="flex-1 p-2 border rounded-lg text-xs font-bold bg-white text-slate-800 outline-none focus:border-blue-500 w-full"
                      value={item.descricao}
                      onChange={e => handleItemChange(index, 'descricao', e.target.value)}
                    />

                    <div className="flex gap-2 w-full sm:w-auto items-center">
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Qtd"
                        className="w-16 p-2 border rounded-lg text-xs font-bold text-center bg-white text-slate-800 outline-none focus:border-blue-500"
                        value={item.quantidade}
                        onChange={e => handleItemChange(index, 'quantidade', e.target.value)}
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="R$ Est."
                        className="w-24 p-2 border rounded-lg text-xs font-bold bg-white text-slate-800 outline-none focus:border-blue-500 font-mono"
                        value={item.valor_estimado}
                        onChange={e => handleItemChange(index, 'valor_estimado', e.target.value)}
                      />
                      {itens.length > 1 && (
                        <button type="button" onClick={() => handleRemoverItem(index)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg font-black transition-all">✕</button>
                      )}
                    </div>
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

      {/* MODAL DE BAIXA: VÍNCULO DE NF, VALOR REAL E ALIMENTAÇÃO DO ESTOQUE */}
      {modalBaixaAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150">
            <div className="bg-emerald-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
              <span>📦 Fechamento & Baixa de Pedido (#{dadosBaixa.id})</span>
              <button onClick={() => setModalBaixaAberta(false)} className="text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                Você está alterando o status para <strong className="text-slate-800 uppercase">{dadosBaixa.status}</strong>. Informe os dados fiscais e reais de compra:
              </p>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Número da Nota Fiscal (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: 0582136"
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-emerald-500"
                  value={dadosBaixa.nota_fiscal_numero}
                  onChange={e => setDadosBaixa({ ...dadosBaixa, nota_fiscal_numero: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Valor Real Pago (R$) (Opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 outline-none focus:border-emerald-500 font-mono"
                  value={dadosBaixa.valor_real}
                  onChange={e => setDadosBaixa({ ...dadosBaixa, valor_real: e.target.value })}
                />
              </div>

              <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="checkEstoque"
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  checked={dadosBaixa.alimentar_estoque}
                  onChange={e => setDadosBaixa({ ...dadosBaixa, alimentar_estoque: e.target.checked })}
                />
                <label htmlFor="checkEstoque" className="text-xs font-bold text-emerald-900 cursor-pointer">
                  Creditar peças vinculadas no Almoxarifado automaticamente
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalBaixaAberta(false)}
                  className="flex-1 bg-slate-100 py-3 rounded-2xl font-black text-xs uppercase text-slate-600 hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => executarAlteracaoStatus(dadosBaixa.id, dadosBaixa.status, {
                    nota_fiscal_numero: dadosBaixa.nota_fiscal_numero || null,
                    valor_real: dadosBaixa.valor_real || null,
                    alimentar_estoque: dadosBaixa.alimentar_estoque
                  })}
                  className="flex-[2] bg-emerald-600 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  Salvar & Concluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLOCO PARA IMPRESSÃO A4 */}
      {solicitacaoImpressao && (
        <div id="documento-impressao" className="hidden print:block font-sans text-slate-900 bg-white p-4">
          <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-center">
            <div>
              <h1 className="text-base font-black uppercase tracking-tight">HOSPITAL DOMINGOS LOURENÇO</h1>
              <p className="text-[10px] font-bold text-slate-600 uppercase">Setor de Engenharia Clínica & Infraestrutura — Requisição de Compras</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-mono font-black border border-slate-900 px-2 py-0.5 rounded">REQUISIÇÃO Nº #{solicitacaoImpressao.id}</span>
              <p className="text-[10px] font-bold text-slate-500 mt-0.5">{new Date(solicitacaoImpressao.data_solicitacao).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-4 border-2 border-slate-200 p-3 rounded-xl bg-slate-50/50">
            <div><strong>Solicitante:</strong> {solicitacaoImpressao.solicitante_nome}</div>
            <div><strong>Setor Alvo:</strong> {solicitacaoImpressao.setor_nome || 'Geral'}</div>
            <div><strong>Fornecedor Sugerido:</strong> {solicitacaoImpressao.fornecedor_nome || 'A definir / Cotação'}</div>
            <div><strong>Urgência:</strong> <span className="uppercase font-bold">{solicitacaoImpressao.urgencia}</span></div>
            <div className="col-span-2"><strong>Ativo Vinculado:</strong> {solicitacaoImpressao.equipamento_nome ? `${solicitacaoImpressao.equipamento_nome} (PAT: ${solicitacaoImpressao.equipamento_patrimonio || 'S/P'})` : 'Nenhum'}</div>
            {solicitacaoImpressao.nota_fiscal_numero && (
              <div className="col-span-2 text-emerald-700 font-bold">
                <strong>Nota Fiscal Vinculada:</strong> #{solicitacaoImpressao.nota_fiscal_numero} 
                {solicitacaoImpressao.nota_fiscal_chave && <span className="font-mono text-[10px] ml-2 font-normal text-slate-600">(Chave: {solicitacaoImpressao.nota_fiscal_chave})</span>}
              </div>
            )}
            <div className="col-span-2 border-t pt-1.5 mt-0.5 break-all"><strong>Motivo / Justificativa:</strong> {solicitacaoImpressao.motivo}</div>
          </div>

          <h3 className="text-xs font-black uppercase mb-1.5">Itens Solicitados</h3>
          <table className="w-full text-xs border-collapse border border-slate-300 mb-6">
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
                  <td className="border border-slate-300 p-2 text-right font-bold">R$ {(Number(it.quantidade) * Number(it.valor_estimado)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-12 text-center mt-16 pt-2 max-w-xl mx-auto">
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