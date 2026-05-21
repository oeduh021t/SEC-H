import { useEffect, useState } from "react"

export function RelatorioCustosSetor() {
  const [dados, setDados] = useState([])
  const [setores, setSetores] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [dataInicio, setDataInicio] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0])
  const [setorSelecionado, setSetorSelecionado] = useState("todos")

  const API_URL = "http://192.168.5.101:3000/api"

  const carregarSetores = async () => {
    try {
      const res = await fetch(`${API_URL}/setores`).then(res => res.json())
      setSetores(res || [])
    } catch (err) {
      console.error("Erro ao carregar setores:", err)
    }
  }

  const carregarRelatorio = async () => {
    setLoading(true)
    try {
      const url = `${API_URL}/relatorios/custos-setor?data_inicio=${dataInicio} 00:00:00&data_fim=${dataFim} 23:59:59&setor_id=${setorSelecionado}`
      const res = await fetch(url).then(res => res.json())
      setDados(res || [])
    } catch (err) {
      console.error("Erro ao carregar relatório:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarSetores() }, [])
  useEffect(() => { carregarRelatorio() }, [dataInicio, dataFim, setorSelecionado])

  const totalChamadosPeriodo = dados.reduce((acc, obj) => acc + Number(obj.total_chamados || 0), 0)
  const totalGeralServicos = dados.reduce((acc, obj) => acc + Number(obj.total_custo_servico || 0), 0)
  const totalGeralPecas = dados.reduce((acc, obj) => acc + Number(obj.total_custo_pecas || 0), 0)
  const totalInvestidoGeral = totalGeralServicos + totalGeralPecas

  // Função para disparar a janela de impressão do navegador
  const handleImprimir = () => {
    window.print()
  }

  // Formatação de data para o cabeçalho impresso
  const formatarDataBR = (dataStr) => {
    if (!dataStr) return ""
    const [ano, mes, dia] = dataStr.split("-")
    return `${dia}/${mes}/${ano}`
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800 print:bg-white print:p-0">
      
      {/* CABEÇALHO (Adicionado o botão de imprimir que some na impressão) */}
      <div className="mb-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center print:shadow-none print:border-none print:p-0 print:mb-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 print:text-lg">
            <span className="text-red-500 print:hidden">📊</span> SEC-H - RELATÓRIO DE CUSTOS POR SETOR
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider print:text-[10px]">
            Período: {formatarDataBR(dataInicio)} até {formatarDataBR(dataFim)}
          </p>
        </div>
        
        {/* Botão que desaparece na folha impressa */}
        <button 
          onClick={handleImprimir}
          className="print:hidden px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
        >
          🖨️ Imprimir Relatório
        </button>
      </div>

      {/* BARRA DE FILTROS (Ocultada completamente na impressão) */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:hidden">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Data Inicial</label>
          <input type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Data Final</label>
          <input type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500" value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Filtrar Setor</label>
          <select className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500" value={setorSelecionado} onChange={e => setSetorSelecionado(e.target.value)}>
            <option value="todos">⭐ Todos os Setores</option>
            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
      </div>

      {/* CARDS INDICADORES (Ajustados para ficarem lado a lado em linha na folha impressa) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-2 print:mb-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 print:p-2 print:border">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px]">Chamados Atendidos</span>
          <p className="text-xl font-black text-slate-800 mt-1 print:text-sm">{totalChamadosPeriodo} OS</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 print:p-2 print:border">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px]">Mão de Obra / Serv.</span>
          <p className="text-xl font-black text-amber-600 mt-1 print:text-sm">R$ {totalGeralServicos.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 print:p-2 print:border">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px]">Insumos / Peças</span>
          <p className="text-xl font-black text-blue-600 mt-1 print:text-sm">R$ {totalGeralPecas.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 bg-gradient-to-br from-slate-900 to-slate-800 text-white print:p-2 print:bg-none print:text-slate-800 print:border">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px] print:text-slate-400">Despesa Total</span>
          <p className="text-xl font-black text-green-400 mt-1 print:text-sm print:text-green-600">R$ {totalInvestidoGeral.toFixed(2)}</p>
        </div>
      </div>

      {/* TABELA DE RESULTADOS */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:p-0 print:border-none print:shadow-none">
        {loading ? (
          <div className="text-center py-8 font-bold text-xs text-slate-400">Processando métricas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider print:text-[9px] print:text-slate-600">
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
                    <td className="py-3.5 text-center font-bold text-slate-500">{obj.total_chamados} OS</td>
                    <td className="py-3.5 text-right font-mono text-slate-600">R$ {Number(obj.total_custo_servico || 0).toFixed(2)}</td>
                    <td className="py-3.5 text-right font-mono text-slate-600">R$ {Number(obj.total_custo_pecas || 0).toFixed(2)}</td>
                    <td className="py-3.5 text-right font-mono font-black text-slate-800 print:text-slate-900">
                      R$ {Number(obj.custo_total_geral || 0).toFixed(2)}
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

      {/* RODAPÉ EXCLUSIVO DA IMPRESSÃO (CARIMBO DE AUTENTICIDADE) */}
      <div className="hidden print:block mt-12 pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
        Relatório emitido pelo sistema SEC-H Engenharia Clínica em {new Date().toLocaleString('pt-BR')}
      </div>
    </div>
  )
}