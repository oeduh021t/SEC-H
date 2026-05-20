import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import SignaturePad from "react-signature-canvas"

export function ImprimirOS() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chamado, setChamado] = useState(null)
  const [loading, setLoading] = useState(true)

  const [nomeResponsavelTecnico, setNomeResponsavelTecnico] = useState("")
  const [nomeResponsavelSetor, setNomeResponsavelSetor] = useState("")

  const padTecnico = useRef(null)
  const padSetor = useRef(null)

  const API_URL = "http://192.168.5.101:3000/api"
  const BASE_URL = "http://192.168.5.101:3000"

  const carregarOS = () => {
    fetch(`${API_URL}/chamados/${id}`)
      .then(res => res.json())
      .then(data => {
        setChamado(data)
        setLoading(false)
      })
      .catch(err => {
        console.error("Erro ao carregar OS:", err)
        setLoading(false)
      })
  }

  useEffect(() => { carregarOS() }, [id])

  const salvarAssinatura = (tipo, padRef, nomeDigitado) => {
    if (!padRef.current || padRef.current.isEmpty()) {
      return alert("Desenhe a assinatura no quadro antes de confirmar.")
    }

    if (!nomeDigitado || !nomeDigitado.trim()) {
      return alert("Por favor, digite o nome por extenso do responsável antes de confirmar.")
    }

    const base64 = padRef.current.getTrimmedCanvas().toDataURL("image/png")

    fetch(`${API_URL}/chamados/${id}/assinar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, assinaturaBase64: base64 })
    })
    .then((res) => {
      if (res.ok) {
        alert("Assinatura gravada com sucesso! 🎉")
        carregarOS()
      } else {
        alert("O servidor recusou o salvamento.")
      }
    })
    .catch(err => alert("Erro de comunicação com o servidor API."))
  }

  if (loading) return <p className="text-center p-8 font-bold text-slate-500">Gerando Relatório Técnico...</p>
  if (!chamado) return <p className="text-center p-8 font-bold text-red-500">Ordem de Serviço não encontrada.</p>

  return (
    <div className="bg-white min-h-screen p-4 text-slate-800 text-xs leading-relaxed max-w-[190mm] mx-auto font-sans relative code-os-render">

      {/* ESTILO DE PRINT CORRIGIDO: SEM TELA EM BRANCO */}
      <style>{`
        @media print {
          div[class*="w-64"], nav, aside, header, .print-ocultar, button {
            display: none !important;
          }
          body, main, .code-os-render {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* BOTÕES DE CONTROLE */}
      <div className="print-ocultar flex gap-2 justify-center mb-6 bg-slate-100 p-3 rounded-xl border border-slate-200">
        <button
          onClick={() => window.print()}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-bold uppercase text-[10px]"
        >
          🖨️ Imprimir no Papel
        </button>
        <button
          onClick={() => navigate(-1)}
          className="bg-slate-500 hover:bg-slate-600 text-white px-5 py-2 rounded-xl font-bold uppercase text-[10px]"
        >
          Voltar
        </button>
      </div>

      {/* CABEÇALHO */}
      <div className="border-2 border-slate-950 p-4 bg-slate-50 text-center relative mb-4 rounded-xl">
        {chamado.tipo_atendimento === "Externo" && (
          <div className="absolute right-3 top-3 bg-red-600 text-white font-black px-2 py-0.5 text-[9px] rounded uppercase">Assistência Externa</div>
        )}
        <h2 className="text-base font-black uppercase m-0 tracking-wide">ORDEM DE SERVIÇO № {String(chamado.id).padStart(6, '0')}</h2>
        <span className="font-bold text-slate-500 block mt-1">Hospital Domingos Lourenço - Engenharia Clínica</span>
      </div>

      {/* DADOS DO ATIVO */}
      <table className="w-full border-collapse border-2 border-slate-950 mb-4 text-left">
        <tbody>
          <tr>
            <td className="border border-slate-400 p-2 font-bold" colSpan={2}>
              EQUIPAMENTO: <span className="font-normal text-slate-600">{chamado.eq_nome || "Manutenção de Infraestrutura / Predial"}</span>
            </td>
            <td className="border border-slate-400 p-2 text-center align-middle w-32" rowSpan={3}>
              {chamado.foto_abertura ? (
                <img src={`${BASE_URL}${chamado.foto_abertura}`} className="max-h-16 max-w-full mx-auto rounded border" alt="Ativo" />
              ) : (
                <span className="text-2xl opacity-30">🔧</span>
              )}
            </td>
          </tr>
          <tr>
            <td className="border border-slate-400 p-2 font-bold">PATRIMÔNIO: <span className="font-normal font-mono text-slate-600">{chamado.patrimonio || "N/A"}</span></td>
            <td className="border border-slate-400 p-2 font-bold">Nº SÉRIE: <span className="font-normal font-mono text-slate-600">{chamado.num_serie || "N/A"}</span></td>
          </tr>
          <tr>
            <td className="border border-slate-400 p-2 font-bold">LOCALIZAÇÃO: <span className="font-normal text-slate-600">{chamado.setor_nome || "Não mapeado"}</span></td>
            <td className="border border-slate-400 p-2 font-bold">TÉCNICO REGISTRADO: <span className="font-normal text-slate-600">{chamado.tecnico_responsavel || "Não atribuído"}</span></td>
          </tr>
        </tbody>
      </table>

      {/* SEÇÕES TEXTUAIS */}
      <div className="bg-slate-950 text-white font-black p-2 uppercase text-[10px] mb-1 rounded-t-lg">1. Descrição do Defeito e Diagnóstico</div>
      <div className="border-2 border-t-0 border-slate-950 p-3 mb-4 whitespace-pre-wrap rounded-b-lg min-h-16 text-slate-700 font-medium">
        {chamado.descricao_problema}
      </div>

      <div className="bg-slate-950 text-white font-black p-2 uppercase text-[10px] mb-1 rounded-t-lg">2. Relatório de Execução Técnica</div>
      <div className="border-2 border-t-0 border-slate-950 p-3 mb-4 min-h-24 rounded-b-lg text-slate-700 font-medium">
        {chamado.descricao_solucao || "Aguardando laudo descritivo do técnico executante."}
      </div>

      {/* QUADRO DE ASSINATURAS */}
      <div className="grid grid-cols-2 gap-8 mt-12 text-center">

        {/* ASSINATURA 1: TÉCNICO */}
        <div className="flex flex-col items-center">
          <div className="w-full border-b border-slate-950 min-h-[100px] flex flex-col items-center justify-center pb-2">
            {chamado.assinatura_tecnico ? (
              <img src={chamado.assinatura_tecnico} className="h-20 max-w-full object-contain" alt="Assinatura Técnico" />
            ) : (
              <div className="print-ocultar border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 space-y-2">
                <input
                  type="text"
                  placeholder="Nome do Técnico"
                  className="w-full p-1.5 border rounded-lg text-[11px] text-center"
                  value={nomeResponsavelTecnico}
                  onChange={e => setNomeResponsavelTecnico(e.target.value)}
                />
                <SignaturePad ref={padTecnico} canvasProps={{ className: "w-48 h-12 bg-white border rounded-lg" }} />
                <button
                  type="button"
                  onClick={() => salvarAssinatura('tecnico', padTecnico, nomeResponsavelTecnico)}
                  className="block w-full bg-blue-600 text-white text-[9px] py-1 font-bold uppercase rounded-md shadow-sm"
                >
                  Confirmar Assinatura
                </button>
              </div>
            )}
          </div>
          <span className="font-bold text-[10px] mt-1.5 text-slate-700">Técnico Executante</span>
        </div>

        {/* ASSINATURA 2: RESPONSÁVEL DO SETOR */}
        <div className="flex flex-col items-center">
          <div className="w-full border-b border-slate-950 min-h-[100px] flex flex-col items-center justify-center pb-2">
            {chamado.assinatura_setor ? (
              <img src={chamado.assinatura_setor} className="h-20 max-w-full object-contain" alt="Assinatura Setor" />
            ) : (
              <div className="print-ocultar border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 space-y-2">
                <input
                  type="text"
                  placeholder="Nome do Responsável"
                  className="w-full p-1.5 border rounded-lg text-[11px] text-center"
                  value={nomeResponsavelSetor}
                  onChange={e => setNomeResponsavelSetor(e.target.value)}
                />
                <SignaturePad ref={padSetor} canvasProps={{ className: "w-48 h-12 bg-white border rounded-lg" }} />
                <button
                  type="button"
                  onClick={() => salvarAssinatura('setor', padSetor, nomeResponsavelSetor)}
                  className="block w-full bg-blue-600 text-white text-[9px] py-1 font-bold uppercase rounded-md shadow-sm"
                >
                  Confirmar Aceite
                </button>
              </div>
            )}
          </div>
          <span className="font-bold text-[10px] mt-1.5 text-slate-700">Aceite do Setor (Responsável)</span>
        </div>

      </div>
    </div>
  )
}
