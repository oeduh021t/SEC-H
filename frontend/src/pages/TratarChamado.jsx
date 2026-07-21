import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"

export function TratarChamado() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Estados de dados do Backend
  const [chamado, setChamado] = useState(null)
  const [itensEstoque, setItensEstoque] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [loading, setLoading] = useState(true)

  // ESTADOS ADICIONADOS PARA A TROCA DE EQUIPAMENTO
  const [equipamentosReserva, setEquipamentosReserva] = useState([])
  const [equipamentoReservaSelecionado, setEquipamentoReservaSelecionado] = useState("")
  const [buscaPatrimonioReserva, setBuscaPatrimonioReserva] = useState("") // 🔎 NOVO ESTADO DE FILTRO DE PATRIMÔNIO
  const [exibirPainelTroca, setExibirPainelTroca] = useState(false)
  const [executandoTroca, setExecutandoTroca] = useState(false)

  // Estados dos Formulários
  const [tipoAtendimento, setTipoAtendimento] = useState("Interno")
  const [status, setStatus] = useState("Em Atendimento")
  const [descricaoSolucao, setDescricaoSolucao] = useState("")
  const [tecnicoId, setTecnicoId] = useState("")

  // Estados para gerenciamento de Laudos/Documentos (Auditoria)
  const [documentoSelecionado, setDocumentoSelecionado] = useState(null)
  const [listaDocumentos, setListaDocumentos] = useState([])

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
      const usuarioSalvo = localStorage.getItem('user');
      const nivel = usuarioSalvo ? JSON.parse(usuarioSalvo).nivel : '';

      const headers = {
        'Content-Type': 'application/json',
        'x-usuario-nivel': nivel
      };

      const [resChamado, resEstoque, resFornecedores, resDocumentos, resTecnicos] = await Promise.all([
        fetch(`${API_URL}/chamados/${id}`, { headers }).then(res => res.json()),
        fetch(`${API_URL}/estoque`, { headers }).then(res => res.json()), 
        fetch(`${API_URL}/fornecedores`, { headers }).then(res => res.json()),
        fetch(`${API_URL}/documentos?chamado_id=${id}`, { headers }).then(res => res.json()),
        fetch(`${API_URL}/tecnicos`, { headers }).then(res => res.json())
      ])

      console.log("Dados da API do chamado:", resChamado);
      setChamado(resChamado)
      setItensEstoque(resEstoque || [])
      setFornecedores(resFornecedores || [])
      setListaDocumentos(resDocumentos || []) 
      setTecnicos(resTecnicos || [])

      // Pré-preenche os estados com o que já existe no chamado
      setTipoAtendimento(resChamado.tipo_atendimento || "Interno")
      setStatus(resChamado.status || "Em Atendimento")
      setFornecedorId(resChamado.fornecedor_id || "")
      setNfReferencia(resChamado.nf_referencia || "")
      setCustoServico(resChamado.custo_servico || 0)
      setDescricaoSolucao(resChamado.descricao_solucao || "")
      setTecnicoId(resChamado.tecnico_id || "")

      // Se o chamado possuir um equipamento vinculado, busca os reservas do mesmo tipo
      if (resChamado.equipamento_id) {
        carregarEquipamentosReserva(resChamado.equipamento_id, headers);
      }

    } catch (err) {
      console.error("Erro ao carregar dados do atendimento:", err)
    } finally {
      setLoading(false)
    }
  }

  // Busca os equipamentos reservas baseados no tipo do equipamento atual do chamado
  const carregarEquipamentosReserva = async (equipamentoId, headers) => {
    try {
      const res = await fetch(`${API_URL}/equipamentos/reservas?tipo_de_equipamento_com_base_em=${equipamentoId}`, { headers });
      if (res.ok) {
        const dados = await res.json();
        setEquipamentosReserva(dados || []);
      }
    } catch (err) {
      console.error("Erro ao buscar equipamentos em reserva:", err);
    }
  }

  useEffect(() => { carregarTodosOsDados() }, [id])

  const injetarTextoRapido = (texto) => {
    if (chamado?.status === "Concluído") return
    setDescricaoSolucao(prev => prev === "" ? texto : `${prev} ${texto}`)
  }

  const handleAdicionarPeca = (e) => {
    e.preventDefault()
    if (!pecaSelecionada) return

    const usuarioSalvo = localStorage.getItem('user')
    const usuarioLogado = usuarioSalvo ? JSON.parse(usuarioSalvo) : null

    const dadosPeca = {
      item_id: pecaSelecionada,
      quantidade: qtdPeca,
      usuario_id: chamado?.usuario_id || usuarioLogado?.id || 1, 
      equipamento_id: chamado?.equipamento_id || null 
    }

    fetch(`${API_URL}/chamados/${id}/itens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dadosPeca)
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

  const handleUploadDocumento = (e) => {
    e.preventDefault()
    if (!documentoSelecionado) return alert("Por favor, selecione um arquivo!")

    const usuarioSalvo = localStorage.getItem('user')
    const usuarioLogado = usuarioSalvo ? JSON.parse(usuarioSalvo) : null

    const formData = new FormData()
    formData.append('arquivo', documentoSelecionado)
    formData.append('chamado_id', id)
    formData.append('usuario_id', usuarioLogado?.id || 1)
    formData.append('setor_id', chamado?.setor_id || '')
    formData.append('equipamento_id', chamado?.equipamento_id || '')

    fetch(`${API_URL}/documentos`, {
      method: "POST",
      headers: {
        'x-usuario-nivel': usuarioLogado?.nivel || ''
      },
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error)
      } else {
        alert("Documento anexado e registrado no histórico para fins de auditoria! 📎✅")
        setDocumentoSelecionado(null)
        carregarTodosOsDados()
      }
    })
    .catch(err => console.error("Erro ao anexar documento:", err))
  }

  const handleSalvarAtendimento = (e) => {
    e.preventDefault()

    const tecnicoSelecionado = tecnicos.find(t => Number(t.id) === Number(tecnicoId));
    const nomeTecnicoFinal = tecnicoSelecionado 
      ? tecnicoSelecionado.nome 
      : (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).nome : "Técnico");

    const dadosParaSalvar = {
      status,
      tipo_atendimento: tipoAtendimento,
      descricao_solucao: descricaoSolucao,
      fornecedor_id: tipoAtendimento === "Externo" ? fornecedorId : null,
      nf_referencia: tipoAtendimento === "Externo" ? nfReferencia : null,
      custo_servico: tipoAtendimento === "Externo" ? Number(custoServico) : 0,
      custo_pecas: totalPecas,
      tecnico_id: tipoAtendimento === "Interno" ? tecnicoId : null,
      tecnico_responsavel: nomeTecnicoFinal
    }

    fetch(`${API_URL}/chamados/${id}/atualizar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dadosParaSalvar)
    }).then((res) => {
      if (res.ok) {
        alert("Relatório técnico atualizado com sucesso! 🎉")
        navigate("/chamados")
      } else {
        alert("Erro ao salvar o atendimento no servidor.")
      }
    })
  }

  // FUNÇÃO QUE SUBMETE A TROCA DE EQUIPAMENTO
  const handleTrocaEquipamento = async (e) => {
    e.preventDefault();
    if (!equipamentoReservaSelecionado) return alert("Selecione um equipamento de reserva para a troca!");

    const confirmar = window.confirm("Deseja realmente realizar a troca? O equipamento atual irá para 'Em Manutenção' e o reserva será ativado.");
    if (!confirmar) return;

    setExecutandoTroca(true);

    const usuarioSalvo = localStorage.getItem('user');
    const usuarioLogado = usuarioSalvo ? JSON.parse(usuarioSalvo) : null;

    const payload = {
      equipamento_atual_id: chamado?.equipamento_id,
      equipamento_reserva_id: equipamentoReservaSelecionado,
      chamado_id: id,
      tecnico_nome: usuarioLogado?.nome || "Técnico",
      setor_destino_id: chamado?.setor_id 
    };

    try {
      const res = await fetch(`${API_URL}/equipamentos/trocar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert("Substituição realizada com sucesso! 🔄 O histórico do ativo foi gerado.");
        setExibirPainelTroca(false);
        setEquipamentoReservaSelecionado("");
        setBuscaPatrimonioReserva("");
        
        const equipamentoReservaInfo = equipamentosReserva.find(eq => Number(eq.id) === Number(equipamentoReservaSelecionado));
        const textoTroca = `[🔄 TROCA DE EQUIPAMENTO] Equipamento anterior (Pat: ${chamado.patrimonio}) substituído pelo novo equipamento (Pat: ${equipamentoReservaInfo?.patrimonio || 'Reserva'}).`;
        setDescricaoSolucao(prev => prev === "" ? textoTroca : `${prev}\n${textoTroca}`);
        
        carregarTodosOsDados();
      } else {
        const errorData = await res.json();
        alert(`Erro na substituição: ${errorData.message || 'Verifique as regras de estoque.'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o servidor para realizar a troca.");
    } finally {
      setExecutandoTroca(false);
    }
  }

  // 🔎 FILTRA OS EQUIPAMENTOS RESERVA DIGITANDO O PATRIMÔNIO OU NOME
  const equipamentosReservaFiltrados = equipamentosReserva.filter(eq => {
    const termo = buscaPatrimonioReserva.toLowerCase().trim();
    if (!termo) return true;
    const patrimonioStr = String(eq.patrimonio || "").toLowerCase();
    const nomeStr = String(eq.nome || "").toLowerCase();
    return patrimonioStr.includes(termo) || nomeStr.includes(termo);
  });

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
          <div className="flex flex-col sm:flex-row sm:gap-4 mt-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              📍 Setor: <span className="text-slate-600 font-black">{chamado?.setor_nome || "Não informado"}</span>
            </p>
            {chamado?.eq_nome && (
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider sm:border-l sm:pl-4 border-slate-200">
                🤖 Ativo: <span className="text-blue-600 font-black">{chamado.eq_nome}</span> {chamado.patrimonio && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono text-[10px] ml-1">Pat: {chamado.patrimonio}</span>}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          {chamado?.equipamento_id && !isConcluido && (
            <button
              type="button"
              onClick={() => setExibirPainelTroca(!exibirPainelTroca)}
              className="px-5 py-2 bg-amber-500 text-white rounded-xl text-xs font-black uppercase hover:bg-amber-600 transition-all shadow-md shadow-amber-200 flex items-center gap-1.5"
            >
              🔄 Substituir Equipamento (Troca)
            </button>
          )}

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

      {/* PAINEL DE TROCA (CONTEÚDO EXPANSÍVEL) */}
      {exibirPainelTroca && chamado?.equipamento_id && (
        <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-3xl border-2 border-amber-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-amber-800 uppercase tracking-wider flex items-center gap-2">
              🔄 Substituição Emergencial de Ativo
            </h3>
            <button 
              type="button" 
              onClick={() => { setExibirPainelTroca(false); setBuscaPatrimonioReserva(""); }} 
              className="text-amber-800 hover:text-amber-950 font-bold text-xs"
            >
              Fechar Painel ✕
            </button>
          </div>
          <p className="text-xs text-amber-700 mb-4 font-medium">
            Ao confirmar, o equipamento atual <strong>{chamado.eq_nome} (Pat: {chamado.patrimonio})</strong> passará para o status de <strong className="text-red-600">"Em Manutenção"</strong>. O equipamento reserva selecionado herdará a localização atual (<strong>{chamado.setor_nome}</strong>) e assumirá o status operacional ativo.
          </p>

          <form onSubmit={handleTrocaEquipamento} className="flex gap-4 items-end flex-wrap">
            
            {/* 🔎 CAMPO DE BUSCA RÁPIDA POR PATRIMÔNIO OU NOME */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-black text-amber-800 uppercase mb-1">
                Filtrar por Patrimônio / Nome
              </label>
              <input
                type="text"
                placeholder="Digite o patrimônio..."
                value={buscaPatrimonioReserva}
                onChange={e => setBuscaPatrimonioReserva(e.target.value)}
                className="w-full p-3 border-2 border-amber-200 bg-white rounded-xl text-xs font-bold outline-none text-slate-700"
              />
            </div>

            {/* LISTA SUSPENSA COM OS ITENS FILTRADOS */}
            <div className="flex-[2] min-w-[280px]">
              <label className="block text-[10px] font-black text-amber-800 uppercase mb-1">
                Ativos em Reserva ({equipamentosReservaFiltrados.length} encontrados)
              </label>
              <select
                disabled={executandoTroca}
                required
                className="w-full p-3 border-2 border-amber-200 bg-white rounded-xl text-xs font-bold outline-none text-slate-700"
                value={equipamentoReservaSelecionado}
                onChange={e => setEquipamentoReservaSelecionado(e.target.value)}
              >
                <option value="">Selecione o equipamento de reserva...</option>
                {equipamentosReservaFiltrados.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    Pat: {eq.patrimonio} — {eq.nome} ({eq.setor_nome || 'Reserva'})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={executandoTroca || !equipamentoReservaSelecionado}
              className="px-6 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {executandoTroca ? "Processando..." : "Confirmar e Trocar Ativo 🔁"}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUNA ESQUERDA (CRONOLOGIA E ESTOQUE DE PEÇAS) */}
        <div className="lg:col-span-5 space-y-6">

          {/* PAINEL DE ANEXOS */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Anexos e Laudos Técnicos</h3>
            
            <form onSubmit={handleUploadDocumento} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase">Vincular arquivo (PDF ou Imagem)</label>
              <input 
                disabled={isConcluido}
                type="file" 
                accept="image/*,application/pdf"
                className="text-xs w-full block file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 disabled:opacity-50"
                onChange={e => setDocumentoSelecionado(e.target.files[0])}
              />
              <button 
                disabled={isConcluido || !documentoSelecionado} 
                type="submit" 
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase transition-all disabled:opacity-50"
              >
                Salvar Anexo na Ordem de Serviço
              </button>
            </form>

            <div className="space-y-2 pt-2">
              <label className="block text-[9px] font-black text-slate-400 uppercase border-b pb-1">Arquivos Fixados nesta OS:</label>
              {listaDocumentos.map((doc) => (
                <div key={doc.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                  <div className="truncate max-w-[220px]">
                    <span className="font-bold text-slate-700 block truncate">{doc.tipo_mimetype.includes('pdf') ? '📄' : '📷'} {doc.nome_original}</span>
                    <span className="text-[9px] text-slate-400 block">Por: {doc.usuario_nome}</span>
                  </div>
                  <a 
                    href={`http://192.168.5.101:3000${doc.url_arquivo}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 font-black hover:underline text-[10px] uppercase bg-white px-2 py-1 rounded shadow-sm border border-slate-100"
                  >
                    Abrir
                  </a>
                </div>
              ))}
              {listaDocumentos.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-2">Nenhum laudo anexado a esta OS.</p>
              )}
            </div>
          </div>

          {/* PAINEL DE CRONOLOGIA */}
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

          {/* PAINEL DE PEÇAS */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Peças e Materiais Utilizados</h3>
            
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

        {/* COLUNA DIREITA (FORMULÁRIO DE ATENDIMENTO) */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSalvarAtendimento} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Conclusão e Diagnóstico Técnico</h3>

            {isConcluido && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold p-3 rounded-xl">
                🔒 Este chamado encontra-se Concluído. O formulário está bloqueado contra alterações retroativas.
              </div>
            )}

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

            {/* SELEÇÃO DO STATUS E TÉCNICO RESPONSÁVEL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-dark">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Alterar Status Operacional</label>
                <select disabled={isConcluido} className="w-full p-3 border-2 border-slate-100 bg-white rounded-xl text-xs font-bold outline-none" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="Aberto">Aberto</option>
                  <option value="Em Atendimento">Em Atendimento</option>
                  <option value="Concluído">Concluído</option>
                </select>
              </div>

              {tipoAtendimento === "Interno" && (
                <div className="animate-in fade-in duration-150">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Técnico Designado</label>
                  <select 
                    disabled={isConcluido} 
                    required={tipoAtendimento === "Interno"}
                    className="w-full p-3 border-2 border-slate-100 bg-white rounded-xl text-xs font-bold outline-none" 
                    value={tecnicoId} 
                    onChange={e => setTecnicoId(e.target.value)}
                  >
                    <option value="">Selecione o técnico...</option>
                    {tecnicos.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

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