import { useEffect, useState } from "react"

export function RelatorioChamadosSetor() {
  const [dados, setDados] = useState([])
  const [setores, setSetores] = useState([])
  const [loading, setLoading] = useState(true)

  const [dataInicio, setDataInicio] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]
  )

  const [dataFim, setDataFim] = useState(
    new Date().toISOString().split("T")[0]
  )

  const [setorSelecionado, setSetorSelecionado] = useState("todos")

  const API_URL = "http://192.168.5.101:3000/api"

  // 🔑 AUXILIAR: Captura dinamicamente o privilégio operacional do operador logado
  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  const carregarSetores = async () => {
    try {
      const res = await fetch(`${API_URL}/setores`, {
        headers: { "x-usuario-nivel": obterNivelUsuario() } // 🔑 Header de segurança injetado
      }).then(res => res.json())
      setSetores(Array.isArray(res) ? res : [])
    } catch (err) {
      console.error("Erro ao carregar setores:", err)
    }
  }

  const carregarRelatorio = async () => {
    setLoading(true)

    try {
      const url =
        `${API_URL}/relatorios/chamados-setor` +
        `?data_inicio=${dataInicio}` +
        `&data_fim=${dataFim}` +
        `&setor_id=${setorSelecionado}`

      const res = await fetch(url, {
        headers: { "x-usuario-nivel": obterNivelUsuario() } // 🔑 Header de segurança injetado
      }).then(res => res.json())

      // Protente contra erros 500: só define se for de fato uma lista []
      setDados(Array.isArray(res) ? res : [])
    } catch (err) {
      console.error("Erro ao carregar relatório:", err)
      setDados([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarSetores()
  }, [])

  // 🛠️ CORRIGIDO: Removido useEffect duplicado e ajustadas as dependências sem erros de digitação
  useEffect(() => {
    carregarRelatorio()
  }, [dataInicio, dataFim, setorSelecionado])

  const totalChamados = dados.reduce(
    (acc, obj) => acc + Number(obj.total_chamados || 0),
    0
  )

  // 🛠️ CORRIGIDO: Alinhamento das variáveis em português para evitar erros de referência
  const setorOrdenado = [...dados].sort(
    (a, b) => (b.total_chamados || 0) - (a.total_chamados || 0)
  )
  const setorMaisAtivo = setorOrdenado.length > 0 ? setorOrdenado[0] : null;

  const mediaChamados =
    dados.length > 0
      ? (totalChamados / dados.length).toFixed(1)
      : 0

  const formatarDataBR = (dataStr) => {
    if (!dataStr) return ""
    const partes = dataStr.split(" ")[0].split("-")
    if (partes.length < 3) return dataStr
    const [ano, mes, dia] = partes
    return `${dia}/${mes}/${ano}`
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">

      <style>{`
        @media print {
          body * {
            visibility: hidden;
            background: white !important;
          }

          .relatorio-container,
          .relatorio-container * {
            visibility: visible;
          }

          .relatorio-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }

          .hide-print {
            display: none !important;
          }
        }
      `}</style>

      {/* BOTÕES */}
      <div className="flex justify-end mb-6 hide-print">
        <button
          onClick={() => window.print()}
          className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-transform shadow-md"
        >
          🖨️ IMPRIMIR RELATÓRIO
        </button>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 hide-print">

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">
            Data Inicial
          </label>

          <input
            type="date"
            className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-black"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">
            Data Final
          </label>

          <input
            type="date"
            className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-black"
            value={dataFim}
            onChange={e => setDataFim(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">
            Filtrar Setor
          </label>

          <select
            className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-slate-700"
            value={setorSelecionado}
            onChange={e => setSetorSelecionado(e.target.value)}
          >
            <option value="todos">⭐ Todos os Setores</option>

            {setores.map(s => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relatorio-container space-y-6">

        {/* CABEÇALHO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:border-none print:p-0">
          <h1 className="text-xl font-black text-slate-800">
            SEC-H - RELATÓRIO DE CHAMADOS POR SETOR
          </h1>

          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Período: {formatarDataBR(dataInicio)} até {formatarDataBR(dataFim)}
          </p>
        </div>

        {/* CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase">
              Total de Chamados
            </span>

            <p className="text-2xl font-black text-slate-800 mt-1">
              {totalChamados}
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase">
              Média por Setor
            </span>

            <p className="text-2xl font-black text-blue-600 mt-1">
              {mediaChamados}
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-sm print:text-slate-800 print:bg-none print:border print:border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase print:text-slate-400">
              Setor Mais Ativo
            </span>

            <p className="text-lg font-black text-green-400 mt-1 print:text-green-600">
              {setorMaisAtivo?.nome_setor || "-"}
            </p>
          </div>

        </div>

        {/* TABELA */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:p-0 print:border-none">

          {loading ? (
            <div className="text-center py-8 font-bold text-xs text-slate-400">
              Processando relatório...
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left border-collapse">

                <thead>
                  <tr className="border-b-2 border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider print:text-slate-700">
                    <th className="pb-3">Setor</th>
                    <th className="pb-3 text-center">Qtd. Chamados</th>
                    <th className="pb-3 text-right">% do Total</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {dados.map((obj) => {

                    const percentual =
                      totalChamados > 0
                        ? (
                            (obj.total_chamados / totalChamados) *
                            100
                          ).toFixed(1)
                        : 0

                    return (
                      <tr
                        key={obj.setor_id}
                        className="text-xs hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-3.5 font-black text-slate-700">
                          {obj.nome_setor}
                        </td>

                        <td className="py-3.5 text-center font-bold text-slate-600">
                          {obj.total_chamados} OS
                        </td>

                        <td className="py-3.5 text-right font-black text-blue-600">
                          {percentual}%
                        </td>
                      </tr>
                    )
                  })}

                  {dados.length === 0 && (
                    <tr>
                      <td
                        colSpan="3"
                        className="text-center py-10 text-xs font-bold text-slate-400 italic"
                      >
                        Nenhum registro encontrado.
                      </td>
                    </tr>
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>
    </div>
  )
}

export default RelatorioChamadosSetor;