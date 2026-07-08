import { useEffect, useState } from 'react';

export function RelatorioEstoqueLocal() {
  const [itens, setItens] = useState([]);
  const [locais, setLocais] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados dos filtros
  const [filtroLocal, setFiltroLocal] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 🆕 Estado para o novo filtro de tipo
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
      tipo_registro: filtroTipo, // 🆕 Envia o filtro de tipo para a API
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

  // Recarrega automaticamente quando qualquer filtro muda
  useEffect(() => {
    gerarRelatorioConsolidado();
  }, [filtroLocal, filtroTipo, dataInicio, dataFim]);

  const totalPecasExibidas = itens.reduce((acc, item) => acc + Number(item.quantidade || 0), 0);
  const capitalInvestidoExibido = itens.reduce((acc, item) => acc + (Number(item.quantidade || 0) * Number(item.valor_unitario || 0)), 0);

  return (
    <div className="p-4 font-sans text-slate-800">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <span className="bg-blue-100 p-2 rounded-lg text-blue-600 text-sm">📊</span> RELATÓRIO DE BALANÇO DE ATIVOS
        </h1>
        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Balanço consolidado ou segregado de ativos patrimoniais e insumos</p>
      </div>

      {/* FILTROS AVANÇADOS */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="sm:col-span-1">
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

        {/* 🆕 NOVO FILTRO: Escolha entre Equipamento, Insumo ou Ambos */}
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
          <input type="date" className="w-full p-2 border-2 border-slate-100 rounded-xl outline-none bg-slate-50 text-xs font-bold text-black" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Data Final</label>
          <input type="date" className="w-full p-2 border-2 border-slate-100 rounded-xl outline-none bg-slate-50 text-xs font-bold text-black" value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>

        <div className="flex items-end">
          <button onClick={gerarRelatorioConsolidado} className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md">
            🔄 Filtrar
          </button>
        </div>
      </div>

      {/* METRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidades no Filtro</span>
          <span className="text-2xl font-black text-slate-800 mt-1">{totalPecasExibidas} un.</span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor do Inventário no Filtro</span>
          <span className="text-2xl font-black text-green-600 mt-1">R$ {capitalInvestidoExibido.toFixed(2)}</span>
        </div>
      </div>

      {/* TABELA ANALÍTICA */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">Calculando balanço patrimonial...</div>
        ) : itens.length === 0 ? (
          <div className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">Nenhum registro localizado para os filtros selecionados.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
              <tr>
                <th className="p-5">Descrição / Especificação</th>
                <th className="p-5 text-center">Tipo</th>
                <th className="p-5">Origem / Estoque</th>
                <th className="p-5">Ref / Patr.</th>
                <th className="p-5 text-center">Qtd</th>
                <th className="p-5 text-right">Preço Unit.</th>
                <th className="p-5 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {itens.map(row => (
                <tr key={`${row.local_id}-${row.id}-${row.nome}`} className="hover:bg-slate-50/50 transition-colors text-dark">
                  <td className="p-5">
                    <div className="font-black text-slate-700 uppercase tracking-tight">{row.nome}</div>
                    <div className="text-[10px] text-slate-400 font-medium line-clamp-1">{row.descricao || "Sem observações informadas"}</div>
                  </td>
                  <td className="p-5 font-medium">
                    {row.referencia ? (
                      <span className="bg-slate-100 text-slate-600 font-mono font-bold px-2 py-1 rounded text-[10px] border border-slate-200">
                        {row.referencia}
                      </span>
                    ) : (
                      <span className="text-slate-300 italic text-[10px]">---</span>
                    )}
                  </td>
                  <td className="p-5 font-bold text-slate-500 uppercase text-[10px]">{row.nome_estoque}</td>
                  <td className="p-5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      row.tipo_registro === 'Equipamento' 
                        ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}>
                      {row.tipo_registro}
                    </span>
                  </td>
                  <td className="p-5 text-center font-bold text-slate-600 bg-slate-50/30">{row.quantidade} un.</td>
                  <td className="p-5 text-right font-mono text-slate-500 font-medium">R$ {Number(row.valor_unitario).toFixed(2)}</td>
                  <td className="p-5 text-right font-mono font-black text-slate-800">R$ {(Number(row.quantidade) * Number(row.valor_unitario)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}