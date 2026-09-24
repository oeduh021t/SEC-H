import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function AuditoriaFornecedor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [listaFornecedores, setListaFornecedores] = useState([]);
  const [fornecedorSelecionadoId, setFornecedorSelecionadoId] = useState(id || '');
  const [dadosAuditoria, setDadosAuditoria] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [exportando, setExportando] = useState(false);

  // Filtros de Data e Navegação
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('saidas');

  // Filtros de Custódia independentes por aba
  const [filtroCustodia, setFiltroCustodia] = useState('todos'); // 'todos' | 'na_rua' | 'retornou'
  const [filtroCustodiaOS, setFiltroCustodiaOS] = useState('todos'); // 'todos' | 'na_rua' | 'retornou'

  const getAuthHeaders = () => {
    let nivel = 'admin';
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u?.nivel) nivel = u.nivel;
      } else {
        nivel = localStorage.getItem('usuario_nivel') || localStorage.getItem('nivel') || 'admin';
      }
    } catch (e) {
      nivel = 'admin';
    }
    return {
      'x-usuario-nivel': String(nivel).toLowerCase().trim(),
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    fetch('/api/fornecedores', { headers: getAuthHeaders() })
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setListaFornecedores(arr);

        if (id) {
          setFornecedorSelecionadoId(String(id));
        } else if (arr.length > 0) {
          setFornecedorSelecionadoId(String(arr[0].id));
        }
      })
      .catch(err => console.error('Erro ao listar fornecedores:', err))
      .finally(() => setCarregandoLista(false));
  }, [id]);

  const carregarExtrato = useCallback(async (fId) => {
    if (!fId || fId === 'undefined') return;
    setCarregando(true);

    try {
      let url = `/api/fornecedores/${fId}/extrato-completo`;
      const params = new URLSearchParams();
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);

      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: getAuthHeaders() });

      if (res.ok) {
        const json = await res.json();
        setDadosAuditoria(json);
      } else {
        setDadosAuditoria(null);
      }
    } catch (err) {
      console.error('Erro ao obter auditoria do fornecedor:', err);
      setDadosAuditoria(null);
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    if (fornecedorSelecionadoId && fornecedorSelecionadoId !== 'undefined') {
      carregarExtrato(fornecedorSelecionadoId);
    }
  }, [fornecedorSelecionadoId, carregarExtrato]);

  const handleMudarFornecedor = (novoId) => {
    setFornecedorSelecionadoId(novoId);
    if (novoId) {
      navigate(`/relatorios/fornecedores/${novoId}`, { replace: true });
    }
  };

  const handleExportarExcel = async () => {
    if (!fornecedorSelecionadoId) return;
    setExportando(true);

    try {
      let url = `/api/relatorios/exportar/fornecedor/${fornecedorSelecionadoId}`;
      const params = new URLSearchParams();
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);

      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: getAuthHeaders() });

      if (!res.ok) throw new Error("Falha ao gerar o arquivo Excel.");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      const nomeLimpo = (fornecedor?.nome_fantasia || fornecedor?.razao_social || 'fornecedor').replace(/\s+/g, '_');
      a.download = `auditoria_${nomeLimpo}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  const fornecedor = dadosAuditoria?.fornecedor;
  const resumo = dadosAuditoria?.resumo_financeiro;
  const chamados = dadosAuditoria?.chamados || [];
  const orcamentos = dadosAuditoria?.orcamentos || [];
  const notas = dadosAuditoria?.notas_fiscais || [];
  const despesas = dadosAuditoria?.despesas_prediais || [];
  const saidasBrutas = dadosAuditoria?.saidas_externas || [];

  // Filtro dinâmico de custódia: Saídas pelo Prontuário
  const saidasFiltradas = saidasBrutas.filter(s => {
    const naRua = s.situacao_custodia === 'Na Rua / Em Manutenção' || ['Em Manutenção', 'Em Manutenção Externa'].includes(s.status_atual_equipamento);
    if (filtroCustodia === 'na_rua') return naRua;
    if (filtroCustodia === 'retornou') return !naRua;
    return true;
  });

  const totalNaRua = saidasBrutas.filter(s => s.situacao_custodia === 'Na Rua / Em Manutenção' || ['Em Manutenção', 'Em Manutenção Externa'].includes(s.status_atual_equipamento)).length;
  const totalRetornados = saidasBrutas.length - totalNaRua;

  // Filtro dinâmico de custódia: Ordens de Serviço
  const chamadosFiltrados = chamados.filter(c => {
    const naRua = c.status === 'Aguardando Externa' || Number(c.em_manutencao_externa) === 1;
    if (filtroCustodiaOS === 'na_rua') return naRua;
    if (filtroCustodiaOS === 'retornou') return !naRua;
    return true;
  });

  const totalOSNaRua = chamados.filter(c => c.status === 'Aguardando Externa' || Number(c.em_manutencao_externa) === 1).length;
  const totalOSRetornadas = chamados.length - totalOSNaRua;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #bloco-impressao-auditoria, #bloco-impressao-auditoria * { visibility: visible !important; }
          #bloco-impressao-auditoria { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 10mm !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Barra de Filtros */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div className="w-full md:w-auto">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
            Auditoria Contábil & Operacional
          </span>
          <div className="mt-2">
            <select
              value={fornecedorSelecionadoId}
              onChange={e => handleMudarFornecedor(e.target.value)}
              className="w-full md:w-80 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="">Selecione um fornecedor...</option>
              {listaFornecedores.map(f => (
                <option key={f.id} value={f.id}>
                  {f.nome_fantasia || f.razao_social}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">De:</label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none text-slate-700"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Até:</label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none text-slate-700"
            />
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleExportarExcel}
              disabled={exportando || !dadosAuditoria}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-100 flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>📊</span> {exportando ? "Gerando..." : "Exportar Excel"}
            </button>

            <button
              onClick={() => window.print()}
              disabled={!dadosAuditoria}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-800 active:scale-95 transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>🖨️</span> Imprimir Dossiê
            </button>
          </div>
        </div>
      </div>

      {carregando && (
        <div className="p-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider animate-pulse no-print">
          Consolidando extrato do fornecedor...
        </div>
      )}

      {!carregando && dadosAuditoria && (
        <div id="bloco-impressao-auditoria" className="space-y-6">
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase">
                {fornecedor?.nome_fantasia || fornecedor?.razao_social}
              </h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                CNPJ: {fornecedor?.cnpj || 'Não informado'} • Contato: {fornecedor?.telefone || '---'} • E-mail: {fornecedor?.email || '---'}
              </p>
            </div>
            <div className="text-[11px] font-bold text-slate-500 font-mono">
              Período: {dataInicio ? new Date(dataInicio).toLocaleDateString('pt-BR') : 'Início'} até {dataFim ? new Date(dataFim).toLocaleDateString('pt-BR') : 'Hoje'}
            </div>
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase block">Total em Chamados / OS</span>
              <p className="text-lg font-black text-slate-800 font-mono mt-1">
                R$ {Number(resumo?.total_gasto_chamados || 0).toFixed(2)}
              </p>
              <div className="flex gap-1.5 mt-0.5 text-[10px] font-bold">
                <span className="text-amber-600">🟡 {totalOSNaRua} na rua</span>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-600">🟢 {totalOSRetornadas} concluídas</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase block">Saídas pelo Prontuário</span>
              <p className="text-lg font-black text-purple-600 font-mono mt-1">
                {saidasBrutas.length} Envios
              </p>
              <div className="flex gap-1.5 mt-0.5 text-[10px] font-bold">
                <span className="text-amber-600">🟡 {totalNaRua} na rua</span>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-600">🟢 {totalRetornados} entregues</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase block">Orçamentos Aprovados</span>
              <p className="text-lg font-black text-emerald-600 font-mono mt-1">
                R$ {Number(resumo?.total_orcamentos_aprovados || 0).toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-400 font-bold">{orcamentos.length} lotes propostos</span>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase block">Notas Fiscais Emitidas</span>
              <p className="text-lg font-black text-blue-600 font-mono mt-1">
                R$ {Number(resumo?.total_notas_fiscais || 0).toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-400 font-bold">{notas.length} NFs registradas</span>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase block">Despesas Prediais</span>
              <p className="text-lg font-black text-amber-600 font-mono mt-1">
                R$ {Number(resumo?.total_despesas_prediais || 0).toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-400 font-bold">{despesas.length} lançamentos</span>
            </div>
          </div>

          {/* Abas */}
          <div className="flex gap-2 overflow-x-auto no-print">
            {[
              { id: 'saidas', label: `Saídas pelo Prontuário (${saidasBrutas.length})` },
              { id: 'chamados', label: `Ordens de Serviço (${chamados.length})` },
              { id: 'orcamentos', label: `Orçamentos & Lotes (${orcamentos.length})` },
              { id: 'notas', label: `Notas Fiscais (${notas.length})` },
              { id: 'despesas', label: `Despesas Prediais (${despesas.length})` }
            ].map(aba => (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all shrink-0 ${
                  abaAtiva === aba.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {aba.label}
              </button>
            ))}
          </div>

          {/* Tabelas de Conteúdo */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            
            {/* ABA: SAÍDAS COM FILTRO DE CUSTÓDIA */}
            {abaAtiva === 'saidas' && (
              <div>
                <div className="p-4 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 no-print">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filtrar Custódia:</span>
                    <button
                      onClick={() => setFiltroCustodia('todos')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        filtroCustodia === 'todos' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Todos ({saidasBrutas.length})
                    </button>
                    <button
                      onClick={() => setFiltroCustodia('na_rua')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        filtroCustodia === 'na_rua' ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      🟡 Ainda na Rua ({totalNaRua})
                    </button>
                    <button
                      onClick={() => setFiltroCustodia('retornou')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        filtroCustodia === 'retornou' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      🟢 Já Retornaram ({totalRetornados})
                    </button>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    Exibindo {saidasFiltradas.length} de {saidasBrutas.length} registros
                  </span>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                    <tr>
                      <th className="p-4">Data/Hora Saída</th>
                      <th className="p-4">Data Retorno</th>
                      <th className="p-4">Equipamento / Ativo</th>
                      <th className="p-4">Setor</th>
                      <th className="p-4 text-center">Custódia / Status</th>
                      <th className="p-4">Técnico</th>
                      <th className="p-4">Detalhes / Motivo da Saída</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {saidasFiltradas.map(s => {
                      const naRua = s.situacao_custodia === 'Na Rua / Em Manutenção' || ['Em Manutenção', 'Em Manutenção Externa'].includes(s.status_atual_equipamento);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="p-4 text-slate-500 font-mono whitespace-nowrap">
                            {new Date(s.data_movimentacao).toLocaleString('pt-BR')}
                          </td>
                          <td className="p-4 text-slate-500 font-mono whitespace-nowrap">
                            {s.data_retorno ? new Date(s.data_retorno).toLocaleString('pt-BR') : <span className="text-amber-500 italic">Pendente</span>}
                          </td>
                          <td className="p-4 font-bold text-slate-800">
                            {s.equipamento_nome} <span className="text-slate-400 font-mono font-normal">(Pat: {s.patrimonio || 'S/P'})</span>
                          </td>
                          <td className="p-4 text-slate-500 font-bold">{s.setor_nome || 'Geral'}</td>
                          <td className="p-4 text-center whitespace-nowrap">
                            {naRua ? (
                              <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Na Rua
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Retornou
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-600 font-bold whitespace-nowrap">{s.tecnico_nome || 'Sistema'}</td>
                          <td className="p-4 text-slate-700 whitespace-pre-wrap">{s.descricao_log}</td>
                        </tr>
                      );
                    })}
                    {saidasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-slate-400 font-bold italic">
                          Nenhum registro encontrado para o filtro selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ABA: CHAMADOS COM FILTRO DE CUSTÓDIA */}
            {abaAtiva === 'chamados' && (
              <div>
                <div className="p-4 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 no-print">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filtrar Custódia:</span>
                    <button
                      onClick={() => setFiltroCustodiaOS('todos')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        filtroCustodiaOS === 'todos' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Todos ({chamados.length})
                    </button>
                    <button
                      onClick={() => setFiltroCustodiaOS('na_rua')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        filtroCustodiaOS === 'na_rua' ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      🟡 Ainda na Rua ({totalOSNaRua})
                    </button>
                    <button
                      onClick={() => setFiltroCustodiaOS('retornou')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        filtroCustodiaOS === 'retornou' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      🟢 Já Retornaram ({totalOSRetornadas})
                    </button>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    Exibindo {chamadosFiltrados.length} de {chamados.length} ordens de serviço
                  </span>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                    <tr>
                      <th className="p-4">OS</th>
                      <th className="p-4">Equipamento / Ativo</th>
                      <th className="p-4">Setor</th>
                      <th className="p-4 text-center">Custódia / Status</th>
                      <th className="p-4">Abertura</th>
                      <th className="p-4 text-right">Custo Serviço</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {chamadosFiltrados.map(ch => {
                      const naRua = ch.status === 'Aguardando Externa' || Number(ch.em_manutencao_externa) === 1;
                      return (
                        <tr key={ch.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-black text-blue-600 font-mono">#{ch.id}</td>
                          <td className="p-4 font-bold text-slate-800">
                            {ch.equipamento_nome || ch.titulo} <span className="text-slate-400 font-mono font-normal">(Pat: {ch.patrimonio || 'S/P'})</span>
                          </td>
                          <td className="p-4 text-slate-500 font-bold">{ch.setor_nome || 'Geral'}</td>
                          <td className="p-4 text-center whitespace-nowrap">
                            {naRua ? (
                              <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Na Rua
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Retornou
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-400 font-mono">
                            {new Date(ch.data_abertura).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-4 text-right font-black font-mono text-emerald-600">
                            R$ {Number(ch.custo_servico || 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                    {chamadosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-6 text-center text-slate-400 font-bold italic">
                          Nenhum chamado vinculado para o filtro selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ABA: ORÇAMENTOS */}
            {abaAtiva === 'orcamentos' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                  <tr>
                    <th className="p-4">Código Lote</th>
                    <th className="p-4">Data Emissão</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orcamentos.map(orc => (
                    <tr key={orc.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-black text-blue-600 font-mono">{orc.codigo_orcamento}</td>
                      <td className="p-4 text-slate-500 font-mono">
                        {new Date(orc.data_emissao).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4 uppercase font-bold text-slate-600">{orc.tipo_orcamento}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          orc.status === 'Aprovado Financeiro' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {orc.status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-black font-mono text-emerald-600">
                        R$ {Number(orc.valor_total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {orcamentos.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-slate-400 font-bold italic">
                        Nenhum orçamento encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* ABA: NOTAS FISCAIS */}
            {abaAtiva === 'notas' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                  <tr>
                    <th className="p-4">Número NF</th>
                    <th className="p-4">Data Emissão</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {notas.map(nf => (
                    <tr key={nf.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-black text-slate-800 font-mono">NF #{nf.numero_nf}</td>
                      <td className="p-4 text-slate-500 font-mono">
                        {new Date(nf.data_emissao).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4 uppercase font-bold text-slate-600">{nf.status}</td>
                      <td className="p-4 text-right font-black font-mono text-blue-600">
                        R$ {Number(nf.valor_total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {notas.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-slate-400 font-bold italic">
                        Nenhuma nota fiscal emitida no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* ABA: DESPESAS PREDIAIS */}
            {abaAtiva === 'despesas' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                  <tr>
                    <th className="p-4">Ref</th>
                    <th className="p-4">Descrição</th>
                    <th className="p-4">Competência</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {despesas.map(dp => (
                    <tr key={dp.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-black text-slate-700 font-mono">{dp.codigo_referencia}</td>
                      <td className="p-4 font-bold text-slate-700">{dp.descricao}</td>
                      <td className="p-4 text-slate-500 font-mono">
                        {new Date(dp.data_competencia).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4 uppercase font-bold text-slate-600">{dp.status_pagamento}</td>
                      <td className="p-4 text-right font-black font-mono text-amber-600">
                        R$ {Number(dp.valor_total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {despesas.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-slate-400 font-bold italic">
                        Nenhuma despesa predial registrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {!carregando && !dadosAuditoria && !carregandoLista && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center text-xs font-bold text-slate-400 italic">
          Nenhum registro localizado para este fornecedor.
        </div>
      )}
    </div>
  );
}