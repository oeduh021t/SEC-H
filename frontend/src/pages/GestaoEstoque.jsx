import { useEffect, useState } from "react";

export function GestaoEstoque() {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

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

  // Filtro
  const [filtroLocalId, setFiltroLocalId] = useState("todos");

  // Modais de Apoio
  const [modalHistoricoItem, setModalHistoricoItem] = useState(null);
  const [historicoEntradas, setHistoricoEntradas] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const [modalEtiqueta, setModalEtiqueta] = useState(null);

  const API_URL = "http://192.168.5.101:3000/api";
  const BASE_URL = "http://192.168.5.101:3000";

  const obterNivelUsuario = () => {
    const userLogado = localStorage.getItem("user");
    return userLogado ? JSON.parse(userLogado).nivel : "";
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
      nome,
      descricao,
      quantidade: Number(quantidade),
      valor_unitario: Number(valorUnitario),
      estoque_minimo: Number(estoqueMinimo || 0),
      num_nota: numNota,
      referencia,
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
        alert(itemIdEditando ? "Insumo atualizado! ✏️" : "Item cadastrado com sucesso! 📦");
        limparFormulario();
        carregarEstoque();
      } else {
        alert("Erro ao salvar. Verifique se o seu perfil possui permissão.");
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

  const handleImprimirRelatorio = () => {
    window.print();
  };

  // 🔍 FILTRAGEM
  const itensFiltrados = itens.filter((item) => {
    const termoBusca = busca.toLowerCase();
    const nomeBate = item.nome ? item.nome.toLowerCase().includes(termoBusca) : false;
    const refBate = item.referencia ? item.referencia.toLowerCase().includes(termoBusca) : false;
    const buscaBate = nomeBate || refBate;

    const localBate = filtroLocalId === "todos" || String(item.local_estoque_id) === String(filtroLocalId);

    return buscaBate && localBate;
  });

  const totalPecasGeral = itensFiltrados.reduce((acc, item) => acc + Number(item.quantidade), 0);
  const capitalInvestido = itensFiltrados.reduce((acc, item) => acc + Number(item.quantidade) * Number(item.valor_unitario || 0), 0);
  const itensCriticos = itensFiltrados.filter((i) => i.quantidade <= (i.estoque_minimo || 5)).length;

  if (loading) return <div className="p-8 text-center font-bold text-slate-400 animate-pulse">Carregando almoxarifado...</div>;

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
      <div className="mb-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hide-print">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="text-blue-600">📦</span> GESTÃO DE PEÇAS E ESTOQUE
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Controle Patrimonial & Alertas de Reposição</p>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <select
            className="p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:border-blue-500 text-slate-700"
            value={filtroLocalId}
            onChange={(e) => setFiltroLocalId(e.target.value)}
          >
            <option value="todos">🏬 Todos os Estoques</option>
            {locaisEstoque.map((l) => (
              <option key={l.id} value={l.id}>📍 {l.nome}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="🔍 Buscar por nome ou referência..."
            className="p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 w-full sm:w-64 focus:border-blue-500 transition-colors text-black"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <button
            type="button"
            onClick={handleImprimirRelatorio}
            className="p-2.5 bg-slate-800 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-900 transition-all flex items-center gap-1.5"
            title="Exportar Inventário Atual"
          >
            📊 Relatório
          </button>
        </div>
      </div>

      {/* CARDS DE INFORMAÇÃO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 hide-print">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Peças Físicas</span>
          <span className="text-2xl font-black text-slate-800 mt-1">{totalPecasGeral} un.</span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capital Investido</span>
          <span className="text-2xl font-black text-green-600 mt-1">
            R$ {capitalInvestido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className={`p-5 rounded-2xl shadow-sm border flex flex-col ${itensCriticos > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
          <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">🚨 Necessitam Reposição</span>
          <span className="text-2xl font-black text-red-600 mt-1">{itensCriticos} Insumos</span>
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
                <button type="button" onClick={limparFormulario} className="text-[10px] text-red-500 font-bold uppercase">
                  Cancelar
                </button>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Nome do Item *</label>
              <input
                required
                type="text"
                className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-black"
                placeholder="Ex: Lâmpada LED 15W"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Referência / Part Number</label>
              <input
                type="text"
                className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-black"
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
                className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-medium bg-slate-50 outline-none resize-none focus:bg-white focus:border-blue-500 text-black"
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
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none text-black disabled:opacity-50"
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
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-center font-mono font-bold bg-slate-50 outline-none text-black"
                  value={valorUnitario}
                  onChange={(e) => setValorUnitario(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Estoque Mín.</label>
                <input
                  min="0"
                  type="number"
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none text-black"
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
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-black"
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
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Itens em Almoxarifado</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Exibindo {itensFiltrados.length} Registros
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Item / Especificação</th>
                  <th className="pb-3">Local</th>
                  <th className="pb-3 text-center">Status / Qtd</th>
                  <th className="pb-3 text-right">Preço Unit.</th>
                  <th className="pb-3 text-right">Subtotal</th>
                  <th className="pb-3 text-center hide-print">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {itensFiltrados.map((item) => {
                  const localObj = locaisEstoque.find((l) => String(l.id) === String(item.local_estoque_id));
                  const nomeLocal = localObj ? localObj.nome : "Geral";
                  const qtdMinima = item.estoque_minimo || 5;
                  const isCritico = item.quantidade <= qtdMinima;

                  return (
                    <tr key={item.id} className="text-xs hover:bg-slate-50/50 transition-colors text-dark">
                      <td className="py-3 pr-2">
                        <div className="font-black text-slate-700">{item.nome}</div>
                        {item.referencia && (
                          <span className="text-[9px] font-mono font-bold text-slate-400 block">Ref: {item.referencia}</span>
                        )}
                      </td>

                      <td className="py-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase">
                          📍 {nomeLocal}
                        </span>
                      </td>

                      <td className="py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            isCritico ? 'bg-red-100 text-red-700 border border-red-200 animate-pulse' : 'bg-green-100 text-green-700'
                          }`}>
                            {item.quantidade} un.
                          </span>
                          {isCritico && (
                            <span className="text-[8px] font-black text-red-500 uppercase">Mín: {qtdMinima} un.</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 text-right font-mono text-slate-500 font-medium">R$ {Number(item.valor_unitario || 0).toFixed(2)}</td>
                      <td className="py-3 text-right font-mono font-black text-slate-700">R$ {(Number(item.quantidade) * Number(item.valor_unitario || 0)).toFixed(2)}</td>
                      
                      <td className="py-3 text-center hide-print">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => handleVerHistorico(item)}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all text-xs"
                            title="Ver Histórico de Entradas / NFs"
                          >
                            📜
                          </button>
                          <button
                            onClick={() => handleIniciarEdicao(item)}
                            className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all text-xs"
                            title="Editar Insumo"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setModalEtiqueta(item)}
                            className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-600 hover:text-white transition-all text-xs"
                            title="Gerar Etiqueta"
                          >
                            🏷️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 📜 MODAL DE HISTÓRICO DE ENTRADAS DO INSUMO */}
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

      {/* 🏷️ MODAL DE IMPRESSÃO DE ETIQUETA */}
      {modalEtiqueta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 hide-print">
          <div className="bg-white p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-4">
            <h3 className="font-black text-xs uppercase text-slate-400">Etiqueta de Prateleira</h3>
            
            <div className="border-2 border-dashed border-slate-800 p-4 rounded-2xl space-y-2 bg-white text-black font-sans">
              <span className="text-[10px] font-black uppercase block tracking-widest text-slate-400">ENGENHARIA CLÍNICA SEC-H</span>
              <h2 className="font-black text-sm uppercase leading-tight">{modalEtiqueta.nome}</h2>
              <p className="font-mono text-xs font-bold text-slate-600">REF: {modalEtiqueta.referencia || "S/R"}</p>
              
              {/* QR Code Simulado com API Pública Google */}
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