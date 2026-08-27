import { useEffect, useState } from "react";

export function GestaoEstoque() {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [exportando, setExportando] = useState(false);

  // Formulário Principal (Cadastro/Edição)
  const [itemIdEditando, setItemIdEditando] = useState(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [referencia, setReferencia] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [valorUnitario, setValorUnitario] = useState(0.0);
  const [estoqueMinimo, setEstoqueMinimo] = useState(5);
  const [numNota, setNumNota] = useState("");
  const [localEstoqueId, setLocalEstoqueId] = useState("");
  const [locaisEstoque, setLocaisEstoque] = useState([]);

  // Filtros
  const [filtroLocalId, setFiltroLocalId] = useState("todos");
  const [filtroApenasCriticos, setFiltroApenasCriticos] = useState(false);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 12;

  // Modais de Apoio
  const [modalHistoricoItem, setModalHistoricoItem] = useState(null);
  const [historicoEntradas, setHistoricoEntradas] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Modal de Entrada Rápida
  const [modalEntradaRapida, setModalEntradaRapida] = useState(null);
  const [qtdEntradaRapida, setQtdEntradaRapida] = useState(1);
  const [valorEntradaRapida, setValorEntradaRapida] = useState(0.0);
  const [notaEntradaRapida, setNotaEntradaRapida] = useState("");

  const [modalEtiqueta, setModalEtiqueta] = useState(null);

  const API_URL = "http://192.168.5.101:3000/api";

  const obterNivelUsuario = () => {
    const userLogado = localStorage.getItem("user");
    if (!userLogado) return "ADMIN";
    try {
      const parsed = JSON.parse(userLogado);
      return parsed.nivel || "ADMIN";
    } catch {
      return "ADMIN";
    }
  };

  const carregarEstoque = async () => {
    setLoading(true);
    try {
      const nivelUsuario = obterNivelUsuario();
      const headersComNivel = {
        "Content-Type": "application/json",
        "x-usuario-nivel": nivelUsuario,
      };

      const [resEstoque, resLocais] = await Promise.all([
        fetch(`${API_URL}/estoque`, { method: "GET", headers: headersComNivel }),
        fetch(`${API_URL}/locais-estoque`, { method: "GET", headers: headersComNivel }),
      ]);

      const dataEstoque = await resEstoque.json();
      const dataLocais = await resLocais.json();

      setItens(dataEstoque || []);
      setLocaisEstoque(dataLocais || []);
    } catch (err) {
      console.error("Erro ao carregar almoxarifado:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEstoque();
  }, []);

  const handleSalvarItem = async (e) => {
    e.preventDefault();
    if (!nome) return;

    const nivelUsuario = obterNivelUsuario();

    const payload = {
      nome: nome.trim(),
      descricao: descricao ? descricao.trim() : null,
      quantidade: Number(quantidade),
      valor_unitario: Number(valorUnitario),
      estoque_minimo: Number(estoqueMinimo || 0),
      num_nota: numNota,
      referencia: referencia ? referencia.trim() : null,
      local_estoque_id: localEstoqueId ? Number(localEstoqueId) : null,
    };

    try {
      const url = itemIdEditando ? `${API_URL}/estoque/${itemIdEditando}` : `${API_URL}/estoque`;
      const metodo = itemIdEditando ? "PUT" : "POST";

      const res = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          "x-usuario-nivel": nivelUsuario,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert(itemIdEditando ? "Insumo atualizado com sucesso! ✏️" : "Item cadastrado no estoque! 📦");
        limparFormulario();
        carregarEstoque();
      } else {
        alert("Erro ao salvar o item.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAbrirEntradaRapida = (item) => {
    setModalEntradaRapida(item);
    setQtdEntradaRapida(1);
    setValorEntradaRapida(Number(item.valor_unitario || 0));
    setNotaEntradaRapida("");
  };

  const handleSalvarEntradaRapida = async (e) => {
    e.preventDefault();
    if (!modalEntradaRapida || qtdEntradaRapida <= 0) return;

    try {
      const res = await fetch(`${API_URL}/estoque/${modalEntradaRapida.id}/entrada-rapida`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-usuario-nivel": obterNivelUsuario(),
        },
        body: JSON.stringify({
          quantidade_adicionada: Number(qtdEntradaRapida),
          novo_valor_unitario: Number(valorEntradaRapida),
          num_nota: notaEntradaRapida,
        }),
      });

      if (res.ok) {
        alert(`+${qtdEntradaRapida} un. adicionadas ao saldo de "${modalEntradaRapida.nome}"! 📦✅`);
        setModalEntradaRapida(null);
        carregarEstoque();
      } else {
        alert("Erro ao dar entrada rápida.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleIniciarEdicao = (item) => {
    setItemIdEditando(item.id);
    setNome(item.nome || "");
    setDescricao(item.descricao || "");
    setReferencia(item.referencia || "");
    setQuantidade(item.quantidade || 0);
    setValorUnitario(item.valor_unitario || 0.0);
    setEstoqueMinimo(item.estoque_minimo || 5);
    setLocalEstoqueId(item.local_estoque_id || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparFormulario = () => {
    setItemIdEditando(null);
    setNome("");
    setDescricao("");
    setReferencia("");
    setQuantidade(0);
    setValorUnitario(0.0);
    setEstoqueMinimo(5);
    setNumNota("");
    setLocalEstoqueId("");
  };

  const handleVerHistorico = async (item) => {
    setModalHistoricoItem(item);
    setLoadingHistorico(true);
    try {
      const res = await fetch(`${API_URL}/estoque/${item.id}/historico-entradas`, {
        headers: { "x-usuario-nivel": obterNivelUsuario() },
      });
      const data = await res.json();
      setHistoricoEntradas(Array.isArray(data) ? data : []);
    } catch (err) {
      alert("Erro ao buscar histórico do insumo.");
    } finally {
      setLoadingHistorico(false);
    }
  };

  // 📊 EXPORTAR PLANILHA EXCEL
  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const res = await fetch(`${API_URL}/relatorios/exportar/estoque`, {
        headers: { "x-usuario-nivel": obterNivelUsuario() }
      });

      if (!res.ok) throw new Error("Falha ao gerar arquivo Excel.");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `estoque_insumos_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  // 🔍 FILTRAGEM
  const itensFiltrados = itens.filter((item) => {
    const termoBusca = busca.toLowerCase();
    const nomeBate = item.nome ? item.nome.toLowerCase().includes(termoBusca) : false;
    const refBate = item.referencia ? item.referencia.toLowerCase().includes(termoBusca) : false;
    const buscaBate = nomeBate || refBate;

    const localBate = filtroLocalId === "todos" || String(item.local_estoque_id) === String(filtroLocalId);
    const criticoBate = !filtroApenasCriticos || item.quantidade <= (item.estoque_minimo || 5);

    return buscaBate && localBate && criticoBate;
  });

  const totalPecasGeral = itens.reduce((acc, item) => acc + Number(item.quantidade), 0);
  const capitalInvestido = itens.reduce((acc, item) => acc + Number(item.quantidade) * Number(item.valor_unitario || 0), 0);
  const itensCriticos = itens.filter((i) => i.quantidade <= (i.estoque_minimo || 5)).length;

  // Paginação
  const totalPaginas = Math.ceil(itensFiltrados.length / itensPorPagina) || 1;
  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const itensPaginados = itensFiltrados.slice(indexInicio, indexInicio + itensPorPagina);

  if (loading) return <div className="p-12 text-center font-black text-slate-400 uppercase text-xs animate-pulse">Carregando almoxarifado...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* CSS IMPRESSÃO */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .relatorio-impressao, .relatorio-impressao * { visibility: visible !important; }
          .relatorio-impressao { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }
          .hide-print { display: none !important; }
        }
      `}</style>

      {/* HEADER DA TELA */}
      <div className="mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hide-print">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="bg-blue-500 p-2 rounded-xl text-white text-xs">📦</span> GESTÃO DE PEÇAS E ESTOQUE
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Controle Patrimonial & Alertas de Reposição</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            className="p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:border-blue-500 text-slate-700"
            value={filtroLocalId}
            onChange={(e) => { setFiltroLocalId(e.target.value); setPaginaAtual(1); }}
          >
            <option value="todos">🏬 Todos os Estoques</option>
            {locaisEstoque.map((l) => (
              <option key={l.id} value={l.id}>📍 {l.nome}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="🔍 Buscar nome ou ref..."
            className="p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 w-full sm:w-60 focus:border-blue-500 transition-colors text-slate-800"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPaginaAtual(1); }}
          />

          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={exportando}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            title="Exportar inventário para planilha"
          >
            <span>📊</span> {exportando ? "..." : "Excel"}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            title="Imprimir Relatório"
          >
            <span>🖨️</span> PDF
          </button>
        </div>
      </div>

      {/* CARDS DE STATUS (COM FILTRO INTERATIVO PARA CRÍTICOS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 hide-print">
        <div 
          onClick={() => { setFiltroApenasCriticos(false); setPaginaAtual(1); }}
          className={`p-5 rounded-2xl shadow-sm border transition-all cursor-pointer flex flex-col justify-between ${
            !filtroApenasCriticos ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-50 border-slate-100 opacity-80'
          }`}
        >
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Peças Físicas</span>
          <span className="text-2xl font-black text-slate-800 mt-1">{totalPecasGeral} un.</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capital Investido</span>
          <span className="text-2xl font-black text-green-600 mt-1">
            R$ {capitalInvestido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div 
          onClick={() => { setFiltroApenasCriticos(!filtroApenasCriticos); setPaginaAtual(1); }}
          className={`p-5 rounded-2xl shadow-sm border transition-all cursor-pointer flex flex-col justify-between ${
            filtroApenasCriticos ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
          }`}
          title="Clique para filtrar apenas os itens que precisam de reposição"
        >
          <div className="flex justify-between items-center">
            <span className={`text-[10px] font-black uppercase tracking-widest ${filtroApenasCriticos ? 'text-red-100' : 'text-red-500'}`}>
              🚨 Necessitam Reposição
            </span>
            <span className="text-[10px] font-bold underline">{filtroApenasCriticos ? 'Ver Todos' : 'Filtrar'}</span>
          </div>
          <span className={`text-2xl font-black mt-1 ${filtroApenasCriticos ? 'text-white' : 'text-red-600'}`}>
            {itensCriticos} Insumos
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relatorio-impressao">
        
        {/* FORMULÁRIO DE CADASTRO/EDIÇÃO */}
        <div className="lg:col-span-4 hide-print">
          <form onSubmit={handleSalvarItem} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                {itemIdEditando ? "✏️ Editar Insumo" : "Novo Item de Estoque"}
              </h3>
              {itemIdEditando && (
                <button type="button" onClick={limparFormulario} className="text-[10px] text-red-500 font-bold uppercase hover:underline">
                  Cancelar
                </button>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Nome do Item *</label>
              <input
                required
                type="text"
                className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-slate-800"
                placeholder="Ex: Lâmpada LED 15W"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Referência / Part Number</label>
              <input
                type="text"
                className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-slate-800"
                placeholder="Ex: REF-1052X"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Escopo / Gestão de Estoque *</label>
              <select
                required
                className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-slate-700"
                value={localEstoqueId}
                onChange={(e) => setLocalEstoqueId(e.target.value)}
              >
                <option value="">Selecione o Escopo...</option>
                {locaisEstoque.map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Descrição / Especificações</label>
              <textarea
                rows={2}
                className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-medium bg-slate-50 outline-none resize-none focus:bg-white focus:border-blue-500 text-slate-800"
                placeholder="Detalhes técnicos..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Qtd Inicial</label>
                <input
                  min="0"
                  disabled={itemIdEditando !== null}
                  type="number"
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none text-slate-800 disabled:opacity-50"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Preço Unit.</label>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-center font-mono font-bold bg-slate-50 outline-none text-slate-800"
                  value={valorUnitario}
                  onChange={(e) => setValorUnitario(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Estoque Mín.</label>
                <input
                  min="0"
                  type="number"
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none text-slate-800"
                  value={estoqueMinimo}
                  onChange={(e) => setEstoqueMinimo(e.target.value)}
                />
              </div>
            </div>

            {!itemIdEditando && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Número da Nota Fiscal (Opcional)</label>
                <input
                  type="text"
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-slate-800"
                  placeholder="Ex: NF-e 000.123"
                  value={numNota}
                  onChange={(e) => setNumNota(e.target.value)}
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              {itemIdEditando ? "💾 Salvar Alterações" : "💾 Cadastrar no Sistema"}
            </button>
          </form>
        </div>

        {/* TABELA DE ITENS */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Itens em Almoxarifado
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {itensFiltrados.length} Registros
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="p-3">Item / Especificação</th>
                  <th className="p-3">Local</th>
                  <th className="p-3 text-center">Status / Qtd</th>
                  <th className="p-3 text-right">Preço Unit.</th>
                  <th className="p-3 text-right">Subtotal</th>
                  <th className="p-3 text-center hide-print">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {itensPaginados.map((item) => {
                  const localObj = locaisEstoque.find((l) => String(l.id) === String(item.local_estoque_id));
                  const nomeLocal = localObj ? localObj.nome : "Geral";
                  const qtdMinima = item.estoque_minimo || 5;
                  const isCritico = item.quantidade <= qtdMinima;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 pr-2">
                        <div className="font-black text-slate-700">{item.nome}</div>
                        {item.referencia && (
                          <span className="text-[9px] font-mono font-bold text-slate-400 block">Ref: {item.referencia}</span>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase">
                          📍 {nomeLocal}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isCritico ? 'bg-red-100 text-red-700 border border-red-200 animate-pulse' : 'bg-green-100 text-green-700'
                          }`}>
                            {item.quantidade} un.
                          </span>
                          {isCritico && (
                            <span className="text-[8px] font-black text-red-500 uppercase">Mín: {qtdMinima} un.</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-right font-mono text-slate-500 font-medium">
                        R$ {Number(item.valor_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-slate-800">
                        R$ {(Number(item.quantidade) * Number(item.valor_unitario || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      
                      <td className="p-3 text-center hide-print">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => handleAbrirEntradaRapida(item)}
                            className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-all text-xs font-bold"
                            title="Entrada Rápida / Reabastecer"
                          >
                            ➕
                          </button>
                          <button
                            onClick={() => handleVerHistorico(item)}
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all text-xs"
                            title="Ver Histórico de Entradas"
                          >
                            📜
                          </button>
                          <button
                            onClick={() => handleIniciarEdicao(item)}
                            className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white rounded-lg transition-all text-xs"
                            title="Editar Insumo"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setModalEtiqueta(item)}
                            className="p-1.5 bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white rounded-lg transition-all text-xs"
                            title="Imprimir Etiqueta QR"
                          >
                            🏷️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {itensFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-10 text-center text-xs font-bold text-slate-400 italic">
                      Nenhum insumo localizado para os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINAÇÃO */}
          {itensFiltrados.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2 mt-4 hide-print">
              <span className="text-[10px] font-bold text-slate-400">
                Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                  disabled={paginaAtual === 1}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                  disabled={paginaAtual === totalPaginas}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MODAL DE ENTRADA RÁPIDA */}
      {modalEntradaRapida && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 hide-print">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150">
            <div className="bg-emerald-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
              <span>➕ Entrada Rápida de Estoque</span>
              <button onClick={() => setModalEntradaRapida(null)}>✕</button>
            </div>

            <form onSubmit={handleSalvarEntradaRapida} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase block">Item a Reabastecer:</span>
                <span className="text-sm font-black text-slate-800">{modalEntradaRapida.nome}</span>
                <span className="text-xs text-slate-500 block mt-0.5">Saldo atual: <strong>{modalEntradaRapida.quantidade} un.</strong></span>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Quantidade a Adicionar *</label>
                <input
                  required
                  min="1"
                  type="number"
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-center text-lg font-black bg-slate-50 outline-none focus:bg-white focus:border-emerald-500 text-slate-800"
                  value={qtdEntradaRapida}
                  onChange={(e) => setQtdEntradaRapida(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Preço Unitário (R$)</label>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    className="w-full p-3 border-2 border-slate-100 rounded-xl font-mono text-center font-bold bg-slate-50 outline-none focus:bg-white focus:border-emerald-500 text-slate-800"
                    value={valorEntradaRapida}
                    onChange={(e) => setValorEntradaRapida(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Nota Fiscal / Ref.</label>
                  <input
                    type="text"
                    placeholder="Ex: NF-e 1234"
                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-emerald-500 text-slate-800"
                    value={notaEntradaRapida}
                    onChange={(e) => setNotaEntradaRapida(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalEntradaRapida(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-black text-xs uppercase rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  ➕ Confirmar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO DE ENTRADAS */}
      {modalHistoricoItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 hide-print">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150">
            <div className="bg-blue-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
              <span>📜 Extrato de Entradas: {modalHistoricoItem.nome}</span>
              <button onClick={() => setModalHistoricoItem(null)}>✕</button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {loadingHistorico ? (
                <div className="text-center py-6 text-xs text-slate-400 font-bold uppercase animate-pulse">Carregando histórico...</div>
              ) : historicoEntradas.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 font-bold uppercase">Nenhuma entrada fiscal registrada para este insumo.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase border-b">
                      <th className="p-3">Data</th>
                      <th className="p-3">Nota Fiscal</th>
                      <th className="p-3">Fornecedor</th>
                      <th className="p-3 text-center">Quantidade</th>
                      <th className="p-3 text-right">Valor Unit.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {historicoEntradas.map((h) => (
                      <tr key={h.id}>
                        <td className="p-3 font-mono text-[11px]">{new Date(h.data_entrada).toLocaleDateString("pt-BR")}</td>
                        <td className="p-3 font-bold text-slate-700">{h.num_nota || "Entrada Avulsa"}</td>
                        <td className="p-3 text-slate-500 uppercase">{h.fornecedor_nome || "---"}</td>
                        <td className="p-3 text-center font-bold text-blue-600">+{h.quantidade} un.</td>
                        <td className="p-3 text-right font-mono">R$ {Number(h.valor_unitario).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setModalHistoricoItem(null)}
                  className="px-6 py-2 bg-slate-100 text-slate-600 font-black text-xs uppercase rounded-xl"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ETIQUETA QR */}
      {modalEtiqueta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 hide-print">
          <div className="bg-white p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-4">
            <h3 className="font-black text-xs uppercase text-slate-400">Etiqueta de Prateleira</h3>
            
            <div className="border-2 border-dashed border-slate-800 p-4 rounded-2xl space-y-2 bg-white text-black font-sans">
              <span className="text-[10px] font-black uppercase block tracking-widest text-slate-400">HOSPITAL DOMINGOS LOURENÇO</span>
              <h2 className="font-black text-sm uppercase leading-tight">{modalEtiqueta.nome}</h2>
              <p className="font-mono text-xs font-bold text-slate-600">REF: {modalEtiqueta.referencia || "S/R"}</p>
              
              <div className="flex justify-center py-2">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=ITEM-${modalEtiqueta.id}`} 
                  alt="QR Code Insumo" 
                  className="w-24 h-24"
                />
              </div>
              <span className="text-[9px] font-mono text-slate-400 block">ID INTERNO: #{modalEtiqueta.id}</span>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setModalEtiqueta(null)} className="flex-1 py-2 bg-slate-100 rounded-xl text-xs font-bold uppercase text-slate-500">Cancelar</button>
              <button onClick={() => window.print()} className="flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-black uppercase">🖨️ Imprimir</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default GestaoEstoque;