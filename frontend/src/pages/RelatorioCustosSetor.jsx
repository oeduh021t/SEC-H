import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

export function RelatorioCustosSetor() {
  const navigate = useNavigate()
  
  const [dados, setDados] = useState([])
  const [setores, setSetores] = useState([])
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)
  
  const [dataInicio, setDataInicio] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0])
  const [setorSelecionado, setSetorSelecionado] = useState("todos")

  // ESTADOS DO MODAL DRILL-DOWN
  const [modalAberto, setModalAberto] = useState(false)
  const [setorAtivoModal, setSetorAtivoModal] = useState(null)
  const [chamadosModal, setChamadosModal] = useState([])
  const [carregandoModal, setCarregandoModal] = useState(false)

  const API_URL = "http://192.168.5.101:3000/api"

  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  const carregarSetores = async () => {
    try {
      const res = await fetch(`${API_URL}/setores`, {
        headers: { "x-usuario-nivel": obterNivelUsuario() }
      }).then(res => res.json())
      setSetores(res || [])
    } catch (err) {
      console.error("Erro ao carregar setores:", err)
    }
  }

  const carregarRelatorio = async () => {
    setLoading(true)
    try {
      const url = `${API_URL}/relatorios/custos-setor?data_inicio=${dataInicio} 00:00:00&data_fim=${dataFim} 23:59:59&setor_id=${setorSelecionado}`
      const res = await fetch(url, {
        headers: { "x-usuario-nivel": obterNivelUsuario() }
      }).then(res => res.json())
      setDados(res || [])
    } catch (err) {
      console.error("Erro ao carregar relatório:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarSetores() }, [])
  useEffect(() => { carregarRelatorio() }, [dataInicio, dataFim, setorSelecionado])

  // 📊 EXPORTAR EXCEL (.XLSX)
  const handleExportarExcel = async () => {
    setExportando(true)
    try {
      const url = `${API_URL}/relatorios/exportar/custos-setor?data_inicio=${dataInicio} 00:00:00&data_fim=${dataFim} 23:59:59&setor_id=${setorSelecionado}`
      
      const res = await fetch(url, {
        headers: { "x-usuario-nivel": obterNivelUsuario() }
      })

      if (!res.ok) throw new Error("Falha ao gerar o arquivo Excel.")

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `custos_por_setor_${dataInicio}_a_${dataFim}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      alert("Erro ao exportar Excel: " + err.message)
    } finally {
      setExportando(false)
    }
  }

  // 🔍 AÇÃO DO DRILL-DOWN: Abre o Modal e carrega as OSs do setor clicado
  const abrirModalDetalhes = async (setorObj) => {
    if (!setorObj || setorObj.total_chamados === 0) return;

    setSetorAtivoModal(setorObj)
    setModalAberto(true)
    setCarregandoModal(true)

    try {
      const url = `${API_URL}/relatorios/chamados-detalhes-setor?setor_id=${setorObj.setor_id}&data_inicio=${dataInicio} 00:00:00&data_fim=${dataFim} 23:59:59`
      const res = await fetch(url, {
        headers: { "x-usuario-nivel": obterNivelUsuario() }
      }).then(res => res.json())
      setChamadosModal(res || [])
    } catch (err) {
      console.error("Erro ao carregar detalhamento de chamados:", err)
      setChamadosModal([])
    } finally {
      setCarregandoModal(false)
    }
  }

  // 🎯 NAVEGAÇÃO DIRETA PARA A TELA CENTRAL DE CHAMADOS
  const handleAbrirChamado = (osId) => {
    setModalAberto(false)
    navigate('/chamados', { state: { buscaId: osId } })
  }

  const totalChamadosPeriodo = dados.reduce((acc, obj) => acc + Number(obj.total_chamados || 0), 0)
  const totalGeralServicos = dados.reduce((acc, obj) => acc + Number(obj.total_custo_servico || 0), 0)
  const totalGeralPecas = dados.reduce((acc, obj) => acc + Number(obj.total_custo_pecas || 0), 0)
  const totalInvestidoGeral = totalGeralServicos + totalGeralPecas

  const formatarDataBR = (dataStr) => {
    if (!dataStr) return ""
    const [dataPart] = dataStr.replace('T', ' ').split(' ')
    const partes = dataPart.split("-")
    if (partes.length < 3) return dataStr
    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
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

      {/* Botões Superiores de Ação */}
      <div className="flex gap-2 justify-end mb-6 hide-print">
        <button 
          onClick={handleExportarExcel} 
          disabled={exportando || loading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
        >
          <span>📊</span> {exportando ? "Gerando..." : "Exportar Excel"}
        </button>

        <button 
          onClick={() => window.print()} 
          className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-2"
        >
          <span>🖨️</span> Imprimir Relatório
        </button>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 hide-print">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Data Inicial</label>
          <input type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-black" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Data Final</label>
          <input type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-black" value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Filtrar Setor</label>
          <select className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-slate-700" value={setorSelecionado} onChange={e => setSetorSelecionado(e.target.value)}>
            <option value="todos">⭐ Todos os Setores</option>
            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
      </div>

      {/* CONTAINER ALVO DA IMPRESSÃO */}
      <div className="relatorio-container space-y-6">
        
        {/* CABEÇALHO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:border-none print:p-0 print:mb-4">
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 print:text-lg">
            SEC-H - RELATÓRIO DE CUSTOS E CHAMADOS POR SETOR
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider print:text-[10px] print:text-slate-500">
            Período Mapeado: {formatarDataBR(dataInicio)} até {formatarDataBR(dataFim)}
          </p>
        </div>

        {/* CARDS INDICADORES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 indicadores-impressao">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px]">Chamados Atendidos</span>
            <p className="text-xl font-black text-slate-800 mt-1 print:text-sm">{totalChamadosPeriodo} OS</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px]">Mão de Obra / Serv.</span>
            <p className="text-xl font-black text-amber-600 mt-1 print:text-sm">
              R$ {totalGeralServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px]">Insumos / Peças</span>
            <p className="text-xl font-black text-blue-600 mt-1 print:text-sm">
              R$ {totalGeralPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 bg-gradient-to-br from-slate-900 to-slate-800 text-white print:text-slate-800 print:bg-none">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px] print:text-slate-400">Despesa Total</span>
            <p className="text-xl font-black text-green-400 mt-1 print:text-sm print:text-green-600">
              R$ {totalInvestidoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* TABELA DE RESULTADOS */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:p-0 print:border-none">
          {loading ? (
            <div className="text-center py-8 font-bold text-xs text-slate-400">Processando métricas...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider print:text-[9px] print:text-slate-700">
                    <th className="pb-3">Setor Hospitalar</th>
                    <th className="pb-3 text-center">Nº Chamados</th>
                    <th className="pb-3 text-right">Custos de Serviços</th>
                    <th className="pb-3 text-right">Custos de Peças</th>
                    <th className="pb-3 text-right">Total Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                  {dados.map((obj) => (
                    <tr key={obj.setor_id} className="text-xs hover:bg-slate-50/50 transition-colors print:text-[10px]">
                      <td className="py-3.5 pr-2 font-black text-slate-700">{obj.nome_setor}</td>
                      
                      {/* BOTÃO DRILL-DOWN */}
                      <td className="py-3.5 text-center font-bold">
                        {obj.total_chamados > 0 ? (
                          <button 
                            type="button"
                            onClick={() => abrirModalDetalhes(obj)}
                            className="text-blue-600 hover:text-blue-800 font-black hover:underline cursor-pointer bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 transition-all hide-print"
                            title="Clique para ver a lista dessas Ordens de Serviço"
                          >
                            🔍 {obj.total_chamados} OS
                          </button>
                        ) : (
                          <span className="text-slate-400">0 OS</span>
                        )}
                        <span className="hidden print:inline">{obj.total_chamados} OS</span>
                      </td>

                      <td className="py-3.5 text-right font-mono text-slate-600">
                        R$ {Number(obj.total_custo_servico || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 text-right font-mono text-slate-600">
                        R$ {Number(obj.total_custo_pecas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 text-right font-mono font-black text-slate-800 print:text-slate-900">
                        R$ {Number(obj.custo_total_geral || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {dados.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-10 text-xs font-bold text-slate-400 italic">Nenhum registro encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        <div className="hidden print:block mt-12 pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
          Relatório financeiro emitido pelo sistema SEC-H Engenharia Clínica em {new Date().toLocaleString('pt-BR')}
        </div>

      </div>

      {/* MODAL DE DRILL-DOWN */}
      {modalAberto && setorAtivoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 hide-print">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150 border border-slate-100">
            
            {/* Header do Modal */}
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-blue-400">
                  📍 Ordens de Serviço — {setorAtivoModal.nome_setor}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                  Exibindo {setorAtivoModal.total_chamados} OS(s) no período de {formatarDataBR(dataInicio)} a {formatarDataBR(dataFim)}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setModalAberto(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white w-8 h-8 rounded-full font-black text-xs flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {carregandoModal ? (
                <div className="text-center py-12 font-bold text-xs text-slate-400 animate-pulse">
                  Carregando detalhes das Ordens de Serviço...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50">
                        <th className="p-3">Nº OS</th>
                        <th className="p-3">Data</th>
                        <th className="p-3">Título / Defeito</th>
                        <th className="p-3">Ativo Vinculado</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Custo Total</th>
                        <th className="p-3 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {chamadosModal.map((os) => (
                        <tr key={os.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-black text-blue-600">#{os.id}</td>
                          <td className="p-3 font-mono text-[11px] text-slate-500">{formatarDataBR(os.data_abertura)}</td>
                          <td className="p-3 font-bold text-slate-800">{os.titulo}</td>
                          <td className="p-3">
                            {os.equipamento_nome ? (
                              <span className="text-[10px] font-bold text-slate-600 block">
                                🤖 {os.equipamento_nome} {os.equipamento_patrimonio ? `(PAT: ${os.equipamento_patrimonio})` : ''}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 italic">Infraestrutura / Predial</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              os.status === 'Concluído' ? 'bg-green-100 text-green-700' :
                              os.status === 'Em Atendimento' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {os.status}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-700">
                            R$ {Number(os.custo_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            <button 
                              type="button" 
                              onClick={() => handleAbrirChamado(os.id)}
                              className="bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-transform active:scale-95"
                            >
                              Abrir ↗
                            </button>
                          </td>
                        </tr>
                      ))}

                      {chamadosModal.length === 0 && (
                        <tr>
                          <td colSpan="7" className="text-center py-8 text-xs font-bold text-slate-400 italic">
                            Nenhum chamado localizado para este setor no período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end">
              <button 
                type="button" 
                onClick={() => setModalAberto(false)}
                className="bg-slate-200 text-slate-600 hover:bg-slate-300 px-5 py-2 rounded-xl text-xs font-bold uppercase transition-colors"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

export default RelatorioCustosSetor;