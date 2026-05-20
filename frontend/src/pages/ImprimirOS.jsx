import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SignaturePad from "react-signature-canvas";

export function ImprimirOS() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chamado, setChamado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nomes, setNomes] = useState({ tecnico: "", setor: "" });

  const padTecnico = useRef(null);
  const padSetor = useRef(null);

  const API_URL = "http://192.168.5.101:3000/api";

  const carregarOS = async () => {
    try {
      const res = await fetch(`${API_URL}/chamados/${id}`);
      if (!res.ok) throw new Error("Erro ao carregar OS");
      const data = await res.json();
      setChamado(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarOS();
  }, [id]);

  const salvarAssinatura = async (tipo) => {
    const padRef = tipo === "tecnico" ? padTecnico : padSetor;
    const nomeDigitado = nomes[tipo];

    if (!padRef.current || padRef.current.isEmpty()) return alert("Faça a assinatura.");
    if (!nomeDigitado?.trim()) return alert("Digite o nome.");

    // Lógica para forçar o fundo branco na exportação da imagem
    const canvas = padRef.current.getCanvas();
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext("2d");
    
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.drawImage(canvas, 0, 0);
    
    const dataURL = tempCanvas.toDataURL("image/png");

    try {
      const response = await fetch(`${API_URL}/chamados/${id}/assinar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, assinaturaBase64: dataURL, nome: nomeDigitado })
      });

      if (response.ok) {
        alert("Assinatura salva!");
        await carregarOS();
      } else {
        alert("Erro ao salvar assinatura.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de conexão.");
    }
  };

  if (loading) return <p className="p-8 text-center font-bold">Carregando...</p>;
  if (!chamado) return <p className="p-8 text-center text-red-500 font-bold">OS não encontrada.</p>;

  return (
    <div className="p-4 max-w-[210mm] mx-auto text-black">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .os-container, .os-container * { visibility: visible; }
          .os-container { position: absolute; left: 0; top: 0; width: 100%; }
          .hide-print { display: none !important; }
        }
      `}</style>

      <div className="flex gap-2 justify-center mb-6 hide-print">
        <button onClick={() => window.print()} className="bg-green-600 text-white px-6 py-2 rounded font-bold">🖨️ IMPRIMIR</button>
        <button onClick={() => navigate(-1)} className="bg-slate-500 text-white px-6 py-2 rounded font-bold">VOLTAR</button>
      </div>

      <div className="os-container border-2 border-black p-6">
        <div className="text-center border-b border-black pb-4 mb-4">
          <h1 className="text-2xl font-black">ORDEM DE SERVIÇO</h1>
          <p className="font-bold">Nº {String(chamado.id).padStart(6, "0")}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <p><strong>Equipamento:</strong> {chamado.eq_nome || chamado.nome || "N/A"}</p>
          <p><strong>Patrimônio:</strong> {chamado.patrimonio || "N/A"}</p>
          <p><strong>Setor:</strong> {chamado.setor_nome || "N/A"}</p>
          <p><strong>Técnico:</strong> {chamado.tecnico_responsavel || "N/A"}</p>
        </div>

        <div className="mt-6">
          <p className="font-bold border-b border-black mb-2">Diagnóstico</p>
          <div className="min-h-[80px] whitespace-pre-wrap">{chamado.descricao_problema || "Sem descrição"}</div>
        </div>

        <div className="grid grid-cols-2 gap-10 mt-16">
          {["tecnico", "setor"].map((tipo) => (
            <div key={tipo} className="text-center">
              {chamado[tipo === "tecnico" ? "assinatura_tecnico" : "assinatura_setor"] ? (
                <img src={chamado[tipo === "tecnico" ? "assinatura_tecnico" : "assinatura_setor"]} alt="Assinatura" className="h-24 mx-auto object-contain" />
              ) : (
                <div className="hide-print">
                  <input 
                    type="text" 
                    placeholder={tipo === "tecnico" ? "Nome Técnico" : "Nome Responsável"} 
                    value={nomes[tipo]} 
                    onChange={(e) => setNomes({ ...nomes, [tipo]: e.target.value })} 
                    className="w-full border p-1 text-center mb-2"
                  />
                  <SignaturePad
                    ref={tipo === "tecnico" ? padTecnico : padSetor}
                    canvasProps={{ width: 500, height: 120, className: "border border-black bg-white w-full" }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => (tipo === "tecnico" ? padTecnico : padSetor).current.clear()} className="w-1/3 bg-slate-300 py-2 rounded text-sm">LIMPAR</button>
                    <button onClick={() => salvarAssinatura(tipo)} className="w-2/3 bg-blue-600 text-white py-2 rounded text-sm font-bold">SALVAR ASSINATURA</button>
                  </div>
                </div>
              )}
              <div className="border-t border-black mt-4 pt-1">
                <p className="text-xs font-bold uppercase">{tipo === "tecnico" ? "Técnico Executante" : "Aceite do Setor"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
