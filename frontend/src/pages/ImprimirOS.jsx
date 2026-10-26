import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SignaturePad from "react-signature-canvas";

export function ImprimirOS() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chamado, setChamado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nomes, setNomes] = useState({ tecnico: "", setor: "" });

  const API_URL = "/api";
  const BASE_URL = window.location.port === "5173"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "";

  const padTecnico = useRef(null);
  const padSetor = useRef(null);

  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  const carregarOS = async () => {
    try {
      const res = await fetch(`${API_URL}/chamados/${id}`, {
        headers: { "x-usuario-nivel": obterNivelUsuario() }
      });
      const data = await res.json();
      setChamado(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) carregarOS(); }, [id]);

  const salvarAssinatura = async (tipo) => {
    const padRef = tipo === "tecnico" ? padTecnico : padSetor;
    const nomeDigitado = nomes[tipo];
    if (!padRef.current || padRef.current.isEmpty() || !nomeDigitado?.trim()) 
        return alert("Assinatura e Nome são obrigatórios.");

    const canvas = padRef.current.getCanvas();
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    try {
      const response = await fetch(`${API_URL}/chamados/${id}/assinar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-usuario-nivel": obterNivelUsuario() },
        body: JSON.stringify({ tipo, assinaturaBase64: tempCanvas.toDataURL("image/png"), nome: nomeDigitado.trim() })
      });
      if (response.ok) {
        setNomes(prev => ({ ...prev, [tipo]: "" }));
        await carregarOS();
      }
    } catch (err) { console.error(err); }
  };

  // Funções Auxiliares de Formatação e URLs
  const formatarData = (data) => data ? new Date(data).toLocaleString('pt-BR') : "---";
  const formatarMoeda = (valor) => new Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatarUrlImagem = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  if (loading) return <p className="p-8 text-center font-bold">Gerando Relatório...</p>;
  if (!chamado) return <p className="p-8 text-center text-red-500 font-bold">OS não encontrada.</p>;

  // Cálculo de Peças e Totais
  const totalPecas = chamado.itens_vinculados?.reduce((acc, item) => acc + (Number(item.quantidade || 0) * Number(item.valor_unitario || 0)), 0) || 0;
  const custoServico = Number(chamado.custo_servico || chamado.valor_servico_externo || 0);
  const totalGeral = totalPecas + custoServico;

  // Extração da Solução Técnica
  const logConclusao = chamado.historico?.find(
    (h) => h.status_momento?.toLowerCase() === "concluído" || h.status_momento?.toLowerCase() === "concluido"
  );
  const solucaoTecnica = logConclusao?.texto_historico?.trim() || chamado.descricao_solucao?.trim();

  // Flag de Fornecedor Terceirizado
  const temTerceirizado = Boolean(chamado.empresa_terceirizada || chamado.fornecedor_id || custoServico > 0);

  // Exibição do Setor Hierárquico
  const setorExibicao = chamado.setor_completo || 
    (chamado.setor_pai_nome ? `${chamado.setor_pai_nome} > ${chamado.setor_nome}` : chamado.setor_nome) || 
    "N/A";

  const fotoAberturaUrl = formatarUrlImagem(chamado.foto_abertura);
  const fotoConclusaoUrl = formatarUrlImagem(chamado.foto_conclusao);
  const temFotos = Boolean(fotoAberturaUrl || fotoConclusaoUrl);

  return (
    <div className="p-2 md:p-4 max-w-[210mm] mx-auto text-black bg-white">
      
      {/* CSS DE IMPRESSÃO TRAVADO EM EXATAMENTE 1 FOLHA */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }

        @media print {
          html, body {
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: hidden !important;
          }

          body * {
            visibility: hidden;
          }

          .os-impressao-container,
          .os-impressao-container * {
            visibility: visible;
          }

          .os-impressao-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-height: 282mm !important;
            border: 1.5px solid #000 !important;
            padding: 10px 14px !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .hide-print {
            display: none !important;
          }

          .foto-evidencia-box {
            height: 90px !important;
            max-height: 90px !important;
            padding: 2px !important;
          }
          .foto-evidencia-img {
            max-height: 82px !important;
            object-fit: contain !important;
          }
        }
      `}</style>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex gap-3 justify-center mb-4 hide-print">
        <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 text-sm hover:bg-slate-900 transition">
          🖨️ IMPRIMIR OS
        </button>
        <button onClick={() => navigate(-1)} className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-bold text-sm hover:bg-slate-300 transition">
          VOLTAR
        </button>
      </div>

      {/* CONTAINER PRINCIPAL */}
      <div className="os-impressao-container border-2 border-black p-4 bg-white">
        
        {/* CABEÇALHO */}
        <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2">
          <div>
            <h1 className="text-xl font-black italic tracking-tight text-slate-900 leading-none">HOSPITAL DOMINGOS LOURENÇO</h1>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mt-0.5">Engenharia Clínica & Manutenção Predial</p>
          </div>
          <div className="text-right">
            <div className="bg-black text-white px-3 py-0.5 text-[10px] font-black rounded mb-0.5 tracking-wider inline-block">ORDEM DE SERVIÇO</div>
            <p className="text-base font-black leading-tight">Nº {String(chamado.id).padStart(6, "0")}</p>
          </div>
        </div>

        {/* METADADOS DO CHAMADO */}
        <div className="grid grid-cols-4 gap-2 mb-2 text-[11px] bg-slate-50 p-2 border border-slate-300 rounded">
          <div><label className="font-bold text-slate-500 block text-[9px] uppercase">Status:</label><span className="font-extrabold">{chamado.status?.toUpperCase()}</span></div>
          <div><label className="font-bold text-slate-500 block text-[9px] uppercase">Tipo:</label><span className="font-extrabold">{chamado.tipo_manutencao?.toUpperCase() || "CORRETIVA"}</span></div>
          <div><label className="font-bold text-slate-500 block text-[9px] uppercase">Aberto em:</label><span className="font-bold">{formatarData(chamado.data_abertura)}</span></div>
          <div><label className="font-bold text-slate-500 block text-[9px] uppercase">Concluído em:</label><span className="font-bold">{formatarData(chamado.data_conclusao)}</span></div>
        </div>

        {/* BOX 1: DADOS DO ATIVO E LOCALIZAÇÃO */}
        <div className="mb-2 border border-black">
          <div className="bg-slate-100 border-b border-black px-2.5 py-0.5 text-[9px] font-black uppercase">
            1. Identificação do Ativo / Local
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 p-2 text-[11px]">
            <p><strong>Equipamento:</strong> {chamado.eq_nome || "N/A"}</p>
            <p><strong>Patrimônio:</strong> {chamado.patrimonio || "N/A"}</p>
            <p><strong>Modelo:</strong> {chamado.modelo || "N/A"}</p>
            <p><strong>Nº de Série:</strong> {chamado.num_serie || "N/A"}</p>
            <p className="col-span-2"><strong>Setor / Local:</strong> <span className="font-bold">{setorExibicao}</span></p>
            <p className="col-span-2"><strong>Solicitante:</strong> {chamado.solicitante_nome || "N/A"}</p>
          </div>
        </div>

        {/* BOX 2: DADOS DO FORNECEDOR / TERCEIRIZADO */}
        {temTerceirizado && (
          <div className="mb-2 border border-black">
            <div className="bg-slate-100 border-b border-black px-2.5 py-0.5 text-[9px] font-black uppercase flex justify-between">
              <span>2. Prestação de Serviço Terceirizado / Orçamento</span>
              <span className="font-bold text-[8.5px]">
                {chamado.orcamento_codigo ? `LOTE ${chamado.orcamento_codigo}` : "FORNECEDOR HOMOLOGADO"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1 p-2 text-[11px]">
              <p className="col-span-2"><strong>Empresa Prestadora:</strong> {chamado.empresa_terceirizada || "Prestador Autorizado"}</p>
              <p><strong>NF / Doc:</strong> {chamado.nf_referencia || chamado.numero_nf_retorno || (chamado.orcamento_codigo ? `Orçamento ${chamado.orcamento_codigo}` : "Não informada")}</p>
              <p><strong>Representante / Técnico:</strong> {chamado.tecnico_externo_nome || "Conforme Proposta"}</p>
              <p><strong>Mão de Obra / Serviço:</strong> <span className="font-bold text-slate-900">{formatarMoeda(custoServico)}</span></p>
              <p><strong>Atendimento:</strong> {chamado.tipo_atendimento || "Externo"}</p>
            </div>
          </div>
        )}

        {/* BOX 3: RELATÓRIO TÉCNICO */}
        <div className="mb-2 border border-black">
          <div className="bg-slate-100 border-b border-black px-2.5 py-0.5 text-[9px] font-black uppercase">
            {temTerceirizado ? "3." : "2."} Descrição Técnica do Atendimento
          </div>
          <div className="p-2 space-y-1.5 text-[11px]">
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Reclamação / Diagnóstico:</span>
              <p className="italic text-slate-800 bg-slate-50/70 p-1 rounded border border-slate-200 min-h-[22px]">{chamado.descricao_problema || "Sem descrição informada."}</p>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Solução Técnica Aplicada:</span>
              <p className="font-bold text-slate-900 bg-slate-50/70 p-1 rounded border border-slate-200 min-h-[22px]">
                {solucaoTecnica && solucaoTecnica !== "" ? solucaoTecnica : "Aguardando conclusão do chamado."}
              </p>
            </div>
          </div>
        </div>

        {/* BOX 4: FOTOS */}
        {temFotos && (
          <div className="mb-2 border border-black">
            <div className="bg-slate-100 border-b border-black px-2.5 py-0.5 text-[9px] font-black uppercase flex justify-between items-center">
              <span>{temTerceirizado ? "4." : "3."} Evidências Fotográficas</span>
              <span className="text-[8px] font-bold text-slate-600">REGISTRO DE CONFORMIDADE (ANTES & DEPOIS)</span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-1.5">
              
              <div className="text-center">
                <span className="text-[9px] font-black text-slate-700 uppercase block mb-0.5">
                  1. Evidência na Abertura (Antes)
                </span>
                <div className="foto-evidencia-box border border-slate-300 bg-slate-50 p-1 rounded flex items-center justify-center h-24">
                  {fotoAberturaUrl ? (
                    <img 
                      src={fotoAberturaUrl} 
                      alt="Evidência Antes" 
                      className="foto-evidencia-img max-h-20 max-w-full object-contain mx-auto" 
                    />
                  ) : (
                    <div className="text-[9px] text-slate-400 font-bold uppercase italic p-1">
                      Sem registro fotográfico inicial
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center">
                <span className="text-[9px] font-black text-slate-700 uppercase block mb-0.5">
                  2. Evidência na Conclusão (Depois)
                </span>
                <div className="foto-evidencia-box border border-slate-300 bg-slate-50 p-1 rounded flex items-center justify-center h-24">
                  {fotoConclusaoUrl ? (
                    <img 
                      src={fotoConclusaoUrl} 
                      alt="Evidência Depois" 
                      className="foto-evidencia-img max-h-20 max-w-full object-contain mx-auto" 
                    />
                  ) : (
                    <div className="text-[9px] text-slate-400 font-bold uppercase italic p-1">
                      {chamado.status === "Concluído" 
                        ? "Sem registro fotográfico na conclusão" 
                        : "Aguardando conclusão do atendimento"}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* BOX 5: PEÇAS E SERVIÇOS */}
        <div className="mb-2 border border-black">
          <div className="bg-slate-100 border-b border-black px-2.5 py-0.5 text-[9px] font-black uppercase">
            {temTerceirizado ? (temFotos ? "5." : "4.") : (temFotos ? "4." : "3.")} Peças, Insumos e Serviços Aplicados
          </div>
          <table className="w-full text-[10px] text-left">
            <thead>
              <tr className="border-b border-black bg-slate-50">
                <th className="p-1">Item / Insumo / Descrição</th>
                <th className="p-1 text-center">Tipo / Qtd</th>
                <th className="p-1 text-right">Unitário</th>
                <th className="p-1 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {chamado.itens_vinculados?.map((it, idx) => (
                <tr key={`item-${idx}`} className="border-b border-slate-200">
                  <td className="p-1 font-medium">{it.nome}</td>
                  <td className="p-1 text-center">{it.quantidade} un.</td>
                  <td className="p-1 text-right font-mono">{formatarMoeda(it.valor_unitario)}</td>
                  <td className="p-1 text-right font-mono font-bold">{formatarMoeda(it.quantidade * it.valor_unitario)}</td>
                </tr>
              ))}

              {custoServico > 0 && (
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <td className="p-1 font-bold text-slate-800">
                    🔧 Serviço Terceirizado Especializado
                    {chamado.orcamento_codigo && ` (${chamado.orcamento_codigo})`}
                    {chamado.empresa_terceirizada && ` - ${chamado.empresa_terceirizada}`}
                  </td>
                  <td className="p-1 text-center text-[9px] uppercase font-bold text-slate-600">Serviço Ext.</td>
                  <td className="p-1 text-right font-mono">{formatarMoeda(custoServico)}</td>
                  <td className="p-1 text-right font-mono font-bold">{formatarMoeda(custoServico)}</td>
                </tr>
              )}

              {(!chamado.itens_vinculados?.length && custoServico <= 0) && (
                <tr>
                  <td colSpan="4" className="p-1.5 text-center text-slate-400 italic text-[10px]">
                    Nenhuma peça do estoque debitada ou serviço terceirizado lançado para este atendimento.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t border-slate-300">
                <td colSpan="3" className="p-1 text-right uppercase text-[9px]">Total em Insumos (Estoque):</td>
                <td className="p-1 text-right text-[10px] font-mono">{formatarMoeda(totalPecas)}</td>
              </tr>
              {custoServico > 0 && (
                <tr className="bg-slate-50 font-bold border-t border-slate-200">
                  <td colSpan="3" className="p-1 text-right uppercase text-[9px]">Total Mão de Obra / Serviços Terceiros:</td>
                  <td className="p-1 text-right text-[10px] font-mono">{formatarMoeda(custoServico)}</td>
                </tr>
              )}
              <tr className="bg-slate-100 font-black border-t border-black">
                <td colSpan="3" className="p-1 text-right uppercase text-[9px]">Custo Total da OS (Peças + Serviços/Terceiros):</td>
                <td className="p-1 text-right text-xs font-black font-mono">{formatarMoeda(totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ASSINATURAS */}
        <div className="grid grid-cols-2 gap-6 mt-2 pt-1">
          {["tecnico", "setor"].map((tipo) => {
            const assinado = tipo === "tecnico" ? chamado.assinatura_tecnico : chamado.assinatura_setor;
            const nomeExibicao = tipo === "tecnico" 
              ? (chamado.nome_tecnico || chamado.tecnico_responsavel || chamado.empresa_terceirizada) 
              : chamado.nome_setor;

            return (
              <div key={tipo} className="text-center flex flex-col justify-end min-h-[50px]">
                {assinado ? (
                  <div className="mb-0.5">
                    <img src={assinado} alt="Rubrica" className="h-10 mx-auto object-contain" />
                    <p className="text-[10px] font-black uppercase mt-0.5 tracking-tight border-t border-black pt-0.5">{nomeExibicao}</p>
                  </div>
                ) : (
                  <div>
                    <div className="h-9 border-b border-black mb-0.5"></div>
                    <p className="text-[10px] font-bold uppercase tracking-tight text-slate-800">Assinatura / Carimbo</p>
                    
                    <div className="hide-print space-y-1.5 mt-2">
                      <input 
                        type="text" 
                        placeholder="Nome Completo" 
                        value={nomes[tipo]} 
                        onChange={e => setNomes({...nomes, [tipo]: e.target.value})} 
                        className="w-full border border-slate-300 p-1.5 rounded text-xs font-bold text-center" 
                      />
                      <div className="border border-slate-300 rounded bg-white">
                        <SignaturePad ref={tipo === "tecnico" ? padTecnico : padSetor} canvasProps={{ height: 60, className: "w-full" }} />
                      </div>
                      <button onClick={() => salvarAssinatura(tipo)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-[10px] font-black uppercase">
                        Salvar Assinatura
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-[8.5px] font-black text-slate-400 uppercase mt-0.5">
                  {tipo === "tecnico" 
                    ? (temTerceirizado ? "Prestador / Técnico Responsável" : "Técnico Responsável") 
                    : "Aceite do Responsável pelo Setor"}
                </p>
              </div>
            );
          })}
        </div>

        {/* NOTA DE RODAPÉ LEGAL */}
        <div className="mt-2 pt-1 border-t border-slate-200 text-[8px] text-center text-slate-400 uppercase tracking-widest">
          Documento gerado eletronicamente pelo Sistema SEC-H - {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}