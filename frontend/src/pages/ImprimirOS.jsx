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

  return (
    <div className="p-2 md:p-8 max-w-[210mm] mx-auto text-black bg-white">
      
      {/* ISOLAMENTO DA IMPRESSÃO */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
            background: white !important;
          }

          .os-impressao-container,
          .os-impressao-container * {
            visibility: visible;
          }

          .os-impressao-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: 1px solid #000 !important;
            padding: 0 !important;
          }

          .hide-print {
            display: none !important;
          }

          .break-inside-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex gap-3 justify-center mb-8 hide-print">
        <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">🖨️ IMPRIMIR OS</button>
        <button onClick={() => navigate(-1)} className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-bold">VOLTAR</button>
      </div>

      {/* CONTAINER PRINCIPAL */}
      <div className="os-impressao-container border border-slate-300 p-8 bg-white">
        
        {/* CABEÇALHO CORPORATIVO */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-black italic text-slate-800">HOSPITAL DOMINGOS LOURENÇO</h1>
            <p className="text-xs font-bold text-slate-500 uppercase">Engenharia Clínica & Manutenção de Ativos</p>
          </div>
          <div className="text-right">
            <div className="bg-black text-white px-4 py-1 text-sm font-black rounded mb-1">ORDEM DE SERVIÇO</div>
            <p className="text-lg font-black">Nº {String(chamado.id).padStart(6, "0")}</p>
          </div>
        </div>

        {/* METADADOS DO CHAMADO */}
        <div className="grid grid-cols-4 gap-4 mb-6 text-[11px] bg-slate-50 p-3 border border-slate-200 rounded-lg">
          <div><label className="font-black block text-slate-400">STATUS:</label><span className="font-bold">{chamado.status?.toUpperCase()}</span></div>
          <div><label className="font-black block text-slate-400">TIPO:</label><span className="font-bold">{chamado.tipo_manutencao?.toUpperCase() || "CORRETIVA"}</span></div>
          <div><label className="font-black block text-slate-400">ABERTO EM:</label><span className="font-bold">{formatarData(chamado.data_abertura)}</span></div>
          <div><label className="font-black block text-slate-400">CONCLUÍDO EM:</label><span className="font-bold">{formatarData(chamado.data_conclusao)}</span></div>
        </div>

        {/* BOX 1: DADOS DO ATIVO E LOCALIZAÇÃO */}
        <div className="mb-6 border border-black break-inside-avoid">
          <div className="bg-slate-100 border-b border-black px-3 py-1 text-[10px] font-black uppercase">
            1. Identificação do Ativo / Local
          </div>
          <div className="grid grid-cols-2 gap-y-2 p-3 text-xs">
            <p><strong>Equipamento:</strong> {chamado.eq_nome || "N/A"}</p>
            <p><strong>Patrimônio:</strong> {chamado.patrimonio || "N/A"}</p>
            <p><strong>Modelo:</strong> {chamado.modelo || "N/A"}</p>
            <p><strong>Nº de Série:</strong> {chamado.num_serie || "N/A"}</p>
            <p><strong>Setor / Local:</strong> {chamado.setor_nome || "N/A"}</p>
            <p><strong>Solicitante:</strong> {chamado.solicitante_nome || "N/A"}</p>
          </div>
        </div>

        {/* BOX 2: DADOS DO FORNECEDOR / TERCEIRIZADO (RENDERIZA SE HOUVER) */}
        {temTerceirizado && (
          <div className="mb-6 border border-black break-inside-avoid">
            <div className="bg-slate-100 border-b border-black px-3 py-1 text-[10px] font-black uppercase flex justify-between">
              <span>2. Prestação de Serviço Terceirizado</span>
              <span className="font-bold">FORNECEDOR HOMOLOGADO</span>
            </div>
            <div className="grid grid-cols-3 gap-y-2 p-3 text-xs">
              <p className="col-span-2"><strong>Empresa Prestadora:</strong> {chamado.empresa_terceirizada || "N/A"}</p>
              <p><strong>NF de Referência:</strong> {chamado.nf_referencia || "Não informada"}</p>
              <p><strong>Técnico / Representante:</strong> {chamado.tecnico_externo_nome || "Não informado"}</p>
              <p><strong>Valor Mão de Obra / Serviço:</strong> {formatarMoeda(custoServico)}</p>
              <p><strong>Tipo de Atendimento:</strong> {chamado.tipo_atendimento || "Interno"}</p>
            </div>
          </div>
        )}

        {/* BOX 3: RELATÓRIO TÉCNICO */}
        <div className="mb-6 border border-black break-inside-avoid">
          <div className="bg-slate-100 border-b border-black px-3 py-1 text-[10px] font-black uppercase">
            {temTerceirizado ? "3." : "2."} Descrição Técnica do Atendimento
          </div>
          <div className="p-3">
            <div className="mb-4">
              <label className="text-[10px] font-black text-slate-400 block mb-1">RECLAMAÇÃO / DIAGNÓSTICO:</label>
              <div className="text-xs italic min-h-[30px]">{chamado.descricao_problema}</div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 block mb-1">SOLUÇÃO TÉCNICA APLICADA:</label>
              <div className="text-xs font-bold min-h-[40px]">
                {solucaoTecnica && solucaoTecnica !== "" ? solucaoTecnica : "Aguardando conclusão."}
              </div>
            </div>
          </div>
        </div>

        {/* BOX 4: FOTOS E REGISTROS FOTOGRÁFICOS */}
        {(chamado.foto_abertura || chamado.foto_conclusao) && (
          <div className="mb-6 border border-black break-inside-avoid">
            <div className="bg-slate-100 border-b border-black px-3 py-1 text-[10px] font-black uppercase">
              {temTerceirizado ? "4." : "3."} Evidências Fotográficas
            </div>
            <div className="grid grid-cols-2 gap-4 p-3">
              {chamado.foto_abertura && (
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Evidência na Abertura</p>
                  <div className="border border-slate-300 p-1 rounded bg-slate-50 flex items-center justify-center">
                    <img 
                      src={chamado.foto_abertura} 
                      alt="Foto de Abertura" 
                      className="max-h-48 max-w-full object-contain mx-auto" 
                    />
                  </div>
                </div>
              )}
              {chamado.foto_conclusao && (
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Evidência na Conclusão</p>
                  <div className="border border-slate-300 p-1 rounded bg-slate-50 flex items-center justify-center">
                    <img 
                      src={chamado.foto_conclusao} 
                      alt="Foto de Conclusão" 
                      className="max-h-48 max-w-full object-contain mx-auto" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOX 5: TABELA DE PEÇAS / INSUMOS */}
        <div className="mb-6 border border-black break-inside-avoid">
          <div className="bg-slate-100 border-b border-black px-3 py-1 text-[10px] font-black uppercase">
            {temTerceirizado ? "5." : "4."} Peças e Insumos Aplicados
          </div>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black bg-slate-50">
                <th className="p-2">Item</th>
                <th className="p-2 text-center">Qtd</th>
                <th className="p-2 text-right">Unitário</th>
                <th className="p-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {chamado.itens_vinculados?.length > 0 ? (
                chamado.itens_vinculados.map((it, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 font-medium">{it.nome}</td>
                    <td className="p-2 text-center">{it.quantidade}</td>
                    <td className="p-2 text-right">{formatarMoeda(it.valor_unitario)}</td>
                    <td className="p-2 text-right">{formatarMoeda(it.quantidade * it.valor_unitario)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="4" className="p-4 text-center text-slate-400 italic">Nenhuma peça do estoque foi utilizada neste atendimento.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold">
                <td colSpan="3" className="p-2 text-right uppercase text-[10px]">Total em Insumos:</td>
                <td className="p-2 text-right">{formatarMoeda(totalPecas)}</td>
              </tr>
              <tr className="bg-slate-100 font-black border-t border-black">
                <td colSpan="3" className="p-2 text-right uppercase text-[10px]">Custo Total da OS (Peças + Mão de Obra/Terceiros):</td>
                <td className="p-2 text-right text-base">{formatarMoeda(totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* RODAPÉ DE ASSINATURAS */}
        <div className="grid grid-cols-2 gap-10 mt-8 break-inside-avoid">
          {["tecnico", "setor"].map((tipo) => {
            const assinado = tipo === "tecnico" ? chamado.assinatura_tecnico : chamado.assinatura_setor;
            const nomeExibicao = tipo === "tecnico" 
              ? (chamado.nome_tecnico || chamado.tecnico_responsavel || chamado.empresa_terceirizada) 
              : chamado.nome_setor;

            return (
              <div key={tipo} className="text-center flex flex-col justify-end min-h-[140px]">
                {assinado ? (
                  <div className="mb-2">
                    <img src={assinado} alt="Rubrica" className="h-14 mx-auto object-contain" />
                    <p className="text-xs font-black uppercase mt-1 tracking-tighter border-t border-black pt-1">{nomeExibicao}</p>
                  </div>
                ) : (
                  <div className="hide-print space-y-2 mb-2">
                    <input type="text" placeholder="Nome Completo" value={nomes[tipo]} onChange={e => setNomes({...nomes, [tipo]: e.target.value})} className="w-full border-2 border-slate-200 p-2 rounded text-xs font-bold text-center" />
                    <div className="border border-slate-300 rounded"><SignaturePad ref={tipo === "tecnico" ? padTecnico : padSetor} canvasProps={{ height: 90, className: "w-full" }} /></div>
                    <button onClick={() => salvarAssinatura(tipo)} className="w-full bg-blue-600 text-white py-1 rounded text-[10px] font-black uppercase">Validar Assinatura</button>
                  </div>
                )}
                <p className="text-[9px] font-black text-slate-400 uppercase">
                  {tipo === "tecnico" 
                    ? (temTerceirizado ? "Prestador / Técnico Responsável" : "Técnico Responsável") 
                    : "Aceite do Responsável pelo Setor"}
                </p>
              </div>
            );
          })}
        </div>

        {/* NOTA DE RODAPÉ */}
        <div className="mt-8 pt-3 border-t border-slate-200 text-[9px] text-center text-slate-400 uppercase tracking-widest break-inside-avoid">
            Documento gerado eletronicamente pelo Sistema SEC-H - {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}