import { useEffect, useState } from 'react';

export function RelatorioEstoqueLocal() {
  const [itens, setItens] = useState([]);
  const [locais, setLocais] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados dos filtros (Padrão 30 dias para as datas)
  const [filtroLocal, setFiltroLocal] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [dataInicio, setDataInicio] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);

  const API_URL = 'http://192.168.5.101:3000/api';

  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  const carregarLocais = async () => {
    try {
      const res = await fetch(`${API_URL}/locais-estoque`, {
        method: 'GET',
        headers: { 'x-usuario-nivel': obterNivelUsuario() }
      });
      const data = await res.json();
      setLocais(data || []);
    } catch (err) {
      console.error("Erro ao carregar locais para filtro:", err);
    }
  };

  const gerarRelatorioConsolidado = () => {
    setLoading(true);
    const urlParams = new URLSearchParams({
      local_estoque_id: filtroLocal,
      tipo_registro: filtroTipo,
      data_inicio: dataInicio,
      data_fim: dataFim
    });

    fetch(`${API_URL}/relatorios/estoque-local?${urlParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-usuario-nivel': obterNivelUsuario()
      }
    })
      .then(res => res.json())
      .then(data => setItens(data || []))
      .catch(err => console.error("Erro ao processar relatório:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregarLocais();
  }, []);

  useEffect(() => {
    gerarRelatorioConsolidado();
  }, [filtroLocal, filtroTipo, dataInicio, dataFim]);

  const totalPecasExibidas = itens.reduce((acc, item) => acc + Number(item.quantidade || 0), 0);
  const capitalInvestidoExibido = itens.reduce((acc, item) => acc + (Number(item.quantidade || 0) * Number(item.valor_unitario || 0)), 0);

  const formatarDataBR = (dataStr) => {
    if (!dataStr) return ""
    const [ano, mes, dia] = dataStr.split("-")
    return `${dia}/${mes}/${ano}`
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* 🖨️ MOTOR DE IMPRESSÃO PROFISSIONAL INTEGRADO (IDÊNTICO AO CUSTOS POR SETOR) */}
      <style>{`
        @media print {
          body * { visibility: hidden; background: white !important; }
          .relatorio-container, .relatorio-container * { visibility: visible; }
          .relatorio-container { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            padding: 0;
            margin: 0;
          }
          .hide-print { display: none !important; }
          
          .indicadores-impressao {
            display: flex !important;
            flex-direction: row !important;
            gap: 10px !important;
            width: 100% !important;
            margin-bottom: 20px !important;
          }
          .indicadores-impressao > div {
            flex: 1 !important;
            border: 1px solid #e2e8f0 !important;
            padding: 10px !important;
            border-radius: 12px !important;
          }
        }
      `}</style>

      {/* Botões Superiores de Controle (Somem na impressão) */}
      <div className="flex gap-2 justify-end mb-6 hide-print">
        <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all active:scale-95">
          🖨️ IMPRIMIR RELATÓRIO
        </button>
      </div>

      {/* PAINEL DE CONTROLE DE FILTROS (Some na impressão) */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 hide-print">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Almoxarifado / Escopo</label>
          <select 
            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none bg-slate-50 font-bold text-xs text-slate-700"
            value={filtroLocal}
            onChange={e => setFiltroLocal(e.target.value)}
          >
            <option value="todos">⭐ Todos os Escopos</option>
            {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Tipo de Registro</label>
          <select 
            className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none bg-slate-50 font-bold text-xs text-slate-700"
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
          >
            <option value="todos">⭐ Equipamentos + Insumos</option>
            <option value="Equipamento">🛠️ Apenas Equipamentos</option>
            <option value="Insumo">📦 Apenas Insumos / Peças</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Data Inicial</label>
          <input type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-black" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Data Final</label>
          <input type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-black" value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
      </div>

      {/* CONTAINER ALVO DA IMPRESSÃO (Envelopa todo o miolo do relatório) */}
      <div className="relatorio-container space-y-6">
        
        {/* CABEÇALHO DO RELATÓRIO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:border-none print:p-0 print:mb-4">
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 print:text-lg">
            SEC-H - RELATÓRIO DE BALANÇO E INVENTÁRIO DE ATIVOS
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider print:text-[10px] print:text-slate-500">
            Período Mapeado: {formatarDataBR(dataInicio)} até {formatarDataBR(dataFim)}
          </p>
        </div>

        {/* CARDS INDICADORES COESOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 indicadores-impressao">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px]">Unidades no Filtro</span>
            <p className="text-xl font-black text-slate-800 mt-1 print:text-sm">{totalPecasExibidas} un.</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px]">Valor do Inventário no Filtro</span>
            <p className="text-xl font-black text-emerald-600 mt-1 print:text-sm">R$ {capitalInvestidoExibido.toFixed(2)}</p>
          </div>
        </div>

        {/* TABELA DE RESULTADOS ANALÍTICOS */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:p-0 print:border-none">
          {loading ? (
            <div className="text-center py-8 font-bold text-xs text-slate-400">Processando balanço...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider print:text-[9px] print:text-slate-700">
                    <th className="pb-3">Descrição / Especificação</th>
                    <th className="pb-3 text-center">Tipo</th>
                    <th className="pb-3">Origem / Estoque</th>
                    <th className="pb-3">Ref / Patr.</th>
                    <th className="pb-3 text-center">Qtd</th>
                    <th className="pb-3 text-right">Preço Unit.</th>
                    <th className="pb-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                  {itens.map((row) => (
                    <tr key={`${row.tipo_registro}-${row.id}-${row.nome}`} className="text-xs hover:bg-slate-50/50 transition-colors print:text-[10px]">
                      <td className="py-3.5 pr-2">
                        <div className="font-black text-slate-700 uppercase tracking-tight">{row.nome}</div>
                        <div className="text-[10px] text-slate-400 font-medium line-clamp-1">{row.descricao || "Sem observações informadas"}</div>
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          row.tipo_registro === 'Equipamento' 
                            ? 'bg-amber-100 text-amber-700 border border-amber-200 print:bg-none print:text-amber-800' 
                            : 'bg-blue-100 text-blue-700 border border-blue-200 print:bg-none print:text-blue-800'
                        }`}>
                          {row.tipo_registro}
                        </span>
                      </td>
                      <td className="py-3.5 font-bold text-slate-500 uppercase text-[10px]">{row.nome_estoque}</td>
                      <td className="py-3.5 font-mono font-bold text-slate-500">
                        {row.referencia && row.referencia !== '---' ? (
                          <span className="bg-slate-100 px-2 py-1 rounded border print:bg-none print:border-none print:p-0">{row.referencia}</span>
                        ) : '---'}
                      </td>
                      <td className="py-3.5 text-center font-bold text-slate-600 bg-slate-50/30 print:bg-none">{row.quantidade} un.</td>
                      <td className="py-3.5 text-right font-mono text-slate-500 font-medium">R$ {Number(row.valor_unitario).toFixed(2)}</td>
                      <td className="py-3.5 text-right font-mono font-black text-slate-800 print:text-slate-900">
                        R$ {(Number(row.quantidade) * Number(row.valor_unitario)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {itens.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-10 text-xs font-bold text-slate-400 italic">Nenhum registro encontrado para este intervalo de filtros.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RODAPÉ EXCLUSIVO DA IMPRESSÃO */}
        <div className="hidden print:block mt-12 pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
          Relatório analítico imobilizado emitido pelo sistema SEC-H Engenharia Clínica em {new Date().toLocaleString('pt-BR')}
        </div>

      </div>
    </div>
  )
}