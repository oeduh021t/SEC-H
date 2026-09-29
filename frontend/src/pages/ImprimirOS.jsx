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

  // Funções Auxiliares de Formatação
  const formatarData = (data) => data ? new Date(data).toLocaleString('pt-BR') : "---";
  const formatarMoeda = (valor) => new Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading) return <p className="p-8 text-center font-bold">Gerando Relatório...</p>;
  if (!chamado) return <p className="p-8 text-center text-red-500 font-bold">OS não encontrada.</p>;

  // Cálculo de Peças e Totais
  const totalPecas = chamado.itens_vinculados?.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario), 0) || 0;
  const custoServico = Number(chamado.custo_servico) || 0;
  const totalGeral = totalPecas + custoServico;

  // Extração da Solução Técnica
  const logConclusao = chamado.historico?.find(
    (h) => h.status_momento?.toLowerCase() === "concluído" || h.status_momento?.toLowerCase() === "concluido"
  );
  const solucaoTecnica = logConclusao?.texto_historico?.trim() || chamado.descricao_solucao?.trim();

  // Flag de Fornecedor Terceirizado
  const temTerceirizado = Boolean(chamado.empresa_terceirizada || chamado.fornecedor_id);

  // Exibição do Setor Hierárquico
  const setorExibicao = chamado.setor_completo || 
    (chamado.setor_pai_nome ? `${chamado.setor_pai_nome} > ${chamado.setor_nome}` : chamado.setor_nome) || 
    "N/A";

  const temFotos = Boolean(chamado.foto_abertura || chamado.foto_conclusao);

  return (
    <div className="p-2 md:p-6 max-w-[210mm] mx-auto text-black bg-white">
      
      {/* CSS DE IMPRESSÃO TRAVADO EM 1 FOLHA PREENCHIDA */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 7mm 8mm;
        }

        @media print {
          html, body {
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
            border: 1.5px solid #000 !important;
            padding: 16px 20px !important;
            margin: 0 !important;
            box-sizing: border-box;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }

          .hide-print {
            display: none !important;
          }

          /* Altura equilibrada para foto com boa visualização */
          .foto-evidencia-box {
            height: 145px !important;
            max-height: 145px !important;
          }
          .foto-evidencia-img {
            max-height: 135px !important;
            object-fit: contain !important;
          }
        }
      `}</style>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex gap-3 justify-center mb-6 hide-print">
        <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 text-sm hover:bg-slate-900 transition">
          🖨️ IMPRIMIR OS
        </button>
        <button onClick={() => navigate(-1)} className="bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-slate-300 transition">
          VOLTAR
        </button>
      </div>

      {/* CONTAINER PRINCIPAL */}
      <div className="os-impressao-container border-2 border-black p-6 bg-white">
        
        {/* CABEÇALHO CORPORATIVO */}
        <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-3">
          <div>
            <h1 className="text-2xl font-black italic tracking-tight text-slate-900 leading-none">HOSPITAL DOMINGOS LOURENÇO</h1>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-1">Engenharia Clínica & Manutenção Predial</p>
          </div>
          <div className="text-right">
            <div className="bg-black text-white px-4 py-1 text-xs font-black rounded mb-1 tracking-wider inline-block">ORDEM DE SERVIÇO</div>
            <p className="text-lg font-black leading-tight">Nº {String(chamado.id).padStart(6, "0")}</p>
          </div>
        </div>

        {/* METADADOS DO CHAMADO */}
        <div className="grid grid-cols-4 gap-3 mb-3 text-xs bg-slate-50 p-2.5 border border-slate-300 rounded">
          <div><label className="font-bold text-slate-500 block text-[10px] uppercase">Status:</label><span className="font-extrabold">{chamado.status?.toUpperCase()}</span></div>
          <div><label className="font-bold text-slate-500 block text-[10px] uppercase">Tipo:</label><span className="font-extrabold">{chamado.tipo_manutencao?.toUpperCase() || "CORRETIVA"}</span></div>
          <div><label className="font-bold text-slate-500 block text-[10px] uppercase">Aberto em:</label><span className="font-bold">{formatarData(chamado.data_abertura)}</span></div>
          <div><label className="font-bold text-slate-500 block text-[10px] uppercase">Concluído em:</label><span className="font-bold">{formatarData(chamado.data_conclusao)}</span></div>
        </div>

        {/* BOX 1: DADOS DO ATIVO E LOCALIZAÇÃO */}
        <div className="mb-3 border border-black">
          <div className="bg-slate-100 border-b border-black px-3 py-1 text-[10px] font-black uppercase">
            1. Identificação do Ativo / Local
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 p-2.5 text-xs">
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
          <div className="mb-3 border border-black">
            <div className="bg-slate-100 border-b border-black px-3 py-1 text-[10px] font-black uppercase flex justify-between">
              <span>2. Prestação de Serviço Terceirizado</span>
              <span className="font-bold text-[9px]">FORNECEDOR HOMOLOGADO</span>
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 p-2.5 text-xs">
              <p className="col-span-2"><strong>Empresa Prestadora:</strong> {chamado.empresa_terceirizada || "N/A"}</p>
              <p><strong>NF / Doc:</strong> {chamado.nf_referencia || "Não informada"}</p>
              <p><strong>Representante / Técnico:</strong> {chamado.tecnico_externo_nome || "Não informado"}</p>
              <p><strong>Mão de Obra / Serviço:</strong> {formatarMoeda(custoServico)}</p>
              <p><strong>Atendimento:</strong> {chamado.tipo_atendimento || "Interno"}</p>
            </div>
          </div>
        )}

        {/* BOX 3: RELATÓRIO TÉCNICO */}
        <div className="mb-3 border border-black">
          <div className="bg-slate-100 border-b border-black px-3 py-1 text-[10px] font-black uppercase">
            {temTerceirizado ? "3." : "2."} Descrição Técnica do Atendimento
          </div>
          <div className="p-2.5 space-y-2 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Reclamação / Diagnóstico:</span>
              <p className="italic text-slate-800 bg-slate-50/70 p-1.5 rounded border border-slate-200 min-h-[30px]">{chamado.descricao_problema || "Sem descrição informada."}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Solução Técnica Aplicada:</span>
              <p className="font-bold text-slate-900 bg-slate-50/70 p-1.5 rounded border border-slate-200 min-h-[35px]">
                {solucaoTecnica && solucaoTecnica !== "" ? solucaoTecnica : "Aguardando conclusão do chamado."}
              </p>
            </div>
          </div>
        </div>

        {/* BOX 4: FOTOS AMPLIADAS */}
        {temFotos && (
          <div className="mb-3 border border-black">
            <div className="bg-slate-100 border-b border-black px-3 py-1 text-[10px] font-black uppercase">
              {temTerceirizado ? "4." : "3."} Evidências Fotográficas
            </div>
            <div className="grid grid-cols-2 gap-4 p-2.5">
              {chamado.foto_abertura && (
                <div className="text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Evidência na Abertura</span>
                  <div className="foto-evidencia-box border border-slate-300 bg-slate-50 p-1.5 rounded flex items-center justify-center h-36">
                    <img 
                      src={chamado.foto_abertura} 
                      alt="Abertura" 
                      className="foto-evidencia-img max-h-32 max-w-full object-contain mx-auto" 
                    />
                  </div>
                </div>
              )}
              {chamado.foto_conclusao && (
                <div className="text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Evidência na Conclusão</span>
                  <div className="foto-evidencia-box border border-slate-300 bg-slate-50 p-1.5 rounded flex items-center justify-center h-36">
                    <img 
                      src={chamado.foto_conclusao} 
                      alt="Conclusão" 
                      className="foto-evidencia-img max-h-32 max-w-full object-contain mx-auto" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOX 5: TABELA DE PEÇAS / INSUMOS */}
        <div className="mb-3 border border-black">
          <div className="bg-slate-100 border-b border-black px-3 py-1 text-[10px] font-black uppercase">
            {temTerceirizado ? (temFotos ? "5." : "4.") : (temFotos ? "4." : "3.")} Peças e Insumos Aplicados
          </div>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black bg-slate-50">
                <th className="p-1.5">Item / Insumo</th>
                <th className="p-1.5 text-center">Qtd</th>
                <th className="p-1.5 text-right">Unitário</th>
                <th className="p-1.5 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {chamado.itens_vinculados?.length > 0 ? (
                chamado.itens_vinculados.map((it, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-1.5 font-medium">{it.nome}</td>
                    <td className="p-1.5 text-center">{it.quantidade}</td>
                    <td className="p-1.5 text-right">{formatarMoeda(it.valor_unitario)}</td>
                    <td className="p-1.5 text-right">{formatarMoeda(it.quantidade * it.valor_unitario)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-2 text-center text-slate-400 italic text-xs">
                    Nenhuma peça do estoque foi debitada para este atendimento.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t border-slate-300">
                <td colSpan="3" className="p-1.5 text-right uppercase text-[10px]">Total em Insumos:</td>
                <td className="p-1.5 text-right text-xs">{formatarMoeda(totalPecas)}</td>
              </tr>
              <tr className="bg-slate-100 font-black border-t border-black">
                <td colSpan="3" className="p-1.5 text-right uppercase text-[10px]">Custo Total da OS (Peças + Serviços/Terceiros):</td>
                <td className="p-1.5 text-right text-sm font-black">{formatarMoeda(totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* RODAPÉ DE ASSINATURAS */}
        <div className="grid grid-cols-2 gap-8 mt-5 pt-1">
          {["tecnico", "setor"].map((tipo) => {
            const assinado = tipo === "tecnico" ? chamado.assinatura_tecnico : chamado.assinatura_setor;
            const nomeExibicao = tipo === "tecnico" 
              ? (chamado.nome_tecnico || chamado.tecnico_responsavel || chamado.empresa_terceirizada) 
              : chamado.nome_setor;

            return (
              <div key={tipo} className="text-center flex flex-col justify-end min-h-[90px]">
                {assinado ? (
                  <div className="mb-1">
                    <img src={assinado} alt="Rubrica" className="h-12 mx-auto object-contain" />
                    <p className="text-xs font-black uppercase mt-1 tracking-tight border-t border-black pt-1">{nomeExibicao}</p>
                  </div>
                ) : (
                  <div>
                    {/* Linha para assinatura manual no papel */}
                    <div className="h-14 border-b border-black mb-1"></div>
                    <p className="text-xs font-bold uppercase tracking-tight text-slate-800">Assinatura / Carimbo</p>
                    
                    {/* Pad de assinatura digital (some ao imprimir) */}
                    <div className="hide-print space-y-1.5 mt-2">
                      <input 
                        type="text" 
                        placeholder="Nome Completo" 
                        value={nomes[tipo]} 
                        onChange={e => setNomes({...nomes, [tipo]: e.target.value})} 
                        className="w-full border border-slate-300 p-1.5 rounded text-xs font-bold text-center" 
                      />
                      <div className="border border-slate-300 rounded bg-white">
                        <SignaturePad ref={tipo === "tecnico" ? padTecnico : padSetor} canvasProps={{ height: 70, className: "w-full" }} />
                      </div>
                      <button onClick={() => salvarAssinatura(tipo)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-[10px] font-black uppercase">
                        Salvar Assinatura
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-[9px] font-black text-slate-400 uppercase mt-1">
                  {tipo === "tecnico" 
                    ? (temTerceirizado ? "Prestador / Técnico Responsável" : "Técnico Responsável") 
                    : "Aceite do Responsável pelo Setor"}
                </p>
              </div>
            );
          })}
        </div>

        {/* NOTA DE RODAPÉ LEGAL */}
        <div className="mt-4 pt-2 border-t border-slate-200 text-[9px] text-center text-slate-400 uppercase tracking-widest">
            Documento gerado eletronicamente pelo Sistema SEC-H - {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}