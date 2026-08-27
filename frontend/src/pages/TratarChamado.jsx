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

  // Estados de Troca de Ativo
  const [equipamentosReserva, setEquipamentosReserva] = useState([])
  const [equipamentoReservaSelecionado, setEquipamentoReservaSelecionado] = useState("")
  const [buscaPatrimonioReserva, setBuscaPatrimonioReserva] = useState("")
  const [exibirPainelTroca, setExibirPainelTroca] = useState(false)
  const [executandoTroca, setExecutandoTroca] = useState(false)

  // Estados do Formulário de Solução
  const [tipoAtendimento, setTipoAtendimento] = useState("Interno")
  const [status, setStatus] = useState("Em Atendimento")
  const [descricaoSolucao, setDescricaoSolucao] = useState("")
  const [tecnicoId, setTecnicoId] = useState("")

  // Estados de Anexos
  const [documentoSelecionado, setDocumentoSelecionado] = useState(null)
  const [listaDocumentos, setListaDocumentos] = useState([])

  // Estados de Peças
  const [pecaSelecionada, setPecaSelecionada] = useState("")
  const [qtdPeca, setQtdPeca] = useState(1)

  // Fornecedor Externo
  const [fornecedorId, setFornecedorId] = useState("")
  const [nfReferencia, setNfReferencia] = useState("")
  const [custoServico, setCustoServico] = useState(0)

  const API_URL = "http://192.168.5.101:3000/api"
  const BASE_URL = "http://192.168.5.101:3000"

  const totalPecas = chamado?.itens_vinculados?.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.valor_unitario)), 0) || 0;
  const custoTotalOS = (Number(custoServico) || 0) + totalPecas;

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

      setChamado(resChamado)
      setItensEstoque(resEstoque || [])
      setFornecedores(resFornecedores || [])
      setListaDocumentos(resDocumentos || []) 
      setTecnicos(resTecnicos || [])

      setTipoAtendimento(resChamado.tipo_atendimento || "Interno")
      setStatus(resChamado.status || "Em Atendimento")
      setFornecedorId(resChamado.fornecedor_id || "")
      setNfReferencia(resChamado.nf_referencia || "")
      setCustoServico(resChamado.custo_servico || 0)
      setDescricaoSolucao(resChamado.descricao_solucao || "")
      setTecnicoId(resChamado.tecnico_id || "")

      if (resChamado.equipamento_id) {
        carregarEquipamentosReserva(resChamado.equipamento_id, headers);
      }

    } catch (err) {
      console.error("Erro ao carregar dados do atendimento:", err)
    } finally {
      setLoading(false)
    }
  }

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
        alert("Documento anexado com sucesso para fins de auditoria! 📎✅")
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
        alert("Atendimento salvo com sucesso! 🎉")
        navigate("/chamados")
      } else {
        alert("Erro ao salvar o atendimento no servidor.")
      }
    })
  }

  const handleTrocaEquipamento = async (e) => {
    e.preventDefault();
    if (!equipamentoReservaSelecionado) return alert("Selecione um equipamento de reserva para a troca!");

    const confirmar = window.confirm("Deseja realmente realizar a troca? O equipamento atual irá para 'Inoperante' e o reserva será ativado.");
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
        alert("Substituição realizada com sucesso! 🔄");
        setExibirPainelTroca(false);
        setEquipamentoReservaSelecionado("");
        setBuscaPatrimonioReserva("");
        
        const equipamentoReservaInfo = equipamentosReserva.find(eq => Number(eq.id) === Number(equipamentoReservaSelecionado));
        const textoTroca = `[🔄 TROCA DE ATIVO] Equipamento anterior (Pat: ${chamado.patrimonio}) substituído por novo ativo (Pat: ${equipamentoReservaInfo?.patrimonio || 'Reserva'}).`;
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

  const equipamentosReservaFiltrados = equipamentosReserva.filter(eq => {
    const termo = buscaPatrimonioReserva.toLowerCase().trim();
    if (!termo) return true;
    const patrimonioStr = String(eq.patrimonio || "").toLowerCase();
    const nomeStr = String(eq.nome || "").toLowerCase();
    return patrimonioStr.includes(termo) || nomeStr.includes(termo);
  });

  if (loading) return (
    <div className="p-12 text-center font-black text-slate-400 uppercase text-xs animate-pulse">
      Carregando bancada de atendimento técnico...
    </div>
  );

  const isConcluido = chamado?.status === "Concluído"

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* 🧭 HEADER COMPACTO COM STATUS E AÇÕES RÁPIDAS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase transition-all flex items-center gap-1 active:scale-95"
          >
            ← Voltar
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white font-black text-xs px-2.5 py-0.5 rounded-md">
                OS #{id}
              </span>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight truncate max-w-lg">
                {chamado?.titulo}
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">
              📍 Setor: <span className="text-slate-700">{chamado?.setor_nome || "Geral"}</span> 
              {chamado?.solicitante_nome && ` • 👤 Solicitante: ${chamado.solicitante_nome}`}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {chamado?.equipamento_id && !isConcluido && (
            <button
              type="button"
              onClick={() => setExibirPainelTroca(!exibirPainelTroca)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
            >
              <span>🔄</span> Substituir Ativo
            </button>
          )}

          <button 
            type="button"
            onClick={() => window.open(`/chamados/${id}/imprimir`, '_blank')} 
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-950 text-white rounded-xl text-xs font-black uppercase transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
          >
            <span>🖨️</span> Imprimir OS
          </button>
        </div>
      </div>

      {/* 🔄 PAINEL DE SUBSTITUIÇÃO EMERGENCIAL DE ATIVO */}
      {exibirPainelTroca && chamado?.equipamento_id && (
        <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-3xl border-2 border-amber-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-black text-amber-800 uppercase tracking-wider flex items-center gap-2">
              <span>🔄</span> Substituição / Permuta de Equipamento
            </h3>
            <button 
              type="button" 
              onClick={() => { setExibirPainelTroca(false); setBuscaPatrimonioReserva(""); }} 
              className="text-amber-800 hover:text-amber-950 font-black text-xs uppercase"
            >
              Fechar ✕
            </button>
          </div>
          <p className="text-xs text-amber-700 mb-4 font-medium leading-relaxed">
            O ativo atual <strong>{chamado.eq_nome} (Pat: {chamado.patrimonio || 'S/P'})</strong> passará para <strong className="text-red-600">"Inoperante"</strong>. O reserva assumirá o setor <strong>{chamado.setor_nome}</strong> como <strong>"Ativo"</strong>.
          </p>

          <form onSubmit={handleTrocaEquipamento} className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-black text-amber-800 uppercase mb-1">
                Filtrar Ativo Reserva
              </label>
              <input
                type="text"
                placeholder="Buscar patrimônio ou nome..."
                value={buscaPatrimonioReserva}
                onChange={e => setBuscaPatrimonioReserva(e.target.value)}
                className="w-full p-2.5 border-2 border-amber-200 bg-white rounded-xl text-xs font-bold outline-none text-slate-700"
              />
            </div>

            <div className="flex-[2] min-w-[280px]">
              <label className="block text-[10px] font-black text-amber-800 uppercase mb-1">
                Selecione o Reserva Disponível ({equipamentosReservaFiltrados.length})
              </label>
              <select
                disabled={executandoTroca}
                required
                className="w-full p-2.5 border-2 border-amber-200 bg-white rounded-xl text-xs font-bold outline-none text-slate-700"
                value={equipamentoReservaSelecionado}
                onChange={e => setEquipamentoReservaSelecionado(e.target.value)}
              >
                <option value="">Selecione o equipamento...</option>
                {equipamentosReservaFiltrados.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    [Pat: {eq.patrimonio || 'S/P'}] {eq.nome} ({eq.setor_nome || 'Reserva'})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={executandoTroca || !equipamentoReservaSelecionado}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {executandoTroca ? "Trocando..." : "Confirmar Permuta 🔁"}
            </button>
          </form>
        </div>
      )}

      {/* 📦 PAINEL PRINCIPAL DE DUAS COLUNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* COLUNA ESQUERDA: CONTEXTO, PROBLEMA, FOTOS E PEÇAS (5 COLUNAS) */}
        <div className="lg:col-span-5 space-y-6">

          {/* CARD DE CONTEXTO DO CHAMADO & FOTO DE ABERTURA */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center justify-between">
              <span>🚨 Problema Reportado</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${
                chamado?.prioridade === 'Urgente' ? 'bg-red-500' : chamado?.prioridade === 'Alta' ? 'bg-amber-500' : 'bg-slate-600'
              }`}>
                {chamado?.prioridade || 'Média'}
              </span>
            </h3>

            <div className="p-3.5 bg-red-50/60 border border-red-100 rounded-2xl text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
              {chamado?.descricao_problema || "Sem detalhes adicionais."}
            </div>

            {/* ATIVO VINCULADO */}
            {chamado?.eq_nome && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-blue-600 uppercase block">Equipamento Vinculado:</span>
                <p className="text-xs font-black text-slate-800 uppercase">{chamado.eq_nome}</p>
                <div className="text-[10px] text-slate-500 font-bold flex gap-3">
                  <span>PAT: <strong>{chamado.patrimonio || 'S/P'}</strong></span>
                  <span>S/N: <strong>{chamado.num_serie || 'N/A'}</strong></span>
                  <span>Marca: <strong>{chamado.fabricante || 'S/M'}</strong></span>
                </div>
              </div>
            )}

            {/* MINIATURA DA FOTO DE ABERTURA */}
            {chamado?.foto_abertura && (
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Evidência na Abertura:</span>
                <img 
                  src={`${BASE_URL}${chamado.foto_abertura}`} 
                  className="w-full h-36 object-cover rounded-2xl border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                  onClick={() => window.open(`${BASE_URL}${chamado.foto_abertura}`)}
                  alt="Foto Abertura"
                  title="Clique para ampliar"
                />
              </div>
            )}
          </div>

          {/* CARD DE APLICAÇÃO DE PEÇAS E ALMOXARIFADO */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                📦 Insumos & Peças
              </h3>
              <span className="text-xs font-black text-blue-600">
                Total: R$ {totalPecas.toFixed(2)}
              </span>
            </div>

            <form onSubmit={handleAdicionarPeca} className="flex gap-2">
              <select
                disabled={isConcluido}
                className="flex-[3] p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-slate-700"
                value={pecaSelecionada}
                onChange={e => setPecaSelecionada(e.target.value)}
              >
                <option value="">Selecione o insumo...</option>
                {itensEstoque.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.nome} (Saldo: {item.quantidade})
                  </option>
                ))}
              </select>

              <input
                disabled={isConcluido}
                type="number"
                min="1"
                className="w-16 p-2.5 border-2 border-slate-100 rounded-xl text-center font-bold text-xs bg-slate-50 outline-none"
                value={qtdPeca}
                onChange={e => setQtdPeca(Number(e.target.value))}
              />

              <button 
                disabled={isConcluido || !pecaSelecionada} 
                type="submit" 
                className="px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase shadow-sm transition-all disabled:opacity-50"
              >
                +
              </button>
            </form>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {chamado?.itens_vinculados?.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-700">{p.nome} <strong className="text-slate-400 text-[10px]">x{p.quantidade}</strong></span>
                  <span className="font-mono font-bold text-slate-800">R$ {(Number(p.quantidade) * Number(p.valor_unitario)).toFixed(2)}</span>
                </div>
              ))}
              {(!chamado?.itens_vinculados || chamado.itens_vinculados.length === 0) && (
                <p className="text-[11px] text-slate-400 italic text-center py-2">Nenhuma peça debitada nesta OS.</p>
              )}
            </div>
          </div>

          {/* CARD DE ANEXOS E LAUDOS TÉCNICOS */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">
              📎 Laudos & Arquivos ({listaDocumentos.length})
            </h3>
            
            <form onSubmit={handleUploadDocumento} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
              <input 
                disabled={isConcluido}
                type="file" 
                accept="image/*,application/pdf"
                className="text-xs w-full block file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 disabled:opacity-50"
                onChange={e => setDocumentoSelecionado(e.target.files[0])}
              />
              <button 
                disabled={isConcluido || !documentoSelecionado} 
                type="submit" 
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-sm disabled:opacity-50"
              >
                + Anexar Laudo
              </button>
            </form>

            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {listaDocumentos.map((doc) => (
                <div key={doc.id} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 truncate max-w-[200px]" title={doc.nome_original}>
                    {doc.tipo_mimetype.includes('pdf') ? '📄' : '📷'} {doc.nome_original}
                  </span>
                  <a 
                    href={`${BASE_URL}${doc.url_arquivo}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 font-black text-[10px] uppercase bg-white px-2 py-1 rounded shadow-sm border border-slate-100"
                  >
                    Abrir ↗
                  </a>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* COLUNA DIREITA: FORMULÁRIO DE SOLUÇÃO E CRONOLOGIA (7 COLUNAS) */}
        <div className="lg:col-span-7 space-y-6">

          <form onSubmit={handleSalvarAtendimento} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                📝 Diagnóstico & Parecer Técnico
              </h3>
              <div className="text-xs font-black text-slate-700">
                Custo Total OS: <strong className="text-emerald-600">R$ {custoTotalOS.toFixed(2)}</strong>
              </div>
            </div>

            {isConcluido && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold p-3 rounded-2xl">
                🔒 Chamado concluído. Formulário em modo de somente leitura.
              </div>
            )}

            {/* SELETOR EQUIPE INTERNA / TERCEIRIZADA */}
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                disabled={isConcluido}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${tipoAtendimento === "Interno" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}
                onClick={() => setTipoAtendimento("Interno")}
              >
                Equipe Interna
              </button>
              <button
                type="button"
                disabled={isConcluido}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${tipoAtendimento === "Externo" ? "bg-white text-red-500 shadow-sm" : "text-slate-400"}`}
                onClick={() => setTipoAtendimento("Externo")}
              >
                Fornecedor Terceirizado
              </button>
            </div>

            {/* CAMPOS SE FOR FORNECEDOR EXTERNO */}
            {tipoAtendimento === "Externo" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-in fade-in duration-150">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Empresa Prestadora</label>
                  <select disabled={isConcluido} className="w-full p-2.5 border-2 border-slate-100 bg-white rounded-xl text-xs font-bold outline-none" value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}>
                    <option value="">Selecione o fornecedor...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">NF-e & Custo do Serviço</label>
                  <div className="flex gap-2">
                    <input disabled={isConcluido} type="text" placeholder="Nº NF" className="w-1/2 p-2.5 border-2 border-slate-100 bg-white rounded-xl text-xs outline-none" value={nfReferencia} onChange={e => setNfReferencia(e.target.value)} />
                    <input disabled={isConcluido} type="number" step="0.01" placeholder="R$ Serviço" className="w-1/2 p-2.5 border-2 border-slate-100 bg-white rounded-xl text-xs font-mono outline-none" value={custoServico} onChange={e => setCustoServico(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* SELEÇÃO DO STATUS E TÉCNICO RESPONSÁVEL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Status Operacional</label>
                <select disabled={isConcluido} className="w-full p-2.5 border-2 border-slate-100 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:border-blue-500" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="Aberto">🔴 Aberto</option>
                  <option value="Em Atendimento">🟡 Em Atendimento</option>
                  <option value="Concluído">🟢 Concluído</option>
                </select>
              </div>

              {tipoAtendimento === "Interno" && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Técnico Designado</label>
                  <select 
                    disabled={isConcluido} 
                    required={tipoAtendimento === "Interno"}
                    className="w-full p-2.5 border-2 border-slate-100 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:border-blue-500" 
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

            {/* BOTÕES DE TEXTO RÁPIDO */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-wider">
                Inserções Rápidas (1 clique):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Realizada limpeza técnica e testes.")} className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">💧 Limpeza e Testes</button>
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Substituição de componente avariado.")} className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">🔄 Troca de Peça</button>
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Equipamento testado e liberado para o setor.")} className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">✅ Testado e Ok</button>
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Ajuste de configuração e calibração.")} className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">⚙️ Calibração</button>
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Aguardando chegada de peças.")} className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">⏳ Aguardando Peças</button>
                <button type="button" disabled={isConcluido} onClick={() => injetarTextoRapido("Nenhum defeito constatado no local.")} className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-[10px] font-bold text-left bg-slate-50 transition-colors">❓ Sem defeito</button>
              </div>
            </div>

            {/* RELATÓRIO TÉCNICO */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">
                Relatório Descritivo do Serviço Executado
              </label>
              <textarea
                disabled={isConcluido}
                required
                rows={5}
                className="w-full p-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-medium text-xs text-slate-700 resize-none transition-all bg-slate-50"
                placeholder="Descreva detalhadamente o que foi realizado nesta visita..."
                value={descricaoSolucao}
                onChange={e => setDescricaoSolucao(e.target.value)}
              />
            </div>

            {!isConcluido && (
              <button 
                type="submit" 
                className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-green-100 transition-all active:scale-[0.98]"
              >
                💾 Salvar Atualização Técnica
              </button>
            )}
          </form>

          {/* CRONOLOGIA / HISTÓRICO DE ATIVIDADES */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">
              🕒 Histórico de Atividades Desta OS
            </h3>
            <div className="overflow-y-auto max-h-56 pr-1 space-y-3">
              {chamado?.historico?.map((h, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <div className="w-2 rounded-full bg-blue-500 shrink-0 mt-1"></div>
                  <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 mb-1">
                      <span className="text-slate-700 font-black">{h.tecnico_nome}</span>
                      <span>{new Date(h.data_registro).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-slate-600 font-medium whitespace-pre-wrap">{h.texto_historico}</p>
                  </div>
                </div>
              ))}
              {(!chamado?.historico || chamado.historico.length === 0) && (
                <p className="text-xs font-bold text-slate-400 italic text-center py-2">Nenhum evento registrado.</p>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}

export default TratarChamado;