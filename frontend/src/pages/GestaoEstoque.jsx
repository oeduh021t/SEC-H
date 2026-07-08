import { useEffect, useState } from "react"

export function GestaoEstoque() {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState("")

  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")
  const [referencia, setReferencia] = useState("") // Estado para Referência
  const [quantidade, setQuantidade] = useState(0)
  const [valorUnitario, setValorUnitario] = useState(0.00)
  const [numNota, setNumNota] = useState("")
  const [localEstoqueId, setLocalEstoqueId] = useState("") // 🆕 Estado para armazenar o escopo selecionado
  const [locaisEstoque, setLocaisEstoque] = useState([]) // 🆕 Estado para listar os locais cadastrados no sistema

  const API_URL = "http://192.168.5.101:3000/api"

  // Auxiliar para obter as credenciais do operador logado
  const obterNivelUsuario = () => {
    const userLogado = localStorage.getItem('user');
    return userLogado ? JSON.parse(userLogado).nivel : '';
  };

  const carregarEstoque = async () => {
    setLoading(true)
    try {
      const nivelUsuario = obterNivelUsuario();
      const headersComNivel = {
        "Content-Type": "application/json",
        "x-usuario-nivel": nivelUsuario
      };

      // 🆕 Carrega locais de estoque dinâmicos em paralelo com os insumos
      const [resEstoque, resLocais] = await Promise.all([
        fetch(`${API_URL}/estoque`, { method: "GET", headers: headersComNivel }),
        fetch(`${API_URL}/locais-estoque`, { method: "GET", headers: headersComNivel })
      ]);

      const dataEstoque = await resEstoque.json();
      const dataLocais = await resLocais.json();

      setItens(dataEstoque || []);
      setLocaisEstoque(dataLocais || []);
    } catch (err) {
      console.error("Erro ao carregar almoxarifado:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarEstoque() }, [])

  const handleCadastrarItem = async (e) => {
    e.preventDefault()
    if (!nome) return

    const nivelUsuario = obterNivelUsuario();

    const novoItem = {
      nome,
      descricao,
      quantidade: Number(quantidade),
      valor_unitario: Number(valorUnitario),
      num_nota: numNota,
      referencia: referencia,
      local_estoque_id: localEstoqueId ? Number(localEstoqueId) : null // 🆕 Atribuição do escopo no payload enviado à API
    }

    try {
      const res = await fetch(`${API_URL}/estoque`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-usuario-nivel": nivelUsuario
        },
        body: JSON.stringify(novoItem)
      })

      if (res.ok) {
        alert("Item cadastrado com sucesso! 📦")
        setNome("")
        setDescricao("")
        setReferencia("") // Limpeza do campo
        setQuantidade(0)
        setValorUnitario(0.00)
        setNumNota("")
        setLocalEstoqueId("") // 🆕 Reset do campo de local
        carregarEstoque()
      } else {
        alert("Erro ao cadastrar item. Verifique se o seu perfil possui permissão.");
      }
    } catch (err) {
      console.error(err)
    }
  }

  const totalPecasGeral = itens.reduce((acc, item) => acc + Number(item.quantidade), 0)
  const capitalInvestido = itens.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.valor_unitario || 0)), 0)

  // Filtro busca por Nome OU por Referência estruturada
  const itensFiltrados = itens.filter(item => {
    const termoBusca = busca.toLowerCase();
    const nomeBate = item.nome ? item.nome.toLowerCase().includes(termoBusca) : false;
    const refBate = item.referencia ? item.referencia.toLowerCase().includes(termoBusca) : false;
    
    return nomeBate || refBate;
  })

  if (loading) return <div className="p-8 text-center font-bold text-slate-400 animate-pulse">Carregando almoxarifado...</div>

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      <div className="mb-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="text-blue-600">📦</span> GESTÃO DE PEÇAS E ESTOQUE
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Controle Patrimonial de Insumos</p>
        </div>
        <input 
          type="text" 
          placeholder="🔍 Buscar por nome ou referência..." 
          className="p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 w-72 focus:border-blue-500 transition-colors"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Peças Físicas</span>
          <span className="text-2xl font-black text-slate-800 mt-1">{totalPecasGeral} un.</span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capital em Estoque</span>
          <span className="text-2xl font-black text-green-600 mt-1">R$ {capitalInvestido.toFixed(2)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <form onSubmit={handleCadastrarItem} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Novo Item de Estoque</h3>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Nome do Item</label>
              <input required type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-black" placeholder="Ex: Lâmpada LED 15W" value={nome} onChange={e => setNome(e.target.value)} />
            </div>

            {/* Campo Referência no Formulário */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Referência / Part Number</label>
              <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-black" placeholder="Ex: REF-1052X" value={referencia} onChange={e => setReferencia(e.target.value)} />
            </div>

            {/* 🆕 INSERIDO COM PRECISÃO: Campo para definir o Escopo Gerencial do Item */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Escopo / Gestão de Estoque *</label>
              <select required className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-slate-700" value={localEstoqueId} onChange={e => setLocalEstoqueId(e.target.value)}>
                <option value="">Selecione o Escopo...</option>
                {locaisEstoque.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Descrição / Especificações</label>
              <textarea rows={2} className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-medium bg-slate-50 outline-none resize-none focus:bg-white focus:border-blue-500 text-black" placeholder="Detalhes técnicos adicionais..." value={descricao} onChange={e => setDescricao(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Qtd Inicial</label>
                <input min="0" type="number" className="w-full p-3 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none focus:bg-white text-black" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Valor Unitário</label>
                <input min="0" step="0.01" type="number" className="w-full p-3 border-2 border-slate-100 rounded-xl text-center font-mono font-bold bg-slate-50 outline-none focus:bg-white text-black" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Número da Nota Fiscal (Opcional)</label>
              <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-black" placeholder="Ex: NF-e 000.123.456" value={numNota} onChange={e => setNumNota(e.target.value)} />
            </div>

            <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98]">
              💾 Cadastrar no Sistema
            </button>
          </form>
        </div>

        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Itens em Almoxarifado</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Item / Especificação</th>
                  <th className="pb-3">Referência</th>
                  <th className="pb-3 text-center">Quantidade</th>
                  <th className="pb-3 text-right">Preço Unit.</th>
                  <th className="pb-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {itensFiltrados.map((item) => (
                  <tr key={item.id} className="text-xs hover:bg-slate-50/50 transition-colors text-dark">
                    <td className="py-3 pr-2">
                      <div className="font-black text-slate-700">{item.nome}</div>
                      <div className="text-[10px] text-slate-400 font-medium line-clamp-1">{item.descricao || "Sem descrição informada"}</div>
                    </td>
                    
                    <td className="py-3 font-medium">
                      {item.referencia ? (
                        <span className="bg-slate-100 text-slate-600 font-mono font-bold px-2 py-1 rounded text-[10px] border border-slate-200">
                          {item.referencia}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic text-[10px]">Nenhuma</span>
                      )}
                    </td>

                    <td className="py-3 text-center font-bold text-slate-600 bg-slate-50/50 rounded-lg">{item.quantidade} un.</td>
                    <td className="py-3 text-right font-mono text-slate-500 font-medium">R$ {Number(item.valor_unitario || 0).toFixed(2)}</td>
                    <td className="py-3 text-right font-mono font-black text-slate-700">R$ {(Number(item.quantidade) * Number(item.valor_unitario || 0)).toFixed(2)}</td>
                  </tr>
                ))}
                {itensFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-xs font-bold text-slate-400 italic">Nenhum insumo encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}