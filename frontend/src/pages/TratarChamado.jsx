import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"

export function TratarChamado() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Estados de dados do Backend
  const [chamado, setChamado] = useState(null)
  const [itensEstoque, setItensEstoque] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [loading, setLoading] = useState(true)

  // Estados dos Formulários
  const [tipoAtendimento, setTipoAtendimento] = useState("Interno")
  const [status, setStatus] = useState("Em Atendimento")
  const [descricaoSolucao, setDescricaoSolucao] = useState("")

  // Estado para Peças Usadas
  const [pecaSelecionada, setPecaSelecionada] = useState("")
  const [qtdPeca, setQtdPeca] = useState(1)

  // Campos de Fornecedor Externo
  const [fornecedorId, setFornecedorId] = useState("")
  const [nfReferencia, setNfReferencia] = useState("")
  const [custoServico, setCustoServico] = useState(0)

  const API_URL = "http://192.168.5.101:3000/api"

  // CÁLCULO DA VALORAÇÃO: Soma das peças multiplicadas pelo valor unitário
  const totalPecas = chamado?.itens_vinculados?.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.valor_unitario)), 0) || 0;

  const carregarTodosOsDados = async () => {
    try {
      const [resChamado, resEstoque, resFornecedores] = await Promise.all([
        fetch(`${API_URL}/chamados/${id}`).then(res => res.json()),
        fetch(`${API_URL}/estoque`).then(res => res.json()),
        fetch(`${API_URL}/fornecedores`).then(res => res.json())
      ])

      console.log("Dados da API do chamado:", resChamado); // Para checar se o nome do array é 'itens_vinculados'
      setChamado(resChamado)
      setItensEstoque(resEstoque || [])
      setFornecedores(resFornecedores || [])

      // Pré-preenche os estados com o que já existe no chamado
      setTipoAtendimento(resChamado.tipo_atendimento || "Interno")
      setStatus(resChamado.status || "Em Atendimento")
      setFornecedorId(resChamado.fornecedor_id || "")
      setNfReferencia(resChamado.nf_referencia || "")
      setCustoServico(resChamado.custo_servico || 0)
      setDescricaoSolucao(resChamado.descricao_solucao || "")
    } catch (err) {
      console.error("Erro ao carregar dados do atendimento:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarTodosOsDados() }, [id])

  // Função idêntica ao addTexto do PHP
  const injetarTextoRapido = (texto) => {
    if (chamado?.status === "Concluído") return
    setDescricaoSolucao(prev => prev === "" ? texto : `${prev} ${texto}`)
  }

  // Enviar peça para o estoque vinculado ao chamado
  const handleAdicionarPeca = (e) => {
    e.preventDefault()
    if (!pecaSelecionada) return

    fetch(`${API_URL}/chamados/${id}/itens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: pecaSelecionada, quantidade: qtdPeca })
    }).then((res) => {
      if (res.ok) {
        alert("Peça debitada do estoque com sucesso! 📦")
        carregarTodosOsDados()
        setPecaSelecionada("")
        setQtdPeca(1)
      } else {
        alert("Erro ao debitar estoque. Verifique a quantidade disponível.")
      }
    })
  }

  // Salvar atualização geral do atendimento técnico
  const handleSalvarAtendimento = (e) => {
    e.preventDefault()

    const dadosParaSalvar = {
      status,
      tipo_atendimento: tipoAtendimento,
      descricao_solucao: descricaoSolucao,
      fornecedor_id: tipoAtendimento === "Externo" ? fornecedorId : null,
      nf_referencia: tipoAtendimento === "Externo" ? nfReferencia : null,
      custo_servico: tipoAtendimento === "Externo" ? Number(custoServico) : 0,
      custo_pecas: totalPecas, // Enviando o total valorado das peças
      tecnico_responsavel: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).nome : "Técnico"
    }

    fetch(`${API_URL}/chamados/${id}/atualizar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dadosParaSalvar)
    }).then((res) => {
      if (res.ok) {
        alert("Relatório técnico updated com sucesso! 🎉")
        navigate("/chamados")
      } else {
        alert("Erro ao salvar o atendimento no servidor.")
      }
    })
  }

  if (loading) return <div className="p-8 text-center font-bold">Carregando painel de atendimento técnico...</div>

  const isConcluido = chamado?.status === "Concluído"

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="text-blue-600">🛠️</span> ATENDIMENTO TÉCNICO #{id}
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Setor: {chamado?.setor_nome || "Não informado"}
          </p>
        </div>
        
        {/* BOTÕES DO CABEÇALHO */}
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => window.open(`/chamados/${id}/imprimir`, '_blank')} 
            className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-950 transition-all shadow-md shadow-slate-200"
          >
            📄 Visualizar / Assinar OS
          </button>
          <button onClick={() => navigate(-1)} className="px-5 py-2 border-2 border-slate-200 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 transition-all">
            Voltar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUNA ESQUERDA (CRONOLOGIA E ESTOQUE DE PEÇAS) */}
        <div className="lg:col-span-5 space-y-6">

          {/* PAINEL DE CRONOLOGIA / HISTÓRICO */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[350px]">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Cronologia de Atividades</h3>
            <div className="overflow-y-auto pr-2 space-y-4 flex-1">
              {chamado?.historico?.map((h, i) => (
                <div key={i} className="border-l-2 border-blue-500 pl-4 ml-2 relative">
                  <div className="w-2 h-2 bg-blue-500 rounded-full absolute -left-[5px] top-1" />
                  <span className="text-[10px] text-slate-400 font-bold block">{new Date(h.data_registro).toLocaleString()}</span>
                  <span className="text-xs font-black text-slate-700">{h.tecnico_nome}</span>
                  <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">{h.texto_historico}</p>
                </div>
              ))}
              {(!chamado?.historico || chamado.historico.length === 0) && (
                <p className="text-xs font-bold text-slate-400 italic p-4 text-center">Nenhum histórico registrado.</p>
              )}
            </div>
          </div>

          {/* PAINEL DE BAIXA EM PEÇAS DO ESTOQUE */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Peças e Materiais Utilizados</h3>
            
            {/* CORREÇÃO DO FORM: Ajustado flex-wrap para impedir que quebre para fora do card */}
            <form onSubmit={handleAdicionarPeca} className="flex gap-2 w-full flex-wrap">
              <select
                disabled={isConcluido}
                className="flex-[3] min-w-[150px] p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-white outline-none"
                value={pecaSelecionada}
                onChange={e => setPecaSelecionada(e.target.value)}
              >
                <option value="">Selecione a peça...</option>
                {itensEstoque.map(item => (
                  <option key={item.id} value={item.id}>{item.nome} (Disp: {item.quantidade})</option>
                ))}
              </select>
              <input
                disabled={isConcluido}
                type="number"
                min="1"
                className="flex-[1] min-w-[60px] p-3 border-2 border-slate-100 rounded-xl text-center font-bold outline-none"
                value={qtdPeca}
                onChange={e => setQtdPeca(Number(e.target.value))}
              />
              <button disabled={isConcluido} type="submit" className="flex-none w-12 bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 font-bold text-xs uppercase transition-colors">
                +
              </button>
            </form>

            {/* LISTAGEM DAS PEÇAS JÁ ADICIONADAS E VALORAÇÃO REAL */}
            <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">
              {chamado?.itens_vinculados?.map((p, i) => (
                <div key={i} className="flex justify-between text-[10px] bg-slate-50 p-2 rounded text-slate-600 font-bold">
                  <span>{p.nome} x {p.quantidade}</span>
                  <span>R$ {(Number(p.quantidade) * Number(p.valor_unitario)).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200 font-black text-xs uppercase">
                <span>Total Peças:</span>
                <span className="text-blue-600">R$ {totalPecas.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA (RELATÓRIO TÉCNICO E EXECUÇÃO) */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSalvarAtendimento} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Conclusão e Diagnóstico Técnico</h3>

            {isConcluido && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold p-3 rounded-xl">
                🔒 Este chamado encontra-se Concluído. O formulário está bloqueado contra alterações retroativas.
              </div>
            )}

            {/* ALTERNADOR DE ORIGEM (INTERNO / FORNECEDOR) */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                disabled={isConcluido}
                className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${tipoAtendimento === "Interno" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}
                onClick={() => setTipoAtendimento("Interno")}
              >
                Equipe Interna
              </button>
              <button
                type="button"
                disabled={isConcluido}
                className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${tipoAtendimento === "Externo" ? "bg-white text-red-500 shadow-sm" : "text-slate-400"}`}
                onClick={() => setTipoAtendimento("Externo")}
              >
                Fornecedor / Externo
              </button>
            </div>

            {/* SEÇÃO CAMPOS EXTERNOS (CONDICIONAL) */}
            {tipoAtendimento === "Externo" && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 animate-in fade-in duration-150 text-dark">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Empresa Prestadora</label>
                  <select disabled={isConcluido} className="w-full p-3 border-2 border-slate-100 bg-white rounded-xl text-xs font-bold outline-none" value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}>
                    <option value="">Selecione o fornecedor...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">NF-e & Custo do Serviço</label>
                  <div className="flex gap-1">
                    <input disabled={isConcluido} type="text" placeholder="NF" className="w-1/2 p-3 border-2 border-slate-100 rounded-xl text-xs outline-none" value={nfReferencia} onChange={e => setNfReferencia(e.target.value)} />
                    <input disabled={isConcluido} type="number" step="0.01" placeholder="R$" className="w-1/2 p-3 border-2 border-slate-100 rounded-xl text-xs font-mono outline-none" value={custoServico} onChange={e => setCustoServico(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* STATUS */}
            <div className="w-1/2 text-dark">
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Alterar Status Operacional</label>
              <select disabled={isConcluido} className="w-full p-3 border-2 border-slate-100 bg-white rounded-xl text-xs font-bold outline-none" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="Aberto">Aberto</option>
                <option value="Em Atendimento">Em Atendimento</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>

            {/* BOTÕES DE AÇÕES RÁPIDAS */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-wider">Inserções Rápidas (Toque para colar no relatório)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Realizada limpeza técnica e lubrificação.")} className="p-2 border-2 border-slate-100 hover:border-slate-300 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">💧 Limpeza e Lubr.</button>
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Realizada troca de componente danificado.")} className="p-2 border-2 border-slate-100 hover:border-slate-300 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">🔄 Troca de Peça</button>
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Equipamento testado e em pleno funcionamento.")} className="p-2 border-2 border-slate-100 hover:border-slate-300 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">✅ Testado e Ok</button>
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Ajuste de configuração e calibração.")} className="p-2 border-2 border-slate-100 hover:border-slate-300 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">⚙️ Ajuste/Calibração</button>
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Aguardando chegada de peças externas.")} className="p-2 border-2 border-slate-100 hover:border-slate-300 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">⏳ Aguardando Peças</button>
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Nenhum defeito constatado na visita.")} className="p-2 border-2 border-slate-100 hover:border-slate-300 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">❓ Sem defeitos</button>
              </div>
            </div>

            {/* CAMPO DE TEXTO DO LAUDO */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Relatório Descritivo da Solução</label>
              <textarea
                disabled={isConcluido}
                required
                rows={4}
                className="w-full p-4 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-400 font-medium text-xs text-slate-700 resize-none transition-all bg-white"
                placeholder="Digite o detalhamento técnico do que foi feito..."
                value={descricaoSolucao}
                onChange={e => setDescricaoSolucao(e.target.value)}
              />
            </div>

            {/* BOTÃO SALVAR RELEITURA */}
            {!isConcluido && (
              <button type="submit" className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-green-100 transition-all active:scale-[0.98]">
                💾 Salvar Atualização Técnica
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}